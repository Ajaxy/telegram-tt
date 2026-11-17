import { type ElementRef, useCallback, useEffect } from '../lib/teact/teact';

import type { ApiRichText } from '../api/types';
import type { TextSpan } from '../util/selection/textSelection';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { buildTextSelectionRanges, getTextSelectionNodes } from '../util/selection/textSelection';
import { findQuoteStart, getRichQuoteText } from '../util/text/richQuote';
import useLastCallback from './useLastCallback';

const SEARCH_HIGHLIGHT = 'text-search';
const QUOTE_HIGHLIGHT = 'message-quote';

type HighlightOptions = {
  text?: string;
  richTexts?: ApiRichText[];
  search?: string;
  quote?: string;
  quoteOffset?: number;
  quoteSelector?: string;
};

type QuoteTarget = Pick<HighlightOptions, 'quote' | 'quoteOffset' | 'quoteSelector'>;

export default function useTextHighlight(ref: ElementRef<HTMLElement>, {
  text, richTexts, search, quote, quoteOffset, quoteSelector,
}: HighlightOptions) {
  useEffect(() => {
    if ((!search && !quote && !quoteSelector) || typeof Highlight === 'undefined' || !CSS.highlights) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const name = quote || quoteSelector ? QUOTE_HIGHLIGHT : SEARCH_HIGHLIGHT;
    let ranges: Range[] = [];
    let isDisposed = false;
    let isUpdateScheduled = false;
    const observer = new MutationObserver(updateHighlight);
    observer.observe(root, { childList: true, characterData: true, subtree: true });
    updateHighlight();

    return () => {
      isDisposed = true;
      observer.disconnect();
      requestMutation(clearRanges);
    };

    function updateHighlight() {
      if (isUpdateScheduled) return;
      isUpdateScheduled = true;
      requestMeasure(() => {
        isUpdateScheduled = false;
        if (isDisposed) return;
        const nextRanges = buildHighlightRanges(root!, { text, richTexts, search, quote, quoteOffset, quoteSelector });
        requestMutation(() => {
          if (isDisposed) return;
          clearRanges();
          ranges = nextRanges;
          if (!ranges.length) return;
          const highlight = CSS.highlights.get(name) || new Highlight();
          ranges.forEach((range) => highlight.add(range));
          CSS.highlights.set(name, highlight);
        });
      });
    }

    function clearRanges() {
      const highlight = CSS.highlights.get(name);
      ranges.forEach((range) => highlight?.delete(range));
      if (highlight && !highlight.size) CSS.highlights.delete(name);
    }
  }, [ref, text, richTexts, search, quote, quoteOffset, quoteSelector]);

  // Covers the whole quote, so it can be scrolled into view even without highlight support
  const buildQuoteRange = useLastCallback((target: QuoteTarget) => {
    const root = ref.current;
    if (!root || (!target.quote && !target.quoteSelector)) return undefined;
    const ranges = buildHighlightRanges(root, { text, richTexts, ...target });
    if (!ranges.length) return undefined;

    const firstRange = ranges[0];
    const lastRange = ranges[ranges.length - 1];
    const range = document.createRange();
    range.setStart(firstRange.startContainer, firstRange.startOffset);
    range.setEnd(lastRange.endContainer, lastRange.endOffset);
    return range;
  });

  // Identity follows the quote target, so a new quote scrolls again while text updates do not
  return useCallback(
    () => buildQuoteRange({ quote, quoteOffset, quoteSelector }),
    [buildQuoteRange, quote, quoteOffset, quoteSelector],
  );
}

function buildHighlightRanges(root: HTMLElement, {
  text, richTexts, search, quote, quoteOffset, quoteSelector,
}: HighlightOptions) {
  if (quoteSelector) {
    const element = root.querySelector(quoteSelector);
    if (!element) return [];
    const range = document.createRange();
    range.selectNodeContents(element);
    return [range];
  }

  const parts = richTexts?.map(getRichQuoteText);
  const source = parts?.join('\n') ?? text ?? getTextSelectionNodes(root).map((node) => node.text).join('');
  const spans = findHighlightSpans(source, quote, search, quoteOffset);
  if (!spans.length) return [];
  if (!parts) return buildTextSelectionRanges(root, source, spans);

  const ranges: Range[] = [];
  let offset = 0;
  parts.forEach((part, index) => {
    const partEnd = offset + part.length;
    const partSpans = spans
      .filter(([start, end]) => start < partEnd && end > offset)
      .map(([start, end]): TextSpan => [start - offset, end - offset]);
    const element = partSpans.length ? root.querySelector(`[data-rich-quote-index="${index}"]`) : undefined;
    if (element) ranges.push(...buildTextSelectionRanges(element, part, partSpans));
    offset = partEnd + 1;
  });
  return ranges;
}

function findHighlightSpans(source: string, quote?: string, search?: string, quoteOffset?: number): TextSpan[] {
  if (quote) {
    const start = findQuoteStart(source, quote, quoteOffset);
    return start >= 0 ? [[start, start + quote.length]] : [];
  }

  const searchableText = source.toLowerCase();
  const query = search!.toLowerCase();
  const spans: TextSpan[] = [];
  let start = searchableText.indexOf(query);
  while (start >= 0) {
    spans.push([start, start + query.length]);
    start = searchableText.indexOf(query, start + query.length);
  }
  return spans;
}
