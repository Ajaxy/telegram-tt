import type {
  ApiPageBlock,
  ApiPageBlockBlockquote,
  ApiPageBlockBlockquoteBlocks,
  ApiPageBlockCollage,
  ApiPageBlockDetails,
  ApiPageBlockEmbedPost,
  ApiPageBlockMap,
  ApiPageBlockPhoto,
  ApiPageBlockPullquote,
  ApiPageBlockSlideshow,
  ApiPageBlockTable,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiRichMessage,
  ApiRichText,
} from '../../api/types';

import { getTranslationFn } from '../../util/localization';

const PREVIEW_OVERFLOW_LENGTH = 1;
const BLOCK_TEXT_SEPARATOR = '\n';
const INLINE_TEXT_SEPARATOR = '';

export function getRichMessagePreviewText(richMessage: ApiRichMessage, maxLength?: number) {
  const parts: string[] = [];
  const maxPreviewLength = maxLength ? maxLength + PREVIEW_OVERFLOW_LENGTH : undefined;

  appendPageBlocksPreviewText(richMessage.blocks, parts, maxPreviewLength);

  return parts.join(INLINE_TEXT_SEPARATOR).trim();
}

export function hasRichText(text: ApiRichText): boolean {
  switch (text.type) {
    case 'empty':
      return false;
    case 'plain':
      return Boolean(text.text);
    case 'concat':
      return text.texts.some(hasRichText);
    case 'image':
    case 'math':
    case 'customEmoji':
      return true;
    default:
      return hasRichText(getNestedRichText(text));
  }
}

export function getRichTextPlainText(text: ApiRichText): string {
  switch (text.type) {
    case 'empty':
      return '';
    case 'plain':
      return text.text;
    case 'concat':
      return text.texts.map(getRichTextPlainText).join(INLINE_TEXT_SEPARATOR);
    case 'math':
      return getMathPreviewText();
    case 'customEmoji':
      return text.alt;
    case 'image':
      return '';
    default:
      return getRichTextPlainText(getNestedRichText(text));
  }
}

export function getNestedRichText(text: ApiRichText): ApiRichText {
  switch (text.type) {
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'fixed':
    case 'url':
    case 'email':
    case 'subscript':
    case 'superscript':
    case 'marked':
    case 'phone':
    case 'anchor':
    case 'spoiler':
    case 'mention':
    case 'hashtag':
    case 'botCommand':
    case 'cashtag':
    case 'autoUrl':
    case 'autoEmail':
    case 'autoPhone':
    case 'bankCard':
    case 'mentionName':
    case 'date':
      return text.text;
    default:
      return { type: 'empty' };
  }
}

function appendPageBlocksPreviewText(blocks: ApiPageBlock[], parts: string[], maxLength?: number) {
  let remainingLength = maxLength;

  for (let i = 0; i < blocks.length; i++) {
    remainingLength = appendPageBlockPreviewText(blocks[i], parts, remainingLength);
    if (remainingLength === 0) {
      break;
    }
  }

  return remainingLength;
}

function appendPageBlockPreviewText(block: ApiPageBlock, parts: string[], maxLength?: number) {
  switch (block.type) {
    case 'title':
    case 'subtitle':
    case 'header':
    case 'subheader':
    case 'paragraph':
    case 'preformatted':
    case 'footer':
    case 'kicker':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
    case 'thinking':
      return appendBlockText(parts, getRichTextPlainText(block.text), maxLength);
    case 'authorDate':
      return appendBlockText(parts, getRichTextPlainText(block.author), maxLength);
    case 'list':
      return appendPageListItemsPreviewText(block.items, parts, maxLength);
    case 'orderedList':
      return appendPageOrderedListItemsPreviewText(block.items, parts, maxLength);
    case 'blockquote':
    case 'pullquote':
      return appendPageQuotePreviewText(block, parts, maxLength);
    case 'blockquoteBlocks':
      return appendPageBlockquoteBlocksPreviewText(block, parts, maxLength);
    case 'cover':
      return appendPageBlockPreviewText(block.cover, parts, maxLength);
    case 'details':
      return appendPageDetailsPreviewText(block, parts, maxLength);
    case 'table':
      return appendPageTablePreviewText(block, parts, maxLength);
    case 'photo':
    case 'video':
      return appendPageCaptionPreviewText(block.caption, parts, maxLength);
    case 'math':
      return appendBlockText(parts, getMathPreviewText(), maxLength);
    case 'embed':
      return appendPageCaptionPreviewText(block.caption, parts, maxLength);
    case 'embedPost':
      return appendPageEmbedPostPreviewText(block, parts, maxLength);
    case 'collage':
    case 'slideshow':
      return appendPageMediaGroupPreviewText(block, parts, maxLength);
    case 'map':
      return appendPageMapPreviewText(block, parts, maxLength);
    case 'unsupported':
    case 'divider':
    case 'anchor':
    case 'channel':
    case 'audio':
    case 'relatedArticles':
      return maxLength;
  }
}

