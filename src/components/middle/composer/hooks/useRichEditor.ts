import type { Editor, JSONContent as TiptapJsonContent } from '@tiptap/core';
import {
  useEffect, useMemo, useRef, useState, useUnmountCleanup,
} from '../../../../lib/teact/teact';

import type { ApiInputRichMessage } from '../../../../api/types';
import type { RichEditorMediaAttrs, RichEditorMediaItem } from '../../../../util/tiptap/richMedia';
import type { RichEditor, RichEditorRoot } from '../richEditorTypes';

import { Bundles, loadBundle } from '../../../../util/moduleLoader';
import { MEDIA_NODE_NAME } from '../../../../util/tiptap/constants';
import {
  getRichEditorMediaAttrs,
  getRichMediaUploadIds,
  registerRichMedia,
  removeRichMediaUpload,
} from '../../../../util/tiptap/richMedia';
import setEditorContentWithoutHistory from '../../../../util/tiptap/setEditorContentWithoutHistory';
import {
  buildRichMessageFromTiptapJson,
  buildTiptapJsonFromRichMessage,
  getRichInputAsFormatted,
} from '../../../ui/textInput/richText';
import {
  deleteEditorCharacterBeforeSelection,
  hasEditorCollapsedSelection,
  insertEditorContent,
  replaceEditorRange,
} from '../helpers/richEditorComposer';

import useLastCallback from '../../../../hooks/useLastCallback';

const EMPTY_RICH_MESSAGE: ApiInputRichMessage = { blocks: [] };

type EditorBundle = {
  getRichEditorCanRedo: (editor: Editor) => boolean;
  getRichEditorCanUndo: (editor: Editor) => boolean;
};

