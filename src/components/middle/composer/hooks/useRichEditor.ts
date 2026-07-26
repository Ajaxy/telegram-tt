import type { Editor } from '@tiptap/core';
import { useEffect, useMemo, useRef, useState } from '../../../../lib/teact/teact';

import type { ApiInputRichMessage } from '../../../../api/types';
import type { RichEditor, RichEditorRoot, RichEditorSuggestion } from '../richEditorTypes';

import { Bundles, loadBundle } from '../../../../util/moduleLoader';
import setEditorContentWithoutHistory from '../../../../util/tiptap/setEditorContentWithoutHistory';
import {
  buildRichMessageFromTiptapJson,
  buildTiptapJsonFromRichMessage,
  getRichInputAsFormatted,
} from '../../../ui/textInput/richText';
import {
  deleteEditorCharacterBeforeSelection,
  getEditorTextBeforeSelection,
  hasEditorCollapsedSelection,
  insertEditorContent,
  replaceEditorRange,
  replaceEditorTextBeforeSelection,
} from '../helpers/richEditorComposer';

import useLastCallback from '../../../../hooks/useLastCallback';

const EMPTY_RICH_MESSAGE: ApiInputRichMessage = { blocks: [] };

type EditorBundle = {
  getRichEditorCanRedo: (editor: Editor) => boolean;
  getRichEditorCanUndo: (editor: Editor) => boolean;
};

export default function useRichEditor() {
  const valueRef = useRef(EMPTY_RICH_MESSAGE);
  const editorRef = useRef<Editor>();
  const editorBundleRef = useRef<EditorBundle>();
  const isEditorEmptyRef = useRef<(editor: Editor) => boolean>();
  const rootRef = useRef<RichEditorRoot>();
  const [currentValue, setCurrentValue] = useState(EMPTY_RICH_MESSAGE);
  const [root, setRoot] = useState<RichEditorRoot | undefined>();
  const [isReady, setIsReady] = useState(false);
  const [mentionSuggestion, setMentionSuggestion] = useState<RichEditorSuggestion | undefined>();
  const canUndo = Boolean(editorRef.current && editorBundleRef.current?.getRichEditorCanUndo(editorRef.current));
  const canRedo = Boolean(editorRef.current && editorBundleRef.current?.getRichEditorCanRedo(editorRef.current));

  valueRef.current = currentValue;

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
      setMentionSuggestion(undefined);
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
        blockPlaceholder: currentRoot.blockPlaceholder,
        pullquotePlaceholder: currentRoot.pullquotePlaceholder,
        quoteCaptionPlaceholder: currentRoot.quoteCaptionPlaceholder,
        tableTitlePlaceholder: currentRoot.tableTitlePlaceholder,
        unsupportedPlaceholder: currentRoot.unsupportedPlaceholder,
        getIsRichInputExpanded: currentRoot.getIsRichInputExpanded,
        onUpdate: (updatedEditor) => {
          const richMessage = buildRichMessageFromTiptapJson(updatedEditor.getJSON());
          valueRef.current = richMessage;
          setCurrentValue(richMessage);
          currentRoot.onUpdate(isRichEditorEmpty(updatedEditor), updatedEditor.view.dom);
        },
        onDateClick: currentRoot.onDateClick,
        onMentionSuggestionChange: setMentionSuggestion,
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
      setMentionSuggestion(undefined);
      setIsReady(false);
    };
  }, [root]);

  return useMemo<RichEditor>(() => ({
    editor: editorRef.current,
    isReady,
    value: currentValue,
    mentionSuggestion,
    canUndo,
    canRedo,
    deleteCharacterBeforeSelection: () => deleteEditorCharacterBeforeSelection(editorRef.current),
    focus: () => {
      editorRef.current?.commands.focus();
    },
    getAsFormatted: () => {
      const valueToFormat = editorRef.current
        ? buildRichMessageFromTiptapJson(editorRef.current.getJSON())
        : valueRef.current;

      return getRichInputAsFormatted(valueToFormat);
    },
    getTextBeforeSelection: () => getEditorTextBeforeSelection(editorRef.current),
    getValue: () => {
      if (editorRef.current) {
        return buildRichMessageFromTiptapJson(editorRef.current.getJSON());
      }

      return valueRef.current;
    },
    hasCollapsedSelection: () => hasEditorCollapsedSelection(editorRef.current),
    isEmpty: () => {
      const editor = editorRef.current;
      if (!editor) {
        return !valueRef.current.blocks.length;
      }

      return isEditorEmptyRef.current ? isEditorEmptyRef.current(editor) : !valueRef.current.blocks.length;
    },
    insertContent: (content, shouldPrepend) => insertEditorContent(editorRef.current, content, shouldPrepend),
    redo: () => {
      editorRef.current?.chain().focus().redo().run();
    },
    replaceValue: (nextValue) => {
      valueRef.current = nextValue;
      setCurrentValue(nextValue);
      editorRef.current?.chain()
        .setContent(buildTiptapJsonFromRichMessage(nextValue), { emitUpdate: false })
        .focus('end')
        .run();
    },
    replaceTextBeforeSelection: (textToReplace, content) => {
      replaceEditorTextBeforeSelection(editorRef.current, textToReplace, content);
    },
    replaceRange: (range, content) => {
      replaceEditorRange(editorRef.current, range, content);
    },
    registerRoot,
    setValue: (nextValue) => {
      const valueToSet = nextValue || EMPTY_RICH_MESSAGE;
      valueRef.current = valueToSet;
      setCurrentValue(valueToSet);
      if (editorRef.current) {
        setEditorContentWithoutHistory(editorRef.current, buildTiptapJsonFromRichMessage(valueToSet));
      }
    },
    undo: () => {
      editorRef.current?.chain().focus().undo().run();
    },
  }), [canRedo, canUndo, currentValue, isReady, mentionSuggestion, registerRoot]);
}
