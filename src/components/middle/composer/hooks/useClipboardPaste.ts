import type { StateHookSetter } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';

import type { ApiAttachment, ApiFormattedText, ApiMessage } from '../../../../api/types';

import {
  EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID,
} from '../../../../config';
import { containsCustomEmoji, stripCustomEmoji } from '../../../../global/helpers/symbols';
import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';
import buildAttachment from '../helpers/buildAttachment';
import { preparePastedHtml } from '../helpers/cleanHtml';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

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
      const shouldSetAttachments = files?.length && !editedMessage && !isWordDocument;

      if (shouldSetAttachments) {
        const newAttachments = await Promise.all(files!.map((file) => {
          return buildAttachment(file.name, file);
        }));
        setAttachments((attachments) => attachments.concat(newAttachments));
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
    insertTextAndUpdateCursor, editedMessage, setAttachments, isActive, shouldStripCustomEmoji, onCustomEmojiStripped,
    setNextText,
  ]);
};

export default useClipboardPaste;
