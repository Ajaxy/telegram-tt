import type {
  ApiInputRichMessage,
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
  ApiPageCaption,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiRichMessage,
  ApiRichText,
} from '../../api/types';

import { getTranslationFn } from '../../util/localization';
import { getUtf8Length } from '../../util/textFormat';

const PREVIEW_OVERFLOW_LENGTH = 1;
const BLOCK_TEXT_SEPARATOR = '\n';
const INLINE_TEXT_SEPARATOR = '';

export interface RichMessageUsage {
  textLength: number;
  blockCount: number;
  maxDepth: number;
  mediaCount: number;
  maxTableColumnCount: number;
}

export function getRichMessagePreviewText(richMessage: ApiRichMessage, maxLength?: number) {
  const parts: string[] = [];
  const maxPreviewLength = maxLength ? maxLength + PREVIEW_OVERFLOW_LENGTH : undefined;

  appendPageBlocksPreviewText(richMessage.blocks, parts, maxPreviewLength);

  return parts.join(INLINE_TEXT_SEPARATOR).trim();
}

export function getRichMessageUsage(richMessage: ApiInputRichMessage | ApiRichMessage): RichMessageUsage {
  const usage: RichMessageUsage = {
    textLength: 0,
    blockCount: 0,
    maxDepth: 0,
    mediaCount: 0,
    maxTableColumnCount: 0,
  };

  appendCountedPageBlocksUsage(richMessage.blocks, 0, usage);

  return usage;
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

function appendCountedPageBlocksUsage(blocks: ApiPageBlock[], depth: number, usage: RichMessageUsage) {
  usage.blockCount += blocks.length;
  appendPageBlocksUsage(blocks, depth, usage);
}

function appendPageBlocksUsage(blocks: ApiPageBlock[], depth: number, usage: RichMessageUsage) {
  blocks.forEach((block) => appendPageBlockUsage(block, depth, usage));
}

function appendPageBlockUsage(block: ApiPageBlock, depth: number, usage: RichMessageUsage) {
  usage.maxDepth = Math.max(usage.maxDepth, depth);

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
      appendRichTextUsage(block.text, depth + 1, usage);
      break;
    case 'authorDate':
      appendRichTextUsage(block.author, depth + 1, usage);
      break;
    case 'list':
    case 'orderedList':
      usage.blockCount += block.items.length;
      block.items.forEach((item) => {
        if (item.type === 'text') {
          appendRichTextUsage(item.text, depth + 1, usage);
        } else {
          appendCountedPageBlocksUsage(item.blocks, depth + 1, usage);
        }
      });
      break;
    case 'blockquote':
    case 'pullquote':
      appendRichTextUsage(block.text, depth + 1, usage);
      appendRichTextUsage(block.caption, depth + 1, usage);
      break;
    case 'blockquoteBlocks':
      appendRichTextUsage(block.caption, depth + 1, usage);
      appendCountedPageBlocksUsage(block.blocks, depth + 1, usage);
      break;
    case 'photo':
    case 'video':
      usage.mediaCount++;
      appendPageCaptionUsage(block.caption, depth + 1, usage);
      break;
    case 'cover':
      appendPageBlockUsage(block.cover, depth + 1, usage);
      break;
    case 'embed':
      appendPageCaptionUsage(block.caption, depth + 1, usage);
      break;
    case 'embedPost':
      appendPageBlocksUsage(block.blocks, depth + 1, usage);
      appendPageCaptionUsage(block.caption, depth + 1, usage);
      break;
    case 'collage':
    case 'slideshow':
      appendPageBlocksUsage(block.items, depth + 1, usage);
      appendPageCaptionUsage(block.caption, depth + 1, usage);
      break;
    case 'audio':
      usage.mediaCount++;
      appendPageCaptionUsage(block.caption, depth + 1, usage);
      break;
    case 'table':
      appendPageTableUsage(block, depth, usage);
      break;
    case 'details':
      appendRichTextUsage(block.title, depth + 1, usage);
      appendCountedPageBlocksUsage(block.blocks, depth + 1, usage);
      break;
    case 'relatedArticles':
      appendRichTextUsage(block.title, depth + 1, usage);
      break;
    case 'map':
      appendPageCaptionUsage(block.caption, depth + 1, usage);
      break;
    case 'math':
      usage.textLength += getUtf8Length(block.source);
      break;
    case 'unsupported':
    case 'divider':
    case 'anchor':
    case 'channel':
      break;
  }
}

function appendPageCaptionUsage(caption: ApiPageCaption, depth: number, usage: RichMessageUsage) {
  appendRichTextUsage(caption.text, depth, usage);
  appendRichTextUsage(caption.credit, depth, usage);
}

function appendPageTableUsage(block: ApiPageBlockTable, depth: number, usage: RichMessageUsage) {
  appendRichTextUsage(block.title, depth + 1, usage);
  usage.blockCount += block.rows.length;

  block.rows.forEach((row) => {
    const columnCount = row.cells.reduce((count, cell) => count + (cell.colspan || 1), 0);
    usage.maxTableColumnCount = Math.max(usage.maxTableColumnCount, columnCount);
    row.cells.forEach((cell) => {
      if (cell.text) {
        appendRichTextUsage(cell.text, depth + 1, usage);
      }
    });
  });
}

function appendRichTextUsage(text: ApiRichText, depth: number, usage: RichMessageUsage) {
  usage.maxDepth = Math.max(usage.maxDepth, depth);

  switch (text.type) {
    case 'empty':
    case 'image':
      break;
    case 'plain':
      usage.textLength += getUtf8Length(text.text);
      break;
    case 'customEmoji':
      usage.textLength += getUtf8Length(text.alt);
      break;
    case 'math':
      usage.textLength += getUtf8Length(text.source);
      break;
    case 'concat':
      text.texts.forEach((part) => appendRichTextUsage(part, depth + 1, usage));
      break;
    default:
      appendRichTextUsage(getNestedRichText(text), depth + 1, usage);
      break;
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
