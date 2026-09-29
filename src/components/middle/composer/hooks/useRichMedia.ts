import {
  useEffect, useRef, useState, useUnmountCleanup,
} from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiAttachment,
  ApiChat,
  ApiOnProgress,
} from '../../../../api/types';
import type { ThreadId } from '../../../../types';
import type { RichEditorMediaItem } from '../../../../util/tiptap/richMedia';
import type { RichEditor, RichEditorMediaFilesHandler } from '../richEditorTypes';

import { SUPPORTED_AUDIO_CONTENT_TYPES, SUPPORTED_PHOTO_CONTENT_TYPES } from '../../../../config';
import { revokeAttachmentUrls } from '../../../../util/attachments';
import buildUploadingMedia from '../../../../util/buildUploadingMedia';
import { rafPromise } from '../../../../util/schedulers';
import {
  EMPTY_RICH_MEDIA_CAPTION,
  getRichMediaUpload,
  removeRichMediaUpload,
  RICH_MEDIA_CONTENT_TYPES,
  setRichMediaUpload,
  updateRichMediaUpload,
} from '../../../../util/tiptap/richMedia';
import { callApi, cancelApiProgress } from '../../../../api/gramjs';
import buildAttachment, {
  prepareAttachment,
  prepareAttachmentsToSend,
} from '../helpers/buildAttachment';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useStateRef } from '../../../../hooks/useStateRef';

type Params = {
  richEditor: RichEditor;
  chat?: ApiChat;
  chatId: string;
  threadId: ThreadId;
  fileSizeLimit: number;
  canSendPhotos: boolean;
  canSendVideos: boolean;
  canSendDocuments: boolean;
  canSendAudios: boolean;
  shouldSendInHighQuality?: boolean;
};

type RichMediaEditorContext = {
  chatId: string;
  threadId: ThreadId;
  richEditor: RichEditor;
};

const ignore = () => undefined;

