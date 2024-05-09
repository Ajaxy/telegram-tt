import type { StateHookSetter } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiAttachment, ApiFormattedText, ApiMessage } from '../../../../api/types';

import {
  EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID,
} from '../../../../config';
import { canReplaceMessageMedia, isUploadingFileSticker } from '../../../../global/helpers';
import { containsCustomEmoji, stripCustomEmoji } from '../../../../global/helpers/symbols';
import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';
import buildAttachment from '../helpers/buildAttachment';
import { preparePastedHtml } from '../helpers/cleanHtml';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

import useLang from '../../../../hooks/useLang';

const MAX_MESSAGE_LENGTH = 4096;

const TYPE_HTML = 'text/html';
const DOCUMENT_TYPE_WORD = 'urn:schemas-microsoft-com:office:word';
const NAMESPACE_PREFIX_WORD = 'xmlns:w';

const useClipboardPaste = (
  isActive: boolean,
  insertTextAndUpdateCursor: (text: ApiFormattedText, inputId?: string) => void,
  setAttachments: StateHookSetter<ApiAttachment[]>,
  setNextText: StateHookSetter<ApiFormattedText | undefined>,
  editedMessage: ApiMessage | undefined,
  shouldStripCustomEmoji?: boolean,
  onCustomEmojiStripped?: VoidFunction,
) => {
  const { showNotification } = getActions();
  const lang = useLang();

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    async function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) {
        return;
      }

      const input = document.activeElement;
      if (input && ![EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID].includes(input.id)) {
        return;
      }

      const pastedText = e.clipboardData.getData('text').substring(0, MAX_MESSAGE_LENGTH);
      const html = e.clipboardData.getData('text/html');

      let pastedFormattedText = html ? parseHtmlAsFormattedText(
        preparePastedHtml(html), undefined, true,
      ) : undefined;

      if (pastedFormattedText && containsCustomEmoji(pastedFormattedText) && shouldStripCustomEmoji) {
        pastedFormattedText = stripCustomEmoji(pastedFormattedText);
        onCustomEmojiStripped?.();
      }

      const { items } = e.clipboardData;
      let files: File[] | undefined = [];

      e.preventDefault();
      if (items.length > 0) {
        files = await getFilesFromDataTransferItems(items);
        if (editedMessage) {
          files = files?.slice(0, 1);
        }
      }

      if (!files?.length && !pastedText) {
        return;
      }

      const textToPaste = pastedFormattedText?.entities?.length ? pastedFormattedText : { text: pastedText };

      let isWordDocument = false;
      try {
        const parser = new DOMParser();
        const parsedDocument = parser.parseFromString(html, TYPE_HTML);
        isWordDocument = parsedDocument.documentElement
          .getAttribute(NAMESPACE_PREFIX_WORD) === DOCUMENT_TYPE_WORD;
      } catch (err: any) {
        // Ignore
      }

      const hasText = textToPaste && textToPaste.text;
      let shouldSetAttachments = files?.length && !isWordDocument;

      const newAttachments = files ? await Promise.all(files.map((file) => buildAttachment(file.name, file))) : [];
      const canReplace = (editedMessage && newAttachments?.length
        && canReplaceMessageMedia(editedMessage, newAttachments[0])) || Boolean(hasText);
      const isUploadingDocumentSticker = isUploadingFileSticker(newAttachments[0]);
      const isInAlbum = editedMessage && editedMessage?.groupedId;

      if (editedMessage && isUploadingDocumentSticker) {
        showNotification({ message: lang(isInAlbum ? 'lng_edit_media_album_error' : 'lng_edit_media_invalid_file') });
        return;
      }

      if (isInAlbum) {
        shouldSetAttachments = canReplace;
        if (!shouldSetAttachments) {
          showNotification({ message: lang('lng_edit_media_album_error') });
          return;
        }
      }

      if (shouldSetAttachments) {
        setAttachments(editedMessage ? newAttachments : (attachments) => attachments.concat(newAttachments));
      }

      if (hasText) {
        if (shouldSetAttachments) {
          setNextText(textToPaste);
        } else {
          insertTextAndUpdateCursor(textToPaste, input?.id);
        }
      }
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [
    insertTextAndUpdateCursor, editedMessage, setAttachments, isActive, shouldStripCustomEmoji,
    onCustomEmojiStripped, setNextText, lang,
  ]);
};

export default useClipboardPaste;