function appendPageListItemsPreviewText(items: ApiPageListItem[], parts: string[], maxLength?: number) {
  let remainingLength = maxLength;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    remainingLength = item.type === 'text'
      ? appendBlockText(parts, getRichTextPlainText(item.text), remainingLength)
      : appendPageBlocksPreviewText(item.blocks, parts, remainingLength);

    if (remainingLength === 0) {
      break;
    }
  }

  return remainingLength;
}

function appendPageOrderedListItemsPreviewText(items: ApiPageListOrderedItem[], parts: string[], maxLength?: number) {
  let remainingLength = maxLength;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    remainingLength = item.type === 'text'
      ? appendBlockText(parts, getRichTextPlainText(item.text), remainingLength)
      : appendPageBlocksPreviewText(item.blocks, parts, remainingLength);

    if (remainingLength === 0) {
      break;
    }
  }

  return remainingLength;
}

function appendPageQuotePreviewText(
  block: ApiPageBlockBlockquote | ApiPageBlockPullquote,
  parts: string[],
  maxLength?: number,
) {
  const remainingLength = appendBlockText(parts, getRichTextPlainText(block.text), maxLength);

  return appendBlockText(parts, getRichTextPlainText(block.caption), remainingLength);
}

function appendPageBlockquoteBlocksPreviewText(
  block: ApiPageBlockBlockquoteBlocks,
  parts: string[],
  maxLength?: number,
) {
  const remainingLength = appendPageBlocksPreviewText(block.blocks, parts, maxLength);

  return appendBlockText(parts, getRichTextPlainText(block.caption), remainingLength);
}

function appendPageDetailsPreviewText(
  block: ApiPageBlockDetails,
  parts: string[],
  maxLength?: number,
) {
  const remainingLength = appendBlockText(parts, getRichTextPlainText(block.title), maxLength);

  if (remainingLength === 0) {
    return remainingLength;
  }

  return appendPageBlocksPreviewText(block.blocks, parts, remainingLength);
}

function appendPageCaptionPreviewText(
  caption: ApiPageBlockPhoto['caption'],
  parts: string[],
  maxLength?: number,
) {
  const remainingLength = appendBlockText(parts, getRichTextPlainText(caption.text), maxLength);

  return appendBlockText(parts, getRichTextPlainText(caption.credit), remainingLength);
}

function appendPageEmbedPostPreviewText(
  block: ApiPageBlockEmbedPost,
  parts: string[],
  maxLength?: number,
) {
  let remainingLength = appendPageBlocksPreviewText(block.blocks, parts, maxLength);
  if (remainingLength === 0) {
    return remainingLength;
  }

  remainingLength = appendBlockText(parts, block.author, remainingLength);

  return appendPageCaptionPreviewText(block.caption, parts, remainingLength);
}

function appendPageMediaGroupPreviewText(
  block: ApiPageBlockCollage | ApiPageBlockSlideshow,
  parts: string[],
  maxLength?: number,
) {
  const remainingLength = appendPageBlocksPreviewText(block.items, parts, maxLength);
  if (remainingLength === 0) {
    return remainingLength;
  }

  return appendPageCaptionPreviewText(block.caption, parts, remainingLength);
}

function appendPageMapPreviewText(
  block: ApiPageBlockMap,
  parts: string[],
  maxLength?: number,
) {
  const remainingLength = appendBlockText(parts, getMapPreviewText(), maxLength);

  return appendPageCaptionPreviewText(block.caption, parts, remainingLength);
}

function appendPageTablePreviewText(
  block: ApiPageBlockTable,
  parts: string[],
  maxLength?: number,
) {
  let remainingLength = appendBlockText(parts, getRichTextPlainText(block.title), maxLength);

  for (let i = 0; i < block.rows.length; i++) {
    const row = block.rows[i];
    for (let j = 0; j < row.cells.length; j++) {
      const cellText = row.cells[j].text;
      if (!cellText) {
        continue;
      }

      remainingLength = appendBlockText(parts, getRichTextPlainText(cellText), remainingLength);
      if (remainingLength === 0) {
        return remainingLength;
      }
    }
  }

  return remainingLength;
}

function appendBlockText(parts: string[], text: string, maxLength?: number) {
  if (maxLength === 0) {
    return maxLength;
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    return maxLength;
  }

  let remainingLength = maxLength;
  if (parts.length) {
    remainingLength = appendTextPart(parts, BLOCK_TEXT_SEPARATOR, remainingLength);
    if (remainingLength === 0) {
      return remainingLength;
    }
  }

  return appendTextPart(parts, normalizedText, remainingLength);
}

function appendTextPart(parts: string[], text: string, maxLength?: number) {
  if (maxLength === undefined) {
    parts.push(text);
    return maxLength;
  }

  const textPart = text.slice(0, maxLength);
  if (textPart) {
    parts.push(textPart);
  }

  return Math.max(maxLength - textPart.length, 0);
}

function getMathPreviewText() {
  return getTranslationFn()('RichTextMathPreview');
}

function getMapPreviewText() {
  return getTranslationFn()('RichTextMapPreview');
}