export default function useRichEditor(
  canSendPhotos?: boolean, canSendVideos?: boolean, canSendDocuments?: boolean, canSendAudios?: boolean,
) {
  const valueRef = useRef(EMPTY_RICH_MESSAGE);
  const metadataRef = useRef<Pick<ApiInputRichMessage, 'isRtl' | 'shouldDisableAutoLink'>>({});
  const ownedUploadIdsRef = useRef(new Set<string>());
  const editorRef = useRef<Editor>();
  const editorBundleRef = useRef<EditorBundle>();
  const isEditorEmptyRef = useRef<(editor: Editor) => boolean>();
  const rootRef = useRef<RichEditorRoot>();
  const [currentValue, setCurrentValue] = useState(EMPTY_RICH_MESSAGE);
  const [root, setRoot] = useState<RichEditorRoot | undefined>();
  const [isReady, setIsReady] = useState(false);
  const [hasUnresolvedMedia, setHasUnresolvedMedia] = useState(false);
  const canUndo = Boolean(editorRef.current && editorBundleRef.current?.getRichEditorCanUndo(editorRef.current));
  const canRedo = Boolean(editorRef.current && editorBundleRef.current?.getRichEditorCanRedo(editorRef.current));

  valueRef.current = currentValue;

  const getCanInsertMedia = useLastCallback((type: RichEditorMediaItem['type']) => (
    Boolean(type === 'document' ? canSendDocuments : type === 'audio' ? canSendAudios
      : type === 'photo' ? canSendPhotos : canSendVideos)
  ));

  const clearMediaUploads = useLastCallback(() => {
    ownedUploadIdsRef.current.forEach(removeRichMediaUpload);
    ownedUploadIdsRef.current.clear();
  });

  useUnmountCleanup(clearMediaUploads);

  const registerRoot = useLastCallback((nextRoot: RichEditorRoot) => {
    rootRef.current = nextRoot;
    setRoot(nextRoot);

    return () => {
      if (rootRef.current !== nextRoot) return;

      rootRef.current = undefined;
      setRoot(undefined);
    };
  });

  useEffect(() => {
    if (!root) {
      editorRef.current?.destroy();
      editorRef.current = undefined;
      setIsReady(false);
      return undefined;
    }

    const currentRoot = root;
    let isDestroyed = false;
    setIsReady(false);

    async function initEditor() {
      const editorBundle = await loadBundle(Bundles.Editor);
      const { createRichEditor, isRichEditorEmpty } = editorBundle;
      editorBundleRef.current = editorBundle;
      isEditorEmptyRef.current = isRichEditorEmpty;
      const editor = createRichEditor({
        element: currentRoot.element,
        sharedCanvasRef: currentRoot.sharedCanvasRef,
        sharedCanvasHqRef: currentRoot.sharedCanvasHqRef,
        content: buildTiptapJsonFromRichMessage(valueRef.current),
        tooltips: currentRoot.tooltips,
        getIsRichInputExpanded: currentRoot.getIsRichInputExpanded,
        getCanInsertMedia,
        onUpdate: (updatedEditor) => {
          const json = updatedEditor.getJSON();
          const richMessage = buildRichMessage(json, metadataRef.current);
          valueRef.current = richMessage;
          setCurrentValue(richMessage);
          setHasUnresolvedMedia(checkHasUnresolvedMedia(json));
          // Undo history retains media blocks and their local uploads until the document is reset
          getRichMediaUploadIds(json).forEach((uploadId) => ownedUploadIdsRef.current.add(uploadId));
          currentRoot.onUpdate(isRichEditorEmpty(updatedEditor), updatedEditor.view.dom);
        },
        onDateClick: currentRoot.onDateClick,
        onMediaEdit: currentRoot.onMediaEdit,
        onMediaFiles: currentRoot.onMediaFiles,
      });
      if (isDestroyed) {
        editor.destroy();
        return;
      }

      editorRef.current = editor;
      setIsReady(true);
      currentRoot.onReady(editor.view.dom);
    }

    void initEditor();

    return () => {
      isDestroyed = true;
      editorRef.current?.destroy();
      editorRef.current = undefined;
      setIsReady(false);
    };
  }, [getCanInsertMedia, root]);

  return useMemo<RichEditor>(() => ({
    editor: editorRef.current,
    isReady,
    value: currentValue,
    canUndo,
    canRedo,
    deleteCharacterBeforeSelection: () => deleteEditorCharacterBeforeSelection(editorRef.current),
    focus: () => {
      editorRef.current?.commands.focus();
    },
    getAsFormatted: () => {
      const valueToFormat = editorRef.current
        ? buildRichMessage(editorRef.current.getJSON(), metadataRef.current)
        : valueRef.current;

      return getRichInputAsFormatted(valueToFormat);
    },
    getValue: () => {
      if (editorRef.current) {
        return buildRichMessage(editorRef.current.getJSON(), metadataRef.current);
      }

      return valueRef.current;
    },
    hasCollapsedSelection: () => hasEditorCollapsedSelection(editorRef.current),
    hasUnresolvedMedia,
    isEmpty: () => {
      const editor = editorRef.current;
      if (!editor) {
        return !valueRef.current.blocks.length;
      }

      return isEditorEmptyRef.current ? isEditorEmptyRef.current(editor) : !valueRef.current.blocks.length;
    },
    insertContent: (content, shouldPrepend) => insertEditorContent(editorRef.current, content, shouldPrepend),
    insertMedia: (items, position, shouldAppend) => (
      insertRichEditorMedia(editorRef.current, items, position, shouldAppend)
    ),
    redo: () => {
      editorRef.current?.chain().focus().redo().run();
    },
    replaceValue: (nextValue) => {
      metadataRef.current = getRichMessageMetadata(nextValue);
      valueRef.current = nextValue;
      setCurrentValue(nextValue);
      const json = buildTiptapJsonFromRichMessage(nextValue);
      setHasUnresolvedMedia(checkHasUnresolvedMedia(json));
      editorRef.current?.chain()
        .setContent(json, { emitUpdate: false })
        .focus('end')
        .run();
    },
    replaceRange: (range, content) => {
      replaceEditorRange(editorRef.current, range, content);
    },
    registerRoot,
    resetMedia: (uploadId) => {
      setRichEditorMedia(editorRef.current, uploadId);
    },
    resolveMedia: (uploadId, media) => {
      if (media) setRichEditorMedia(editorRef.current, uploadId, media);
    },
    setValue: (nextValue) => {
      clearMediaUploads();
      const valueToSet = nextValue || EMPTY_RICH_MESSAGE;
      metadataRef.current = getRichMessageMetadata(valueToSet);
      valueRef.current = valueToSet;
      setCurrentValue(valueToSet);
      const json = buildTiptapJsonFromRichMessage(valueToSet);
      setHasUnresolvedMedia(checkHasUnresolvedMedia(json));
      if (editorRef.current) {
        setEditorContentWithoutHistory(editorRef.current, json);
      }
    },
    undo: () => {
      editorRef.current?.chain().focus().undo().run();
    },
  }), [canRedo, canUndo, clearMediaUploads, currentValue, hasUnresolvedMedia, isReady, registerRoot]);
}

