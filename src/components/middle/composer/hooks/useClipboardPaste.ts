import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiAttachment, ApiFormattedText, ApiMessage } from '../../../../api/types';
import type { RichEditorMediaFilesHandler } from '../richEditorTypes';

import {
  EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID,
} from '../../../../config';
import { canReplaceMessageMedia, isUploadingFileSticker } from '../../../../global/helpers';
import { revokeAttachmentUrls } from '../../../../util/attachments';
import buildAttachment from '../helpers/buildAttachment';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

import useLang from '../../../../hooks/useLang';

const VALID_TARGET_IDS = new Set([EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID]);
const CLOSEST_CONTENT_EDITABLE_SELECTOR = 'div[contenteditable]';

type ClipboardFilePasteTarget = 'attachmentModal' | 'richMedia' | 'none';

const useClipboardPaste = (
  isActive: boolean,
  insertTextAndUpdateCursor: (text: ApiFormattedText) => void,
  setAttachments: (attachments: ApiAttachment[] | ((current: ApiAttachment[]) => ApiAttachment[])) => void,
  editedMessage: ApiMessage | undefined,
  resolveFilePasteTarget: () => ClipboardFilePasteTarget,
  shouldUpdateAttachmentCompression?: boolean,
  shouldSkipFilePaste?: boolean,
  onRichMediaFiles?: RichEditorMediaFilesHandler,
  getRichMediaPosition?: () => number | undefined,
) => {
  const {
    showNotification,
    updateShouldSaveAttachmentsCompression,
    applyDefaultAttachmentsCompression } = getActions();
  const lang = useLang();

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    async function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const input = (e.target as HTMLElement)?.closest(CLOSEST_CONTENT_EDITABLE_SELECTOR);
      if (!input || !VALID_TARGET_IDS.has(input.id)) {
        return;
      }

      // Some extensions can trigger paste into their panels without focus
      if (document.activeElement !== input) {
        return;
      }

      const { items } = e.clipboardData;
      const hasFiles = Array.from(items).some((item) => item.kind === 'file');
      if (!hasFiles) {
        return;
      }

      const filePasteTarget = resolveFilePasteTarget();
      const richMediaPosition = filePasteTarget === 'richMedia' ? getRichMediaPosition?.() : undefined;
      e.preventDefault();
      if (filePasteTarget === 'none') {
        return;
      }

      let files = await getFilesFromDataTransferItems(items);
      if (!files?.length) {
        return;
      }

      if (filePasteTarget === 'richMedia') {
        onRichMediaFiles?.(files, richMediaPosition);
        return;
      }

      if (editedMessage) {
        files = files.slice(0, 1);
      }

      const pastedText = e.clipboardData.getData('text');
      const textToPaste: ApiFormattedText | undefined = pastedText ? { text: pastedText } : undefined;
      const hasText = textToPaste && textToPaste.text;
      let shouldSetAttachments = files?.length && !shouldSkipFilePaste;

      const newAttachments = files ? await Promise.all(files.map((file) => buildAttachment(file.name, file))) : [];
      const canReplace = (editedMessage && newAttachments?.length
        && canReplaceMessageMedia(editedMessage, newAttachments[0])) || Boolean(hasText);
      const isUploadingDocumentSticker = isUploadingFileSticker(newAttachments[0]);
      const isInAlbum = editedMessage && editedMessage?.groupedId;

      if (editedMessage && newAttachments?.length > 1) {
        newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment));
        showNotification({
          message: lang('MediaReplaceInvalidError', undefined, { pluralValue: newAttachments.length }),
        });
        return;
      }

      if (editedMessage && isUploadingDocumentSticker) {
        newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment));
        showNotification({ message: lang('MediaReplaceInvalidError', undefined, { pluralValue: 1 }) });
        return;
      }

      if (isInAlbum) {
        shouldSetAttachments = canReplace;
        if (!shouldSetAttachments) {
          newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment));
          showNotification({
            message: lang('MediaReplaceInvalidError', undefined, { pluralValue: newAttachments.length }),
          });
          return;
        }
      }

      if (shouldSetAttachments) {
        if (shouldUpdateAttachmentCompression) {
          updateShouldSaveAttachmentsCompression({ shouldSave: true });
          applyDefaultAttachmentsCompression();
        }
        setAttachments(editedMessage ? newAttachments : (attachments) => attachments.concat(newAttachments));
      } else {
        newAttachments.forEach((attachment) => revokeAttachmentUrls(attachment));
      }

      if (hasText) {
        insertTextAndUpdateCursor(textToPaste);
      }
    }

    document.addEventListener('paste', handlePaste, true);

    return () => {
      document.removeEventListener('paste', handlePaste, true);
    };
  }, [
    insertTextAndUpdateCursor, editedMessage, setAttachments, isActive,
    lang, resolveFilePasteTarget, shouldUpdateAttachmentCompression, shouldSkipFilePaste,
    onRichMediaFiles, getRichMediaPosition,
  ]);
};

export default useClipboardPaste;
