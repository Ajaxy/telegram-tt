import type { StateHookSetter } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';

import type { ApiAttachment, ApiFormattedText, ApiMessage } from '../../../../api/types';
import { ApiMessageEntityTypes } from '../../../../api/types';

import buildAttachment from '../helpers/buildAttachment';
import { EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID } from '../../../../config';
import getFilesFromDataTransferItems from '../helpers/getFilesFromDataTransferItems';
import parseMessageInput, { ENTITY_CLASS_BY_NODE_NAME } from '../../../../util/parseMessageInput';
import { containsCustomEmoji, stripCustomEmoji } from '../../../../global/helpers/symbols';

const MAX_MESSAGE_LENGTH = 4096;

const STYLE_TAG_REGEX = /<style>(.*?)<\/style>/gs;

function preparePastedHtml(html: string) {
  let fragment = document.createElement('div');
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
      if (input && ![EDITABLE_INPUT_ID, EDITABLE_INPUT_MODAL_ID].includes(input.id)) {
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

      if (files?.length && !editedMessage) {
        const newAttachments = await Promise.all(files.map((file) => {
          return buildAttachment(file.name, file);
        }));
        setAttachments((attachments) => attachments.concat(newAttachments));
      }

      const textToPaste = pastedFormattedText?.entities?.length ? pastedFormattedText : { text: pastedText };

      if (textToPaste) {
        insertTextAndUpdateCursor(textToPaste, input?.id);
      }
    }

    document.addEventListener('paste', handlePaste, false);

    return () => {
      document.removeEventListener('paste', handlePaste, false);
    };
  }, [
    insertTextAndUpdateCursor, editedMessage, setAttachments, isActive, shouldStripCustomEmoji, onCustomEmojiStripped,
  ]);
};

export default useClipboardPaste;