function insertRichEditorMedia(
  editor: Editor | undefined,
  items: RichEditorMediaItem[],
  position: number,
  shouldAppend?: boolean,
) {
  if (!editor || !items.length) return false;

  if (shouldAppend && items.every((item) => item.type === 'photo' || item.type === 'video')) {
    const currentNode = editor.state.doc.nodeAt(position);
    const currentAttrs = currentNode && getRichEditorMediaAttrs(currentNode.toJSON());
    if (currentNode?.type.name === MEDIA_NODE_NAME && currentAttrs
      && currentAttrs.kind !== 'document' && currentAttrs.kind !== 'audio') {
      const nextItems = [...currentAttrs.items, ...items];
      editor.view.dispatch(editor.state.tr.setNodeMarkup(position, undefined, {
        ...currentAttrs,
        kind: currentAttrs.items.length === 1 ? 'collage' : currentAttrs.kind,
        items: nextItems,
      }).scrollIntoView());
      editor.commands.focus();
      return true;
    }
  }

  return editor.chain().focus().insertContentAt(position, items.map(buildMediaNode)).run();
}

function setRichEditorMedia(
  editor: Editor | undefined,
  uploadId: string,
  media?: NonNullable<RichEditorMediaItem['media']>,
) {
  if (!editor) return;

  let didResolve = false;
  const transaction = editor.state.tr;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== MEDIA_NODE_NAME) return;

    const attrs = getRichEditorMediaAttrs(node.toJSON());
    if (!attrs) return;

    const itemIndex = attrs.items.findIndex((item) => item.uploadId === uploadId);
    if (itemIndex < 0) return;

    const items = attrs.items.slice();
    items[itemIndex] = {
      ...items[itemIndex],
      media,
    };
    transaction.setNodeMarkup(position, undefined, { ...attrs, items });
    didResolve = true;
  });
  if (!didResolve) return;

  if (media) registerRichMedia(media);
  transaction.setMeta('addToHistory', false);
  editor.view.dispatch(transaction);
}

function buildMediaNode(item: RichEditorMediaItem) {
  const attrs: RichEditorMediaAttrs = {
    kind: item.type,
    items: [item],
    credit: { type: 'empty' },
  };
  return {
    type: MEDIA_NODE_NAME,
    attrs,
    content: [],
  };
}

function checkHasUnresolvedMedia(node: TiptapJsonContent): boolean {
  if (node.type === MEDIA_NODE_NAME && getRichEditorMediaAttrs(node)?.items.some(({ media }) => !media)) {
    return true;
  }

  return node.content?.some(checkHasUnresolvedMedia) || false;
}

function buildRichMessage(
  json: TiptapJsonContent,
  metadata: Pick<ApiInputRichMessage, 'isRtl' | 'shouldDisableAutoLink'>,
) {
  return {
    ...buildRichMessageFromTiptapJson(json),
    ...metadata,
  };
}

function getRichMessageMetadata(value: ApiInputRichMessage) {
  return {
    isRtl: value.isRtl,
    shouldDisableAutoLink: value.shouldDisableAutoLink,
  };
}
