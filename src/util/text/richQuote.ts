import type { ApiPageBlock, ApiRichText } from '../../api/types';

export const MAX_RICH_QUOTE_FRAGMENTS = 32;

export type RichQuoteRange = { first: number; last: number };

// Prefers the occurrence at `quoteOffset`, falling back to the first one
export function findQuoteStart(source: string, quote: string, quoteOffset?: number) {
  const offsetIndex = source.indexOf(quote, quoteOffset);
  return offsetIndex >= 0 ? offsetIndex : source.indexOf(quote);
}

export function findRichQuoteRange(
  texts: ApiRichText[], quote: string, quoteOffset?: number,
): RichQuoteRange | undefined {
  const parts = texts.map(getRichQuoteText);
  const start = findQuoteStart(parts.join('\n'), quote, quoteOffset);
  if (start < 0) return undefined;

  const end = start + quote.length;
  let first: number | undefined;
  let last = 0;
  let offset = 0;
  parts.forEach((part, index) => {
    if (start < offset + part.length && end > offset) {
      first ??= index;
      last = index;
    }
    offset += part.length + 1;
  });
  return first !== undefined ? { first, last } : undefined;
}

export function getRichQuoteTexts(blocks: ApiPageBlock[]): ApiRichText[] {
  const texts: ApiRichText[] = [];
  blocks.forEach((block) => appendBlockQuoteTexts(block, texts));
  return texts.filter((text) => getRichQuoteText(text).length > 0);
}

export function getRichQuoteText(text: ApiRichText): string {
  switch (text.type) {
    case 'empty':
    case 'image':
      return '';
    case 'plain':
      return text.text;
    case 'math':
      return text.source;
    case 'customEmoji':
      return text.alt;
    case 'concat':
      return text.texts.map(getRichQuoteText).join('');
    default:
      return getRichQuoteText(text.text);
  }
}

// Partially covered atoms stay whole unless `shouldDropPartialAtoms` is set
export function sliceRichQuoteText(
  text: ApiRichText, start: number, end: number, shouldDropPartialAtoms?: boolean,
): ApiRichText {
  const length = getRichQuoteText(text).length;
  if (start <= 0 && end >= length) return text;
  if (start >= length || end <= 0 || end <= start) return { type: 'empty' };

  switch (text.type) {
    case 'plain':
      return { ...text, text: text.text.slice(Math.max(0, start), end) };
    case 'concat': {
      let offset = 0;
      const texts = text.texts.map((part) => {
        const result = sliceRichQuoteText(part, start - offset, end - offset, shouldDropPartialAtoms);
        offset += getRichQuoteText(part).length;
        return result;
      }).filter((part) => part.type !== 'empty');
      return texts.length ? { ...text, texts } : { type: 'empty' };
    }
    case 'empty':
    case 'image':
      return text;
    case 'math':
    case 'customEmoji':
      return shouldDropPartialAtoms ? { type: 'empty' } : text;
    default:
      return { ...text, text: sliceRichQuoteText(text.text, start, end, shouldDropPartialAtoms) };
  }
}

// Server rejects buttons and images inside quotes, so buttons keep only their labels
export function sanitizeRichQuoteText(text: ApiRichText): ApiRichText {
  switch (text.type) {
    case 'empty':
    case 'plain':
    case 'math':
    case 'customEmoji':
      return text;
    case 'image':
      return { type: 'empty' };
    case 'button':
      return sanitizeRichQuoteText(text.text);
    case 'concat': {
      const texts = text.texts.map(sanitizeRichQuoteText).filter((part) => part.type !== 'empty');
      return texts.length ? { ...text, texts } : { type: 'empty' };
    }
    default: {
      const nestedText = sanitizeRichQuoteText(text.text);
      return nestedText.type === 'empty' ? nestedText : { ...text, text: nestedText };
    }
  }
}

export function truncateRichQuote(texts: ApiRichText[], maxLength: number) {
  const result: ApiRichText[] = [];
  let length = 0;
  for (const text of texts) {
    const characters = Array.from(getRichQuoteText(text));
    const remaining = maxLength - length;
    if (characters.length > remaining) {
      // The cut drops an atom it crosses, keeping the text before it
      result.push(sliceRichQuoteText(text, 0, characters.slice(0, remaining).join('').length, true));
      break;
    }
    result.push(text);
    length += characters.length;
  }
  return result.filter((text) => getRichQuoteText(text).length > 0);
}

export function normalizeRichQuote(text: ApiRichText): ApiRichText {
  switch (text.type) {
    case 'empty':
    case 'plain':
    case 'math':
    case 'customEmoji':
      return text;
    case 'image':
      return { type: 'empty' };
    case 'concat':
      return { ...text, texts: text.texts.map(normalizeRichQuote) };
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'spoiler':
    case 'subscript':
    case 'superscript':
    case 'date':
      return { ...text, text: normalizeRichQuote(text.text) };
    default:
      return normalizeRichQuote(text.text);
  }
}

function appendBlockQuoteTexts(block: ApiPageBlock, texts: ApiRichText[]) {
  switch (block.type) {
    case 'paragraph':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
    case 'footer':
    case 'thinking':
    case 'preformatted':
      texts.push(block.text);
      break;
    case 'math':
      texts.push(block);
      break;
    case 'blockquote':
    case 'pullquote':
      texts.push(block.text, block.caption);
      break;
    case 'blockquoteBlocks':
      block.blocks.forEach((nested) => appendBlockQuoteTexts(nested, texts));
      texts.push(block.caption);
      break;
    case 'list':
    case 'orderedList':
      block.items.forEach((item) => {
        if (item.type === 'text') texts.push(item.text);
        else item.blocks.forEach((nested) => appendBlockQuoteTexts(nested, texts));
      });
      break;
    case 'table':
      texts.push(block.title);
      block.rows.forEach((row) => row.cells.forEach((cell) => {
        if (cell.text) texts.push(cell.text);
      }));
      break;
    case 'details':
      texts.push(block.title);
      block.blocks.forEach((nested) => appendBlockQuoteTexts(nested, texts));
      break;
    case 'collage':
    case 'slideshow':
      block.items.forEach((nested) => appendBlockQuoteTexts(nested, texts));
      texts.push(block.caption.text, block.caption.credit);
      break;
    case 'photo':
    case 'video':
    case 'audio':
    case 'map':
      texts.push(block.caption.text, block.caption.credit);
      break;
  }
}
