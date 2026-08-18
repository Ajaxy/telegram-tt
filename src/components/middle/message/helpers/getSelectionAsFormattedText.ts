import type { ApiFormattedText } from '../../../../api/types';
import type { MessageListType, ThreadId } from '../../../../types';
import type { MessageCopyRequest } from '../../../../types/messageCopy';
import { ApiMessageEntityTypes } from '../../../../api/types';

import getMessageIdsForSelectedText from '../../../../util/getMessageIdsForSelectedText';
import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';

const selectionContainer = document.createElement('div');
const SEMANTIC_COPY_TAGS = new Set([
  'A', 'ASIDE', 'BLOCKQUOTE', 'CITE', 'CODE', 'DEL', 'DETAILS', 'EM', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'INS', 'LI', 'MARK', 'OL', 'P', 'PRE',
  'STRONG', 'SUB', 'SUMMARY', 'SUP', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'UL',
]);
const ALLOWED_QUOTE_ENTITIES = new Set([
  ApiMessageEntityTypes.Bold,
  ApiMessageEntityTypes.Italic,
  ApiMessageEntityTypes.Underline,
  ApiMessageEntityTypes.Strike,
  ApiMessageEntityTypes.Spoiler,
  ApiMessageEntityTypes.CustomEmoji,
]);

export function getSelectionAsFormattedText(range: Range) {
  const html = getSelectionAsHtml(range).replace(/<br\s*\/?>/gi, '\n');
  const formattedText = parseHtmlAsFormattedText(html, false, true);

  return stripEntitiesForQuote(formattedText);
}

export function captureMessageCopyRequest(
  chatId: string,
  threadId: ThreadId,
  messageListType: MessageListType,
): MessageCopyRequest | undefined {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return undefined;

  const range = selection.getRangeAt(0);
  const startMessageId = getNodeMessageId(range.startContainer);
  const endMessageId = getNodeMessageId(range.endContainer);
  if (!startMessageId || !endMessageId) return undefined;

  if (startMessageId === endMessageId) {
    return {
      type: 'selection',
      chatId,
      threadId,
      messageListType,
      messageId: startMessageId,
      html: getSelectionAsHtml(range),
    };
  }

  const messageIds = getMessageIdsForSelectedText(range);
  return messageIds?.length ? {
    type: 'messages',
    chatId,
    threadId,
    messageListType,
    messageIds,
    withSenderHeaders: true,
  } : undefined;
}

export function getSelectionAsHtml(range: Range) {
  const clonedSelection = range.cloneContents();
  selectionContainer.appendChild(clonedSelection);

  const html = wrapHtmlWithSemanticAncestors(range, selectionContainer.innerHTML);
  selectionContainer.innerHTML = '';

  return html
    .replace(/&nbsp;/gi, ' ') // Convert nbsp's to spaces
    .replace(/\u00a0/gi, ' ');
}

function stripEntitiesForQuote(text: ApiFormattedText): ApiFormattedText {
  if (!text.entities) return text;

  const entities = text.entities.filter((entity) => ALLOWED_QUOTE_ENTITIES.has(entity.type as ApiMessageEntityTypes));
  return { ...text, entities: entities.length ? entities : undefined };
}

function getNodeMessageId(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as HTMLElement : node.parentElement;
  const messageElement = element?.closest<HTMLElement>('.Message[data-message-id]');
  const rawMessageId = messageElement?.dataset.messageId;
  return rawMessageId !== undefined ? Number(rawMessageId) : undefined;
}

function wrapHtmlWithSemanticAncestors(range: Range, html: string) {
  const container = range.commonAncestorContainer;
  let currentElement = container.nodeType === Node.ELEMENT_NODE
    ? container as HTMLElement
    : container.parentElement;
  while (
    currentElement
    && !currentElement.classList.contains('text-content')
    && !currentElement.classList.contains('Message')
    && !currentElement.hasAttribute('data-rich-copy-root')
  ) {
    if (isSemanticCopyElement(currentElement)) {
      const wrapper = currentElement.cloneNode(false) as HTMLElement;
      wrapper.innerHTML = html;
      html = wrapper.outerHTML;
    }
    currentElement = currentElement.parentElement;
  }

  return html;
}

function isSemanticCopyElement(element: HTMLElement) {
  return SEMANTIC_COPY_TAGS.has(element.tagName)
    || element.hasAttribute('data-entity-type')
    || element.hasAttribute('data-rich-block-type')
    || element.hasAttribute('data-rich-text-type');
}