export default function useRichMedia({
  richEditor,
  chat,
  chatId,
  threadId,
  fileSizeLimit,
  canSendPhotos,
  canSendVideos,
  canSendDocuments,
  canSendAudios,
  shouldSendInHighQuality,
}: Params) {
  const {
    changeRichMediaUploadBlocking,
    showNotification,
  } = getActions();

  const [preparationCount, setPreparationCount] = useState(0);
  const [editingUploadId, setEditingUploadId] = useState<string | undefined>();
  const editorContextRef = useStateRef<RichMediaEditorContext>({ chatId, threadId, richEditor });
  const isBlockingOwnedRef = useRef(false);
  const lang = useLang();

  const handleBeforeUnload = useLastCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  });

  const setIsBlocking = useLastCallback((isBlocking: boolean) => {
    if (isBlockingOwnedRef.current === isBlocking) return;

    isBlockingOwnedRef.current = isBlocking;
    changeRichMediaUploadBlocking({ delta: isBlocking ? 1 : -1 });
    if (isBlocking) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return;
    }

    window.removeEventListener('beforeunload', handleBeforeUnload);
  });

  const hasBlockingMedia = richEditor.hasUnresolvedMedia || preparationCount > 0;

  useEffect(() => {
    setIsBlocking(hasBlockingMedia);
  }, [hasBlockingMedia, setIsBlocking]);

  useUnmountCleanup(() => setIsBlocking(false));

  const startRichMediaUpload = useLastCallback((
    uploadId: string,
    initiatingContext: RichMediaEditorContext,
  ) => {
    if (!chat) return;

    const upload = getRichMediaUpload(uploadId);
    if (!upload) return;
    const activeChat = chat;
    const activeUpload = upload;

    activeUpload.cancel();
    let isCanceled = false;
    const onProgress: ApiOnProgress = (progress) => {
      if (!isCanceled) {
        updateRichMediaUpload(uploadId, { progress });
      }
    };
    const retry = () => startRichMediaUpload(uploadId, initiatingContext);
    updateRichMediaUpload(uploadId, {
      status: 'preparing',
      progress: 0,
      cancel: () => {
        isCanceled = true;
        cancelApiProgress(onProgress);
      },
      retry,
    });

    void prepareAndUpload();

    async function prepareAndUpload() {
      await rafPromise();
      if (isCanceled) return;

      let preparedAttachment: ApiAttachment;
      try {
        preparedAttachment = await prepareAttachment(activeUpload.attachment);
      } catch {
        if (!isCanceled) {
          updateRichMediaUpload(uploadId, { status: 'failed', cancel: ignore });
        }
        return;
      }

      if (isCanceled) {
        revokeStaleRichMediaAttachment(uploadId, preparedAttachment);
        return;
      }

      const attachmentToSend = prepareAttachmentsToSend([preparedAttachment], true)[0];
      const uploadingMedia = buildUploadingMedia(attachmentToSend);
      const preview = uploadingMedia.photo || uploadingMedia.video || uploadingMedia.audio || uploadingMedia.document;
      if (!preview) {
        revokeAttachmentUrls(preparedAttachment, [activeUpload.attachment]);
        updateRichMediaUpload(uploadId, { status: 'failed', cancel: ignore });
        return;
      }

      updateRichMediaUpload(uploadId, {
        attachment: preparedAttachment,
        preview,
        status: 'pending',
        progress: 0,
      });

      try {
        const resolvedMedia = await callApi('uploadRichMedia', {
          chat: activeChat,
          attachment: attachmentToSend,
        }, onProgress);
        if (isCanceled) {
          revokeStaleRichMediaAttachment(uploadId, preparedAttachment);
          return;
        }
        if (!resolvedMedia) {
          updateRichMediaUpload(uploadId, { status: 'failed', cancel: ignore });
          return;
        }

        revokeAttachmentUrls(activeUpload.previousAttachment, [preparedAttachment]);
        updateRichMediaUpload(uploadId, {
          status: 'resolved',
          preview: resolvedMedia,
          progress: 1,
          cancel: ignore,
          cancelReplacement: undefined,
          previousAttachment: undefined,
        });
        getActiveRichEditor(editorContextRef.current, initiatingContext)?.resolveMedia(uploadId, resolvedMedia);
      } catch {
        if (!isCanceled) {
          updateRichMediaUpload(uploadId, { status: 'failed', cancel: ignore });
        }
      }
    }
  });

  const handleFiles = useLastCallback<RichEditorMediaFilesHandler>(async (
    files,
    position,
    shouldAppend,
    shouldSendAsFile,
  ) => {
    const acceptedFiles = files.filter((file) => (
      file.size <= fileSizeLimit
      && (SUPPORTED_AUDIO_CONTENT_TYPES.has(file.type) ? canSendAudios && !shouldAppend
        : shouldSendAsFile || !RICH_MEDIA_CONTENT_TYPES.has(file.type)
          ? canSendDocuments && !shouldAppend
          : SUPPORTED_PHOTO_CONTENT_TYPES.has(file.type) ? canSendPhotos : canSendVideos)
    ));
    let skippedCount = files.length - acceptedFiles.length;
    if (!chat || !acceptedFiles.length) {
      if (files.length) {
        showNotification({
          message: lang('RichMediaSkippedFiles', { count: files.length }, { pluralValue: files.length }),
        });
      }
      return;
    }

    const initiatingContext = editorContextRef.current;
    if (!initiatingContext.richEditor.editor) return;

    setIsBlocking(true);
    setPreparationCount((count) => count + acceptedFiles.length);

    let preparedItems: Array<RichEditorMediaItem | undefined> = [];
    let isInserted = false;
    try {
      preparedItems = await Promise.all(acceptedFiles.map(async (file): Promise<RichEditorMediaItem | undefined> => {
        let attachment: ApiAttachment | undefined;
        try {
          const isAudio = SUPPORTED_AUDIO_CONTENT_TYPES.has(file.type);
          const isDocument = !isAudio && (shouldSendAsFile || !RICH_MEDIA_CONTENT_TYPES.has(file.type));
          attachment = isDocument ? {
            blob: file,
            blobUrl: URL.createObjectURL(file),
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            uniqueId: `${Date.now()}-${Math.random()}`,
            shouldSendAsFile: true,
          } : await buildAttachment(file.name, file, { shouldSendInHighQuality });
          if (!isDocument && (attachment.shouldSendAsFile || !(isAudio ? attachment.audio : attachment.quick))) {
            revokeAttachmentUrls(attachment);
            return undefined;
          }

          const uploadingMedia = buildUploadingMedia(attachment);
          const preview = uploadingMedia.photo || uploadingMedia.video
            || uploadingMedia.audio || uploadingMedia.document;
          if (!preview) {
            revokeAttachmentUrls(attachment);
            return undefined;
          }

          const uploadId = attachment.uniqueId;
          const item: RichEditorMediaItem = {
            type: preview.mediaType,
            uploadId,
            caption: EMPTY_RICH_MEDIA_CAPTION,
          };
          setRichMediaUpload(uploadId, {
            attachment,
            preview,
            progress: 0,
            status: 'preparing',
            cancel: ignore,
            retry: () => startRichMediaUpload(uploadId, initiatingContext),
          });
          return item;
        } catch {
          revokeAttachmentUrls(attachment);
          return undefined;
        }
      }));

      const validItems = preparedItems.filter((item): item is RichEditorMediaItem => Boolean(item));
      skippedCount += preparedItems.length - validItems.length;
      const activeRichEditor = getActiveRichEditor(editorContextRef.current, initiatingContext);
      if (validItems.length && activeRichEditor) {
        const currentEditor = activeRichEditor.editor!;
        const currentDocumentSize = currentEditor.state.doc.content.size;
        const insertionPosition = position ?? currentEditor.state.selection.from;
        const safePosition = Math.min(Math.max(insertionPosition, 0), currentDocumentSize);
        isInserted = activeRichEditor.insertMedia(validItems, safePosition, shouldAppend);
        if (isInserted) {
          validItems.forEach(({ uploadId }) => startRichMediaUpload(uploadId!, initiatingContext));
        } else {
          skippedCount += validItems.length;
        }
      }

      if (skippedCount && activeRichEditor) {
        showNotification({
          message: lang('RichMediaSkippedFiles', { count: skippedCount }, { pluralValue: skippedCount }),
        });
      }
    } finally {
      if (!isInserted) {
        preparedItems.forEach((item) => removeRichMediaUpload(item?.uploadId));
      }
      setPreparationCount((count) => Math.max(count - acceptedFiles.length, 0));
    }
  });

  const handleEditMedia = useLastCallback((uploadId: string) => {
    const upload = getRichMediaUpload(uploadId);
    if (upload?.preview.mediaType === 'photo' && upload.attachment.blob && !upload.cancelReplacement) {
      setEditingUploadId(uploadId);
    }
  });

  const handleCloseMediaEditor = useLastCallback(() => {
    setEditingUploadId(undefined);
  });

  const handleSaveMediaEdit = useLastCallback(async (file: File) => {
    const uploadId = editingUploadId;
    const currentUpload = getRichMediaUpload(uploadId);
    const initiatingContext = editorContextRef.current;
    const initiatingRichEditor = getActiveRichEditor(editorContextRef.current, initiatingContext);
    if (!uploadId || !currentUpload || currentUpload.cancelReplacement || !initiatingRichEditor) return;

    currentUpload.cancel();
    let isCanceled = false;
    const cancelReplacement = () => {
      const replacementUpload = getRichMediaUpload(uploadId);
      replacementUpload?.cancel();
      revokeAttachmentUrls(replacementUpload?.attachment, [currentUpload.attachment]);
      setRichMediaUpload(uploadId, {
        ...currentUpload,
        cancel: ignore,
        status: currentUpload.status === 'resolved' ? 'resolved' : 'canceled',
      });
      const currentRichEditor = getActiveRichEditor(editorContextRef.current, initiatingContext);
      if (currentUpload.status === 'resolved') {
        currentRichEditor?.resolveMedia(uploadId, currentUpload.preview);
      } else {
        currentRichEditor?.resetMedia(uploadId);
        currentUpload.retry();
      }
    };
    updateRichMediaUpload(uploadId, {
      status: 'preparing',
      progress: 0,
      previousAttachment: currentUpload.attachment,
      cancelReplacement,
      cancel: () => {
        isCanceled = true;
      },
    });
    setIsBlocking(true);
    initiatingRichEditor.resetMedia(uploadId);

    let attachment: ApiAttachment | undefined;
    try {
      attachment = await buildAttachment(file.name, file, {
        shouldSendInHighQuality: currentUpload.attachment.shouldSendInHighQuality,
      });
      const uploadingMedia = buildUploadingMedia(attachment);
      const preview = uploadingMedia.photo;
      const activeRichEditor = getActiveRichEditor(editorContextRef.current, initiatingContext);
      if (isCanceled) {
        revokeStaleRichMediaAttachment(uploadId, attachment);
        return;
      }
      if (!preview || attachment.shouldSendAsFile || !activeRichEditor) {
        revokeAttachmentUrls(attachment, [currentUpload.attachment]);
        cancelReplacement();
        showNotification({ message: lang('RichMediaUploadFailed') });
        return;
      }

      const startUpload = () => startRichMediaUpload(uploadId, initiatingContext);
      updateRichMediaUpload(uploadId, {
        attachment,
        preview,
        status: 'preparing',
        progress: 0,
        retry: startUpload,
      });
      startUpload();
    } catch {
      if (!isCanceled) {
        revokeAttachmentUrls(attachment, [currentUpload.attachment]);
        cancelReplacement();
        showNotification({ message: lang('RichMediaUploadFailed') });
      } else {
        revokeStaleRichMediaAttachment(uploadId, attachment);
      }
    }
  });

  return {
    handleFiles,
    handleEditMedia,
    handleCloseMediaEditor,
    handleSaveMediaEdit,
    editingAttachment: getRichMediaUpload(editingUploadId)?.attachment,
    hasBlockingMedia,
  };
}

function getActiveRichEditor(current: RichMediaEditorContext, initiating: RichMediaEditorContext) {
  const editor = current.richEditor.editor;
  if (
    current.chatId !== initiating.chatId
    || current.threadId !== initiating.threadId
    || editor !== initiating.richEditor.editor
    || !editor
    || editor.isDestroyed
  ) {
    return undefined;
  }

  return current.richEditor;
}

function revokeStaleRichMediaAttachment(uploadId: string, attachment?: ApiAttachment) {
  const upload = getRichMediaUpload(uploadId);
  const retainedAttachments = [upload?.attachment, upload?.previousAttachment]
    .filter((retained): retained is ApiAttachment => Boolean(retained));
  revokeAttachmentUrls(attachment, retainedAttachments);
}
