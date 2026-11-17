import type { ApiRichMessage } from '../../../../api/types';

import { getTextSelectionNodes } from '../../../../util/selection/textSelection';
import {
  getRichQuoteText, getRichQuoteTexts, MAX_RICH_QUOTE_FRAGMENTS, sanitizeRichQuoteText, sliceRichQuoteText,
  truncateRichQuote,
} from '../../../../util/text/richQuote';

export function getSelectionAsRichQuote(
  range: Range, richMessage: ApiRichMessage, messageId: number, maxLength: number,
) {
  if (range.collapsed) return undefined;

  // Either endpoint may lie outside the rich content, e.g. in the message meta
  const root = findRichQuoteRoot(range.startContainer) || findRichQuoteRoot(range.endContainer)
    || findRichQuoteRoot(range.commonAncestorContainer);
  if (!root || root.closest<HTMLElement>('.Message')?.dataset.messageId !== String(messageId)) return undefined;

  const texts = getRichQuoteTexts(richMessage.blocks);
  let first: { index: number; start: number } | undefined;
  let last: { index: number; end: number } | undefined;
  root.querySelectorAll<HTMLElement>('[data-rich-quote-index]').forEach((node) => {
    if (!range.intersectsNode(node) || node.closest('details:not([open]) > :not(summary)')) return;
    const index = Number(node.dataset.richQuoteIndex);
    if (!texts[index]) return;
    const offsets = getSelectedOffsets(node, range);
    if (!offsets) return;
    if (!first || index < first.index) first = { index, start: offsets.start };
    if (!last || index >= last.index) last = { index, end: offsets.end };
  });
  if (!first || !last) return undefined;

  const { index: firstIndex, start } = first;
  const lastIndex = Math.min(last.index, firstIndex + MAX_RICH_QUOTE_FRAGMENTS - 1);
  const end = lastIndex === last.index ? last.end : getRichQuoteText(texts[lastIndex]).length;
  // Quotes cover a contiguous source span, including hidden text between the selected endpoints
  const fragments = texts.slice(firstIndex, lastIndex + 1).map((text, index) => {
    const fragmentEnd = index === lastIndex - firstIndex ? end : getRichQuoteText(text).length;
    return sanitizeRichQuoteText(sliceRichQuoteText(text, index === 0 ? start : 0, fragmentEnd));
  });
  const quoteRich = truncateRichQuote(fragments, maxLength);
  if (!quoteRich.length) return undefined;

  const quoteOffset = texts.slice(0, firstIndex).reduce((total, text) => total + getRichQuoteText(text).length + 1, 0)
    + start;
  return { quoteRich, quoteOffset };
}

function findRichQuoteRoot(node: Node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  return element?.closest('[data-rich-quote-root]') || undefined;
}

function getSelectedOffsets(root: HTMLElement, range: Range) {
  let offset = 0;
  let start: number | undefined;
  let end: number | undefined;
  getTextSelectionNodes(root).forEach(({ node, text, isAtomic }) => {
    if (text.length && range.intersectsNode(node)) {
      const selectedStart = !isAtomic && range.startContainer === node ? range.startOffset : 0;
      const selectedEnd = !isAtomic && range.endContainer === node ? range.endOffset : text.length;
      if (selectedEnd > selectedStart) {
        start ??= offset + selectedStart;
        end = offset + selectedEnd;
      }
    }
    offset += text.length;
  });
  return start !== undefined && end !== undefined && end > start ? { start, end } : undefined;
}
