import type { StateHookSetter } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';

import type { ApiAttachment, ApiFormattedText, ApiMessage } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import {
  DEBUG, EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID, EDITABLE_STORY_INPUT_ID,
} from '../../../../config';
import cleanDocsHtml from '../../../../lib/cleanDocsHtml';
import { containsCustomEmoji, stripCustomEmoji } from '../../../../global/helpers/symbols';
import parseMessageInput, { ENTITY_CLASS_BY_NODE_NAME } from '../../../../util/parseMessageInput';
import buildAttachment from '../helpers/buildAttachment';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';

const MAX_MESSAGE_LENGTH = 4096;

const STYLE_TAG_REGEX = /<style>(.*?)<\/style>/gs;
const TYPE_HTML = 'text/html';
const DOCUMENT_TYPE_WORD = 'urn:schemas-microsoft-com:office:word';
const NAMESPACE_PREFIX_WORD = 'xmlns:w';

function preparePastedHtml(html: string) {
  let fragment = document.createElement('div');
  try {
    html = cleanDocsHtml(html);
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
  fragment.innerHTML = html.replace(/\u00a0/g, ' ').replace(STYLE_TAG_REGEX, ''); // Strip &nbsp and styles

  const textContents = fragment.querySelectorAll<HTMLDivElement>('.text-content');
  if (textContents.length) {
    fragment = textContents[textContents.length - 1]; // Replace with the last copied message
  }

  Array.from(fragment.getElementsByTagName('*')).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.removeAttribute('style');

    // Fix newlines
    if (node.tagName === 'BR') node.replaceWith('\n');
    if (node.tagName === 'P') node.appendChild(document.createTextNode('\n'));
    if (node.tagName === 'IMG' && !node.dataset.entityType) node.replaceWith(node.getAttribute('alt') || '');
    // We do not intercept copy logic, so we remove some nodes here
    if (node.dataset.ignoreOnPaste) node.remove();

    if (ENTITY_CLASS_BY_NODE_NAME[node.tagName]) {
      node.setAttribute('data-entity-type', ENTITY_CLASS_BY_NODE_NAME[node.tagName]);
    }
    // Strip non-entity tags
    if (!node.dataset.entityType && node.textContent === node.innerText) node.replaceWith(node.textContent);
    // Append entity parameters for parsing
    if (node.dataset.alt) node.setAttribute('alt', node.dataset.alt);
    switch (node.dataset.entityType) {
      case ApiMessageEntityTypes.MentionName:
        node.replaceWith(node.textContent || '');
        break;
      case ApiMessageEntityTypes.CustomEmoji:
        node.textContent = node.dataset.alt || '';
        break;
    }
  });

  return fragment.innerHTML.trimEnd();
}

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

      let pastedFormattedText = html ? parseMessageInput(
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
