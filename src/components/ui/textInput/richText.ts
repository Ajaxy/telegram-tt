import type { JSONContent as TiptapJsonContent } from '@tiptap/core';

import type {
  ApiFormattedText,
  ApiInputRichMessage,
  ApiMessageEntity,
  ApiPageBlock,
  ApiPageCaption,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiPageTableCell,
  ApiRichText,
  ApiRichTextDate,
} from '../../../api/types';
import type { FormattedDateEntityOptions } from '../../../util/dates/formattedDate';
import { ApiMessageEntityTypes } from '../../../api/types';

import { getRichTextPlainText, hasRichText } from '../../../global/helpers/richMessage';
import {
  getDefaultFormattedDateText,
  hasFormattedDateFormat,
} from '../../../util/dates/formattedDate';
import { getTranslationFn } from '../../../util/localization';
import { formatDateTime } from '../../../util/localization/dateFormat';
import {
  BLOCKQUOTE_COLLAPSED_ATTR,
  CAPTION_NODE_NAME,
  EMOJI_NODE_NAME,
  FOOTER_NODE_NAME,
  MATH_BLOCK_NODE_NAME,
  MATH_INLINE_NODE_NAME,
  TABLE_CELL_HIGHLIGHT_ATTR,
  TABLE_TITLE_NODE_NAME,
  TABLE_WRAPPER_NODE_NAME,
  UNSUPPORTED_NODE_NAME,
} from '../../../util/tiptap/constants';

type InlineEntityType =
  ApiMessageEntityTypes.Bold
  | ApiMessageEntityTypes.Italic
  | ApiMessageEntityTypes.Underline
  | ApiMessageEntityTypes.Strike
  | ApiMessageEntityTypes.Code
  | ApiMessageEntityTypes.Spoiler;

type StructuralEntity = Extract<
  ApiMessageEntity,
  { type: ApiMessageEntityTypes.Pre | ApiMessageEntityTypes.Blockquote }
>;

type EntityNode = {
  entity: ApiMessageEntity;
  children: EntityNode[];
};

type TiptapMark = NonNullable<TiptapJsonContent['marks']>[number];
type HeadingBlockType = 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'heading5' | 'heading6';
type OrderedListBlock = Extract<ApiPageBlock, { type: 'orderedList' }>;
type RichInputFormatOptions = {
  isApproximate?: boolean;
};
type RichMessageToTiptapOptions = {
  isForCopy?: boolean;
};

const BLOCK_SEPARATOR = '\n';
const AUTHOR_DATE_SEPARATOR = ' \u00B7 ';
const TABLE_CELL_SEPARATOR = ' ';
const LIST_ITEM_INDENT = '  ';
const BULLET_LIST_PREFIX = '- ';
const UNCHECKED_LIST_PREFIX = '[ ] ';
const CHECKED_LIST_PREFIX = '[x] ';
const QUOTE_AUTHOR_PREFIX = '- ';
const DIVIDER_TEXT = '————';
const LATEX_CODE_LANGUAGE = 'latex';
const DEFAULT_STRING = '';
const EMPTY_RICH_TEXT: ApiRichText = { type: 'empty' };
const EMPTY_RICH_MESSAGE: ApiInputRichMessage = { blocks: [] };
const BULLET_LIST_CHECKLIST_ATTR = 'checklist';
const LIST_ITEM_CHECKBOX_ATTR = 'checkbox';
const LIST_ITEM_CHECKED_ATTR = 'checked';
const ORDERED_LIST_REVERSED_ATTR = 'reversed';
const ORDERED_LIST_TYPE_ATTR = 'type';
const DETAILS_SUMMARY_NODE_TYPE = 'detailsSummary';
const DETAILS_CONTENT_NODE_TYPE = 'detailsContent';
const DETAILS_OPEN_ATTR = 'open';
const TABLE_BORDERED_ATTR = 'isBordered';
const TABLE_STRIPED_ATTR = 'isStriped';
const TRAILING_ENTITY_WHITESPACE_RE = /\s/u;
const MILLISECONDS_PER_SECOND = 1000;
// Keep these values aligned with TDLib's `MessageEntity::get_type_priority`
// https://github.com/tdlib/td/blob/master/td/telegram/MessageEntity.cpp
const ENTITY_PRIORITY_BY_TYPE: Partial<Record<ApiMessageEntityTypes, number>> = {
  [ApiMessageEntityTypes.Blockquote]: 0,
  [ApiMessageEntityTypes.Code]: 20,
  [ApiMessageEntityTypes.FormattedDate]: 30,
  [ApiMessageEntityTypes.TextUrl]: 49,
  [ApiMessageEntityTypes.MentionName]: 49,
  [ApiMessageEntityTypes.Bold]: 90,
  [ApiMessageEntityTypes.Italic]: 91,
  [ApiMessageEntityTypes.Underline]: 92,
  [ApiMessageEntityTypes.Strike]: 93,
  [ApiMessageEntityTypes.Spoiler]: 94,
  [ApiMessageEntityTypes.CustomEmoji]: 99,
};

export function hasUnsupportedRichBlocks(value: ApiInputRichMessage) {
  return value.blocks.some(hasUnsupportedRichBlock);
}

export function removeUnsupportedRichBlocks(value: ApiInputRichMessage): ApiInputRichMessage {
  return {
    ...value,
    blocks: value.blocks.filter((block) => !hasUnsupportedRichBlock(block)),
  };
}

export function getRichInputAsFormatted(
  value: ApiInputRichMessage,
  options?: RichInputFormatOptions,
): ApiFormattedText | undefined {
  const isApproximate = Boolean(options?.isApproximate);
  const parts: ApiFormattedText[] = [];

  for (let i = 0; i < value.blocks.length; i++) {
    const part = getBlockAsFormatted(value.blocks[i], isApproximate);
    if (!part) {
      return undefined;
    }
    parts.push(part);
  }

  if (!parts.length) {
    return { text: '' };
  }

  const formatted = parts.reduce(
    (result, part, index) => appendFormattedText(result, part, index > 0),
    { text: '' },
  );
  const normalized = prepareTelegramEntities(formatted.text, formatted.entities);

  return normalized.isValid || isApproximate ? {
    text: formatted.text,
    entities: normalized.entities.length ? normalized.entities : undefined,
  } : undefined;
}

export function isValidInputRichMessage(value: ApiInputRichMessage) {
  return Boolean(value.blocks.length) && !hasUnsupportedRichBlocks(value);
}

export function buildRichMessageFromTiptapJson(doc: TiptapJsonContent): ApiInputRichMessage {
  return { blocks: buildBlocksFromTiptapContent(doc.content) };
}

export function buildTiptapJsonFromRichMessage(
  value?: ApiInputRichMessage,
  options?: RichMessageToTiptapOptions,
): TiptapJsonContent {
  const content = value?.blocks
    .flatMap((block) => buildTiptapNodesFromBlock(block, options));

  return {
    type: 'doc',
    content: content?.length ? content : [{ type: 'paragraph' }],
  };
}

export function buildRichMessageFromFormatted(value?: ApiFormattedText): ApiInputRichMessage {
  if (!value?.text) {
    return EMPTY_RICH_MESSAGE;
  }

  const { entities } = prepareTelegramEntities(value.text, value.entities);
  const structuralEntities = getOuterStructuralEntities(entities);
  if (!structuralEntities.length) {
    return {
      blocks: [{
        type: 'paragraph',
        text: buildRichTextFromFormatted(value.text, entities),
      }],
    };
  }

  return {
    blocks: buildBlocksFromFormattedRange(value.text, entities, 0, value.text.length, structuralEntities),
  };
}

function buildBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  switch (node.type) {
    case 'paragraph':
      return buildParagraphBlockFromTiptapNode(node);
    case 'heading':
      return buildHeadingBlockFromTiptapNode(node);
    case FOOTER_NODE_NAME:
      return buildFooterBlockFromTiptapNode(node);
    case 'blockquote':
      return buildBlockquoteBlockFromTiptapNode(node);
    case 'pullquote':
      return buildPullquoteBlockFromTiptapNode(node);
    case 'codeBlock':
      return {
        type: 'preformatted',
        text: { type: 'plain', text: buildPlainTextFromTiptapContent(node.content) },
        language: getTiptapStringAttr(node, 'language') || DEFAULT_STRING,
      };
    case 'horizontalRule':
      return { type: 'divider' };
    case 'bulletList':
      return buildListBlockFromTiptapNode(node);
    case 'orderedList':
      return buildOrderedListBlockFromTiptapNode(node);
    case TABLE_WRAPPER_NODE_NAME:
      return buildTableBlockFromTiptapNode(node);
    case 'details':
      return buildDetailsBlockFromTiptapNode(node);
    case MATH_BLOCK_NODE_NAME:
      return {
        type: 'math',
        source: getTiptapStringAttr(node, 'source') || DEFAULT_STRING,
      };
    case UNSUPPORTED_NODE_NAME:
      return { type: 'unsupported' };
    default:
      return node.content?.length ? { type: 'unsupported' } : undefined;
  }
}

function buildTiptapNodesFromBlock(
  block: ApiPageBlock,
  options?: RichMessageToTiptapOptions,
): TiptapJsonContent[] {
  switch (block.type) {
    case 'paragraph':
      return buildTiptapParagraphNodes(block.text);
    case 'title':
    case 'header':
    case 'heading1':
      return [buildTiptapHeadingNode(block.text, 1)];
    case 'subtitle':
    case 'subheader':
    case 'heading2':
      return [buildTiptapHeadingNode(block.text, 2)];
    case 'heading3':
      return [buildTiptapHeadingNode(block.text, 3)];
    case 'heading4':
      return [buildTiptapHeadingNode(block.text, 4)];
    case 'heading5':
      return [buildTiptapHeadingNode(block.text, 5)];
    case 'heading6':
      return [buildTiptapHeadingNode(block.text, 6)];
    case 'kicker':
    case 'thinking':
      return buildTiptapParagraphNodes(block.text);
    case 'authorDate':
      return buildTiptapParagraphNodes(buildAuthorDateRichText(block));
    case 'footer':
      return [{
        type: FOOTER_NODE_NAME,
        content: buildTiptapInlineContentFromRichText(block.text),
      }];
    case 'blockquote':
      return [{
        type: 'blockquote',
        attrs: {
          [BLOCKQUOTE_COLLAPSED_ATTR]: block.canCollapse,
        },
        content: buildTiptapQuoteContent([buildTiptapParagraphNode(block.text)], block.caption),
      }];
    case 'blockquoteBlocks':
      return [buildTiptapBlockquoteBlocksNode(block, options)];
    case 'pullquote':
      return [{
        type: 'pullquote',
        content: buildTiptapQuoteContent(buildTiptapParagraphNodes(block.text), block.caption),
      }];
    case 'preformatted':
      return [{
        type: 'codeBlock',
        attrs: { language: block.language || undefined },
        content: buildTiptapCodeBlockContent(getRichTextPlainText(block.text)),
      }];
    case 'divider':
      return [{ type: 'horizontalRule' }];
    case 'list':
      return buildOptionalTiptapNode(buildTiptapListNode(block.items, 'bulletList', options));
    case 'orderedList':
      return buildOptionalTiptapNode(buildTiptapListNode(block.items, 'orderedList', options, block));
    case 'table':
      return buildOptionalTiptapNode(buildTiptapTableWrapperNode(block));
    case 'details':
      return [buildTiptapDetailsNode(block, options)];
    case 'math':
      return [{
        type: MATH_BLOCK_NODE_NAME,
        attrs: { source: block.source },
      }];
    case 'anchor':
    case 'unsupported':
      return options?.isForCopy ? [] : [{ type: UNSUPPORTED_NODE_NAME }];
    default:
      // TODO: Add Tiptap media nodes for lossless message copy and editor paste
      return options?.isForCopy
        ? buildTiptapMediaFallbackNodes(block, options)
        : [{ type: UNSUPPORTED_NODE_NAME }];
  }
}

function buildOptionalTiptapNode(node: TiptapJsonContent | undefined) {
  return node ? [node] : [];
}

function buildTiptapMediaFallbackNodes(
  block: ApiPageBlock,
  options: RichMessageToTiptapOptions,
): TiptapJsonContent[] {
  switch (block.type) {
    case 'photo':
    case 'video':
    case 'audio':
    case 'embed':
    case 'map':
      return buildTiptapCaptionNodes(block.caption);
    case 'cover':
      return buildTiptapNodesFromBlock(block.cover, options);
    case 'embedPost':
      return [
        ...(block.author ? buildTiptapParagraphNodes(buildPlainRichText(block.author)) : []),
        ...block.blocks.flatMap((nestedBlock) => buildTiptapNodesFromBlock(nestedBlock, options)),
        ...buildTiptapCaptionNodes(block.caption),
      ];
    case 'collage':
    case 'slideshow':
      return [
        ...block.items.flatMap((item) => buildTiptapNodesFromBlock(item, options)),
        ...buildTiptapCaptionNodes(block.caption),
      ];
    case 'relatedArticles':
      return [
        ...(hasRichText(block.title) ? [buildTiptapHeadingNode(block.title, 3)] : []),
        ...block.articles.flatMap((article) => {
          const text = [article.title || article.url, article.description, article.author].filter(Boolean).join('\n');
          return text ? buildTiptapParagraphNodes(buildPlainRichText(text)) : [];
        }),
      ];
    case 'channel':
      return block.title ? buildTiptapParagraphNodes(buildPlainRichText(block.title)) : [];
    default:
      return [];
  }
}

function buildTiptapCaptionNodes(caption: ApiPageCaption): TiptapJsonContent[] {
  return [
    ...(hasRichText(caption.text) ? buildTiptapParagraphNodes(caption.text) : []),
    ...(hasRichText(caption.credit) ? [{
      type: FOOTER_NODE_NAME,
      content: buildTiptapInlineContentFromRichText(caption.credit),
    }] : []),
  ];
}

function buildAuthorDateRichText(block: Extract<ApiPageBlock, { type: 'authorDate' }>): ApiRichText {
  const texts: ApiRichText[] = [];
  if (hasRichText(block.author)) texts.push(block.author);
  if (block.publishedDate) {
    if (texts.length) texts.push(buildPlainRichText(AUTHOR_DATE_SEPARATOR));
    texts.push(buildPlainRichText(formatDateTime(
      getTranslationFn(),
      new Date(block.publishedDate * MILLISECONDS_PER_SECOND),
      { date: 'long', time: 'short' },
    )));
  }
  return buildConcatRichText(texts);
}

function buildPlainRichText(text: string): ApiRichText {
  return text ? { type: 'plain', text } : EMPTY_RICH_TEXT;
}

function buildTiptapHeadingNode(text: ApiRichText, level: number): TiptapJsonContent {
  return {
    type: 'heading',
    attrs: { level },
    content: buildTiptapInlineContentFromRichText(text),
  };
}

function buildTiptapMentionNodes(text: Extract<ApiRichText, { type: 'mention' }>) {
  const label = getRichTextPlainText(text.text);
  const username = label.startsWith('@') ? label.slice(1) : undefined;

  return [{
    type: 'mention',
    attrs: {
      username,
      label,
    },
    content: buildTiptapTextContent(label),
  }];
}

function buildTiptapMentionNameNode(text: Extract<ApiRichText, { type: 'mentionName' }>): TiptapJsonContent {
  const label = getRichTextPlainText(text.text);

  return {
    type: 'mention',
    attrs: {
      userId: text.userId,
      label,
    },
    content: buildTiptapTextContent(label),
  };
}

function buildTiptapParagraphNode(text: ApiRichText): TiptapJsonContent {
  return {
    type: 'paragraph',
    content: buildTiptapInlineContentFromRichText(text),
  };
}

function buildTiptapParagraphNodes(text: ApiRichText): TiptapJsonContent[] {
  const paragraphs: TiptapJsonContent[] = [];
  let content: TiptapJsonContent[] = [];

  buildTiptapInlineContentFromRichText(text).forEach((node) => {
    if (node.type === 'hardBreak') {
      paragraphs.push({
        type: 'paragraph',
        content,
      });
      content = [];
      return;
    }

    content.push(node);
  });

  paragraphs.push({
    type: 'paragraph',
    content,
  });

  return paragraphs;
}

function buildTiptapCaptionNode(caption: ApiRichText): TiptapJsonContent {
  return {
    type: CAPTION_NODE_NAME,
    content: buildTiptapInlineContentFromRichText(caption),
  };
}

function buildTiptapQuoteContent(content: TiptapJsonContent[], caption: ApiRichText) {
  if (!hasRichText(caption)) {
    return content;
  }

  return [...content, buildTiptapCaptionNode(caption)];
}

function buildTiptapTableTitleNode(title: ApiRichText): TiptapJsonContent {
  return {
    type: TABLE_TITLE_NODE_NAME,
    content: buildTiptapInlineContentFromRichText(title),
  };
}

function buildTiptapTableWrapperNode(
  block: Extract<ApiPageBlock, { type: 'table' }>,
): TiptapJsonContent | undefined {
  const tableNode = buildTiptapTableNode(block);
  return tableNode ? {
    type: TABLE_WRAPPER_NODE_NAME,
    content: [buildTiptapTableTitleNode(block.title), tableNode],
  } : undefined;
}

function buildTiptapListNode(
  items: ApiPageListItem[] | ApiPageListOrderedItem[],
  type: 'bulletList' | 'orderedList',
  options?: RichMessageToTiptapOptions,
  orderedList?: OrderedListBlock,
): TiptapJsonContent | undefined {
  const content = items.map((item) => ({
    type: 'listItem',
    attrs: item.isCheckbox ? {
      [LIST_ITEM_CHECKBOX_ATTR]: true,
      [LIST_ITEM_CHECKED_ATTR]: Boolean(item.isChecked),
    } : undefined,
    content: buildTiptapListItemContent(item, options),
  })).filter((item) => item.content.length);

  return content.length ? {
    type,
    attrs: buildTiptapListAttrs(items, type, orderedList),
    content,
  } : undefined;
}

function buildTiptapListItemContent(
  item: ApiPageListItem | ApiPageListOrderedItem,
  options?: RichMessageToTiptapOptions,
): TiptapJsonContent[] {
  if (item.type === 'text') {
    return [buildTiptapParagraphNode(item.text)];
  }

  const content = item.blocks
    .flatMap((block) => buildTiptapNodesFromBlock(block, options));
  if (!content.length) {
    return [];
  }

  return content[0].type === 'paragraph' ? content : [{ type: 'paragraph' }, ...content];
}

function buildTiptapListAttrs(
  items: ApiPageListItem[] | ApiPageListOrderedItem[],
  type: 'bulletList' | 'orderedList',
  orderedList?: OrderedListBlock,
) {
  if (type === 'orderedList') {
    return {
      start: orderedList?.start ?? 1,
      [ORDERED_LIST_TYPE_ATTR]: orderedList?.orderType,
      [ORDERED_LIST_REVERSED_ATTR]: Boolean(orderedList?.isReversed),
    };
  }

  if (!areListItemsCheckboxes(items)) {
    return undefined;
  }

  return { [BULLET_LIST_CHECKLIST_ATTR]: true };
}

function areListItemsCheckboxes(items: ApiPageListItem[] | ApiPageListOrderedItem[]) {
  return Boolean(items.length) && items.every((item) => item.isCheckbox);
}

function buildTiptapTableNode(block: Extract<ApiPageBlock, { type: 'table' }>): TiptapJsonContent | undefined {
  const content = block.rows.map((row) => ({
    type: 'tableRow',
    content: row.cells.map((cell) => ({
      type: 'tableCell',
      attrs: {
        colspan: cell.colspan || 1,
        rowspan: cell.rowspan || 1,
        align: buildTiptapTableCellAlign(cell),
        [TABLE_CELL_HIGHLIGHT_ATTR]: Boolean(cell.isHeader),
        verticalAlign: buildTiptapTableCellVerticalAlign(cell),
      },
      content: [buildTiptapParagraphNode(cell.text || EMPTY_RICH_TEXT)],
    })),
  })).filter((row) => row.content.length);

  return content.length ? {
    type: 'table',
    attrs: {
      [TABLE_BORDERED_ATTR]: Boolean(block.isBordered),
      [TABLE_STRIPED_ATTR]: Boolean(block.isStriped),
    },
    content,
  } : undefined;
}

function buildTiptapTableCellAlign(cell: ApiPageTableCell) {
  if (cell.alignCenter) {
    return 'center';
  }

  return cell.alignRight ? 'right' : undefined;
}

function buildTiptapTableCellVerticalAlign(cell: ApiPageTableCell) {
  if (cell.verticalAlignMiddle) {
    return 'middle';
  }

  return cell.verticalAlignBottom ? 'bottom' : undefined;
}

function buildTiptapDetailsNode(
  block: Extract<ApiPageBlock, { type: 'details' }>,
  options?: RichMessageToTiptapOptions,
): TiptapJsonContent {
  const content = block.blocks
    .flatMap((nestedBlock) => buildTiptapNodesFromBlock(nestedBlock, options));

  return {
    type: 'details',
    attrs: {
      [DETAILS_OPEN_ATTR]: block.isOpen ? true : undefined,
    },
    content: [{
      type: DETAILS_SUMMARY_NODE_TYPE,
      content: buildTiptapInlineContentFromRichText(block.title),
    }, {
      type: DETAILS_CONTENT_NODE_TYPE,
      content: content.length ? content : [{ type: 'paragraph' }],
    }],
  };
}

function buildTiptapBlockquoteBlocksNode(
  block: Extract<ApiPageBlock, { type: 'blockquoteBlocks' }>,
  options?: RichMessageToTiptapOptions,
): TiptapJsonContent {
  const content = block.blocks
    .flatMap((nestedBlock) => buildTiptapNodesFromBlock(nestedBlock, options));

  return {
    type: 'blockquote',
    attrs: {
      [BLOCKQUOTE_COLLAPSED_ATTR]: block.canCollapse,
    },
    content: buildTiptapQuoteContent(
      content.length ? content : [{ type: 'paragraph' }],
      block.caption,
    ),
  };
}

function buildTiptapInlineContentFromRichText(text: ApiRichText, marks: TiptapMark[] = []): TiptapJsonContent[] {
  switch (text.type) {
    case 'empty':
      return [];
    case 'plain':
      return buildTiptapTextContent(text.text, marks);
    case 'concat':
      return text.texts.flatMap((part) => buildTiptapInlineContentFromRichText(part, marks));
    case 'bold':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'bold' }]);
    case 'italic':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'italic' }]);
    case 'underline':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'underline' }]);
    case 'strike':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'strike' }]);
    case 'fixed':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'code' }]);
    case 'spoiler':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'spoiler' }]);
    case 'marked':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'marked' }]);
    case 'subscript':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'subscript' }]);
    case 'superscript':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, { type: 'superscript' }]);
    case 'url':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, {
        type: 'link',
        attrs: { href: text.url },
      }]);
    case 'email':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, {
        type: 'link',
        attrs: { href: `mailto:${text.email}` },
      }]);
    case 'phone':
      return buildTiptapInlineContentFromRichText(text.text, [...marks, {
        type: 'link',
        attrs: { href: `tel:${text.phone}` },
      }]);
    case 'mention':
      return buildTiptapMentionNodes(text);
    case 'mentionName':
      return [buildTiptapMentionNameNode(text)];
    case 'date':
      return buildTiptapDateContent(text, marks);
    case 'customEmoji':
      return [{
        type: 'customEmoji',
        attrs: {
          documentId: text.documentId,
          alt: text.alt,
          className: 'emoji custom-emoji',
        },
      }];
    case 'math':
      return [{
        type: MATH_INLINE_NODE_NAME,
        attrs: { source: text.source },
        marks: marks.length ? marks : undefined,
      }];
    default:
      return buildTiptapInlineContentFromRichText(getNestedSupportedRichText(text), marks);
  }
}

function buildTiptapTextContent(text: string, marks: TiptapMark[] = []): TiptapJsonContent[] {
  if (!text) {
    return [];
  }

  const lines = text.split('\n');
  return lines.flatMap((line, index) => {
    const content: TiptapJsonContent[] = [];
    if (index > 0) {
      content.push({ type: 'hardBreak' });
    }
    if (line) {
      content.push({
        type: 'text',
        text: line,
        marks: marks.length ? marks : undefined,
      });
    }
    return content;
  });
}

function buildTiptapCodeBlockContent(text: string): TiptapJsonContent[] {
  return text ? [{
    type: 'text',
    text,
  }] : [];
}

function buildTiptapDateContent(
  text: ApiRichTextDate,
  marks: TiptapMark[],
): TiptapJsonContent[] {
  const options = buildFormattedDateOptions(text);
  if (!hasFormattedDateFormat(options)) {
    return buildTiptapInlineContentFromRichText(text.text, [...marks, {
      type: 'date',
      attrs: { date: text.date },
    }]);
  }

  return [{
    type: 'formattedDate',
    attrs: {
      date: text.date,
      label: getRichTextPlainText(text.text),
      ...options,
    },
    marks: marks.length ? marks : undefined,
  }];
}

function getNestedSupportedRichText(text: ApiRichText): ApiRichText {
  switch (text.type) {
    case 'email':
    case 'phone':
    case 'anchor':
    case 'mention':
    case 'hashtag':
    case 'botCommand':
    case 'cashtag':
    case 'autoUrl':
    case 'autoEmail':
    case 'autoPhone':
    case 'bankCard':
      return text.text;
    default:
      return EMPTY_RICH_TEXT;
  }
}

function buildParagraphBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const text = buildRichTextFromTiptapContent(node.content);

  return { type: 'paragraph', text };
}

function trimEdgeEmptyParagraphs(blocks: ApiPageBlock[]) {
  let startIndex = 0;
  let endIndex = blocks.length;

  while (startIndex < endIndex && isEmptyParagraph(blocks[startIndex])) {
    startIndex++;
  }

  while (endIndex > startIndex && isEmptyParagraph(blocks[endIndex - 1])) {
    endIndex--;
  }

  return blocks.slice(startIndex, endIndex);
}

function isEmptyParagraph(block: ApiPageBlock) {
  return block.type === 'paragraph' && !getRichTextPlainText(block.text);
}

function buildHeadingBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const text = buildRichTextFromTiptapContent(node.content);
  if (!getRichTextPlainText(text)) {
    return undefined;
  }

  return { type: getHeadingBlockType(getTiptapNumberAttr(node, 'level')), text };
}

function buildFooterBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const text = buildRichTextFromTiptapContent(node.content);
  if (!getRichTextPlainText(text)) {
    return undefined;
  }

  return { type: 'footer', text };
}

function buildBlockquoteBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const blocks = buildBlocksFromTiptapContent(getQuoteBodyContent(node));
  const caption = buildQuoteCaptionFromTiptapNode(node);
  const canCollapse = getTiptapBooleanAttr(node, BLOCKQUOTE_COLLAPSED_ATTR) ? true : undefined;
  if (isSimpleBlockquoteContent(blocks)) {
    return {
      type: 'blockquote',
      text: buildRichTextFromParagraphBlocks(blocks),
      caption,
      canCollapse,
    };
  }

  return blocks.length ? {
    type: 'blockquoteBlocks',
    blocks,
    caption,
    canCollapse,
  } : undefined;
}

function buildPullquoteBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const text = buildRichTextFromTiptapParagraphs(getQuoteBodyContent(node));
  if (!getRichTextPlainText(text)) {
    return undefined;
  }

  return {
    type: 'pullquote',
    text,
    caption: buildQuoteCaptionFromTiptapNode(node),
  };
}

function buildQuoteCaptionFromTiptapNode(node: TiptapJsonContent): ApiRichText {
  const captionNode = node.content?.find((child) => child.type === CAPTION_NODE_NAME);
  return buildRichTextFromTiptapContent(captionNode?.content);
}

function getQuoteBodyContent(node: TiptapJsonContent) {
  return node.content?.filter((child) => child.type !== CAPTION_NODE_NAME);
}

function isSimpleBlockquoteContent(
  blocks: ApiPageBlock[],
): blocks is Extract<ApiPageBlock, { type: 'paragraph' }>[] {
  return Boolean(blocks.length) && blocks.every((block) => block.type === 'paragraph');
}

function buildRichTextFromParagraphBlocks(
  blocks: Extract<ApiPageBlock, { type: 'paragraph' }>[],
): ApiRichText {
  const parts = blocks.flatMap((block, index): ApiRichText[] => (
    index > 0 ? [{ type: 'plain', text: BLOCK_SEPARATOR }, block.text] : [block.text]
  ));

  return buildConcatRichText(parts);
}

function getHeadingBlockType(level?: number): HeadingBlockType {
  switch (level) {
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return `heading${level}`;
    default:
      return 'heading1';
  }
}

function buildListBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const items = node.content
    ?.filter((child) => child.type === 'listItem')
    .map(buildListItemFromTiptapNode)
    .filter(hasListItemContent) || [];

  return items.length ? { type: 'list', items } : undefined;
}

function buildOrderedListBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const items = node.content
    ?.filter((child) => child.type === 'listItem')
    .map(buildOrderedListItemFromTiptapNode)
    .filter(hasListItemContent) || [];
  const start = getTiptapNumberAttr(node, 'start');
  const orderType = getTiptapStringAttr(node, ORDERED_LIST_TYPE_ATTR);

  return items.length ? {
    type: 'orderedList',
    items,
    start: start !== undefined && start !== 1 ? start : undefined,
    orderType: orderType && orderType !== '1' ? orderType : undefined,
    isReversed: getTiptapBooleanAttr(node, ORDERED_LIST_REVERSED_ATTR) ? true : undefined,
  } : undefined;
}

function buildDetailsBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const summaryNode = node.content?.find((child) => child.type === DETAILS_SUMMARY_NODE_TYPE);
  const contentNode = node.content?.find((child) => child.type === DETAILS_CONTENT_NODE_TYPE);
  const title = buildRichTextFromTiptapContent(summaryNode?.content);
  const blocks = buildBlocksFromTiptapContent(contentNode?.content);

  if (!getRichTextPlainText(title) && !blocks.length) {
    return undefined;
  }

  return {
    type: 'details',
    title,
    blocks,
    isOpen: getTiptapBooleanAttr(node, DETAILS_OPEN_ATTR) ? true : undefined,
  };
}

function buildListItemFromTiptapNode(node: TiptapJsonContent): ApiPageListItem {
  const blocks = buildBlocksFromTiptapContent(node.content);
  if (isSimpleListItemContent(blocks)) {
    return {
      type: 'text',
      text: blocks[0].text,
      ...buildListItemCheckboxProps(node),
    };
  }

  return {
    type: 'blocks',
    blocks,
    ...buildListItemCheckboxProps(node),
  };
}

function buildOrderedListItemFromTiptapNode(node: TiptapJsonContent): ApiPageListOrderedItem {
  const blocks = buildBlocksFromTiptapContent(node.content);
  if (isSimpleListItemContent(blocks)) {
    return {
      type: 'text',
      text: blocks[0].text,
      ...buildListItemCheckboxProps(node),
    };
  }

  return {
    type: 'blocks',
    blocks,
    ...buildListItemCheckboxProps(node),
  };
}

function buildBlocksFromTiptapContent(content?: TiptapJsonContent[]) {
  return trimEdgeEmptyParagraphs(content
    ?.map(buildBlockFromTiptapNode)
    .filter((block): block is ApiPageBlock => Boolean(block)) || []);
}

function isSimpleListItemContent(blocks: ApiPageBlock[]): blocks is [Extract<ApiPageBlock, { type: 'paragraph' }>] {
  return blocks.length === 1 && blocks[0].type === 'paragraph';
}

function hasListItemContent(item: ApiPageListItem | ApiPageListOrderedItem) {
  return item.type === 'text' ? Boolean(getRichTextPlainText(item.text)) : Boolean(item.blocks.length);
}

function buildListItemCheckboxProps(node: TiptapJsonContent) {
  const isCheckbox = getTiptapBooleanAttr(node, LIST_ITEM_CHECKBOX_ATTR);
  const isChecked = getTiptapBooleanAttr(node, LIST_ITEM_CHECKED_ATTR);

  return {
    isCheckbox: isCheckbox ? true : undefined,
    isChecked: isCheckbox && isChecked ? true : undefined,
  } satisfies Pick<ApiPageListItem, 'isCheckbox' | 'isChecked'>;
}

function buildTableBlockFromTiptapNode(node: TiptapJsonContent): ApiPageBlock | undefined {
  const titleNode = node.content?.find((child) => child.type === TABLE_TITLE_NODE_NAME);
  const tableNode = node.content?.find((child) => child.type === 'table');
  const rows = tableNode?.content
    ?.filter((child) => child.type === 'tableRow')
    .map((row) => ({
      cells: row.content
        ?.filter((cell) => cell.type === 'tableCell')
        .map(buildTableCellFromTiptapNode) || [],
    }))
    .filter((row) => row.cells.length) || [];

  return rows.length ? {
    type: 'table',
    title: buildRichTextFromTiptapContent(titleNode?.content),
    rows,
    isBordered: getTiptapBooleanAttr(tableNode!, TABLE_BORDERED_ATTR) ? true : undefined,
    isStriped: getTiptapBooleanAttr(tableNode!, TABLE_STRIPED_ATTR) ? true : undefined,
  } : undefined;
}

function buildTableCellFromTiptapNode(node: TiptapJsonContent): ApiPageTableCell {
  const cell: ApiPageTableCell = {
    text: buildRichTextFromTiptapParagraphs(node.content),
  };
  const colspan = getTiptapNumberAttr(node, 'colspan');
  const rowspan = getTiptapNumberAttr(node, 'rowspan');
  const align = getTiptapStringAttr(node, 'align');
  const verticalAlign = getTiptapStringAttr(node, 'verticalAlign');

  if (getTiptapBooleanAttr(node, TABLE_CELL_HIGHLIGHT_ATTR)) {
    cell.isHeader = true;
  }
  if (colspan && colspan > 1) {
    cell.colspan = colspan;
  }
  if (rowspan && rowspan > 1) {
    cell.rowspan = rowspan;
  }
  if (align === 'center') {
    cell.alignCenter = true;
  } else if (align === 'right') {
    cell.alignRight = true;
  }
  if (verticalAlign === 'middle') {
    cell.verticalAlignMiddle = true;
  } else if (verticalAlign === 'bottom') {
    cell.verticalAlignBottom = true;
  }

  return cell;
}

function buildRichTextFromTiptapParagraphs(content?: TiptapJsonContent[]): ApiRichText {
  const paragraphTexts = content
    ?.filter((node) => node.type === 'paragraph')
    .map((node) => buildRichTextFromTiptapContent(node.content)) || [];
  const textsWithSeparators: ApiRichText[] = [];

  for (const text of paragraphTexts) {
    if (textsWithSeparators.length) {
      textsWithSeparators.push({ type: 'plain', text: BLOCK_SEPARATOR });
    }
    textsWithSeparators.push(text);
  }

  return buildConcatRichText(textsWithSeparators);
}

function buildRichTextFromTiptapContent(content?: TiptapJsonContent[]): ApiRichText {
  return buildConcatRichText(content?.map(buildRichTextFromTiptapNode) || []);
}

function buildRichTextFromTiptapNode(node: TiptapJsonContent): ApiRichText {
  if (node.type === 'text') {
    return applyTiptapMarks({ type: 'plain', text: node.text || DEFAULT_STRING }, node.marks);
  }

  if (node.type === 'hardBreak') {
    return { type: 'plain', text: '\n' };
  }

  if (node.type === 'customEmoji') {
    const documentId = getTiptapStringAttr(node, 'documentId');
    const alt = getTiptapStringAttr(node, 'alt') || DEFAULT_STRING;

    return documentId ? { type: 'customEmoji', documentId, alt } : { type: 'plain', text: alt };
  }

  if (node.type === EMOJI_NODE_NAME) {
    const alt = getTiptapStringAttr(node, 'alt') || DEFAULT_STRING;

    return applyTiptapMarks({ type: 'plain', text: alt }, node.marks);
  }

  if (node.type === MATH_INLINE_NODE_NAME) {
    const source = getTiptapStringAttr(node, 'source') || DEFAULT_STRING;

    return applyTiptapMarks({ type: 'math', source }, node.marks);
  }

  if (node.type === 'mention') {
    const userId = getTiptapStringAttr(node, 'userId');
    const username = getTiptapStringAttr(node, 'username');
    const text = buildRichTextFromTiptapContent(node.content);
    const plainText = getRichTextPlainText(text);
    if (!plainText) {
      return EMPTY_RICH_TEXT;
    }

    if (username && plainText.toLowerCase() === `@${username.toLowerCase()}`) {
      return { type: 'mention', text };
    }

    return userId
      ? { type: 'mentionName', userId, text }
      : text;
  }

  if (node.type === 'formattedDate') {
    return applyTiptapMarks(buildFormattedDateRichTextFromTiptapNode(node), node.marks);
  }

  return buildRichTextFromTiptapContent(node.content);
}

function applyTiptapMarks(text: ApiRichText, marks?: TiptapMark[]): ApiRichText {
  return marks?.reduce((result, mark) => applyTiptapMark(result, mark), text) || text;
}

function applyTiptapMark(text: ApiRichText, mark: TiptapMark): ApiRichText {
  switch (mark.type) {
    case 'bold':
      return { type: 'bold', text };
    case 'italic':
      return { type: 'italic', text };
    case 'underline':
      return { type: 'underline', text };
    case 'strike':
      return { type: 'strike', text };
    case 'code':
      return { type: 'fixed', text };
    case 'spoiler':
      return { type: 'spoiler', text };
    case 'marked':
      return { type: 'marked', text };
    case 'subscript':
      return { type: 'subscript', text };
    case 'superscript':
      return { type: 'superscript', text };
    case 'date':
      return buildDateRichTextFromTiptapMark(text, mark);
    case 'link':
      return buildLinkRichTextFromTiptapMark(text, mark);
    case 'mention':
      return buildMentionRichTextFromTiptapMark(text, mark);
    default:
      return text;
  }
}

function buildLinkRichTextFromTiptapMark(text: ApiRichText, mark: TiptapMark): ApiRichText {
  const url = getTiptapMarkStringAttr(mark, 'href');
  return url ? { type: 'url', text, url } : text;
}

function buildMentionRichTextFromTiptapMark(text: ApiRichText, mark: TiptapMark): ApiRichText {
  const username = getTiptapMarkStringAttr(mark, 'username');
  const plainText = getRichTextPlainText(text);
  if (!username || plainText.toLowerCase() !== `@${username.toLowerCase()}`) {
    return text;
  }

  return { type: 'mention', text };
}

function buildDateRichTextFromTiptapMark(text: ApiRichText, mark: TiptapMark): ApiRichText {
  const date = getTiptapMarkNumberAttr(mark, 'date');
  return date === undefined ? text : { type: 'date', text, date };
}

function buildFormattedDateRichTextFromTiptapNode(node: TiptapJsonContent): ApiRichText {
  const date = getTiptapNumberAttr(node, 'date');
  if (date === undefined) {
    return EMPTY_RICH_TEXT;
  }

  const options = buildFormattedDateOptionsFromTiptapNode(node);
  const label = hasFormattedDateFormat(options)
    ? getDefaultFormattedDateText(getTranslationFn(), date)
    : getTiptapStringAttr(node, 'label') || getDefaultFormattedDateText(getTranslationFn(), date);

  return {
    type: 'date',
    text: { type: 'plain', text: label },
    date,
    ...options,
  };
}

function buildConcatRichText(texts: ApiRichText[]): ApiRichText {
  const filtered = texts.filter((text) => getRichTextPlainText(text));

  if (!filtered.length) {
    return EMPTY_RICH_TEXT;
  }

  return filtered.length === 1 ? filtered[0] : { type: 'concat', texts: filtered };
}

function buildPlainTextFromTiptapContent(content?: TiptapJsonContent[]): string {
  return content?.map((node) => {
    if (node.type === 'text') {
      return node.text || DEFAULT_STRING;
    }

    if (node.type === 'hardBreak') {
      return '\n';
    }

    if (node.type === EMOJI_NODE_NAME) {
      return getTiptapStringAttr(node, 'alt') || DEFAULT_STRING;
    }

    return buildPlainTextFromTiptapContent(node.content);
  }).join(DEFAULT_STRING) || DEFAULT_STRING;
}

function getTiptapStringAttr(node: TiptapJsonContent, name: string): string | undefined {
  const value = node.attrs?.[name];

  return typeof value === 'string' ? value : undefined;
}

function getTiptapNumberAttr(node: TiptapJsonContent, name: string): number | undefined {
  const value = node.attrs?.[name];

  return typeof value === 'number' ? value : undefined;
}

function getTiptapBooleanAttr(node: TiptapJsonContent, name: string): boolean | undefined {
  const value = node.attrs?.[name];

  return typeof value === 'boolean' ? value : undefined;
}

function getTiptapMarkStringAttr(mark: TiptapMark, name: string): string | undefined {
  const value = mark.attrs?.[name];

  return typeof value === 'string' ? value : undefined;
}

function getTiptapMarkNumberAttr(mark: TiptapMark, name: string): number | undefined {
  const value = mark.attrs?.[name];

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const result = Number(value);
    return Number.isFinite(result) ? result : undefined;
  }

  return undefined;
}

function hasUnsupportedRichBlock(block: ApiPageBlock): boolean {
  switch (block.type) {
    case 'blockquoteBlocks':
    case 'details':
      return block.blocks.some(hasUnsupportedRichBlock);
    case 'list':
      return block.items.some((item) => item.type === 'blocks' && item.blocks.some(hasUnsupportedRichBlock));
    case 'orderedList':
      return block.items.some((item) => item.type === 'blocks' && item.blocks.some(hasUnsupportedRichBlock));
    case 'header':
    case 'subheader':
    case 'paragraph':
    case 'footer':
    case 'preformatted':
    case 'divider':
    case 'blockquote':
    case 'pullquote':
    case 'table':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
    case 'math':
      return false;
    default:
      return true;
  }
}

function getBlockAsFormatted(block: ApiPageBlock, isApproximate: boolean): ApiFormattedText | undefined {
  switch (block.type) {
    case 'paragraph':
      return getRichTextAsFormatted(block.text, isApproximate);
    case 'header':
    case 'subheader':
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6':
      return isApproximate
        ? getNestedRichTextAsFormatted(block.text, ApiMessageEntityTypes.Bold, true)
        : undefined;
    case 'footer':
      return isApproximate ? getRichTextAsFormatted(block.text, true) : undefined;
    case 'preformatted': {
      const text = getRichTextPlainText(block.text);
      return {
        text,
        entities: text ? [{
          type: ApiMessageEntityTypes.Pre,
          offset: 0,
          length: text.length,
          language: block.language || undefined,
        }] : undefined,
      };
    }
    case 'blockquote':
      return getBlockquoteAsFormatted(block.text, block.caption, isApproximate, block.canCollapse);
    case 'blockquoteBlocks': {
      if (!block.blocks.length) {
        return undefined;
      }

      if (!isApproximate && (
        getRichTextPlainText(block.caption)
        || block.blocks.some((child) => child.type !== 'paragraph' && child.type !== 'preformatted')
      )) {
        return undefined;
      }

      const formatted = getBlocksAsFormatted(block.blocks, isApproximate);
      if (!formatted) {
        return undefined;
      }

      const withCaption = isApproximate
        ? appendQuoteCaption(formatted, block.caption)
        : formatted;
      return withCaption ? wrapFormattedTextWithEntity(withCaption, {
        type: ApiMessageEntityTypes.Blockquote,
        offset: 0,
        length: withCaption.text.length,
        canCollapse: block.canCollapse,
      }) : undefined;
    }
    case 'pullquote':
      return isApproximate ? getBlockquoteAsFormatted(block.text, block.caption, true) : undefined;
    case 'divider':
      return isApproximate ? { text: DIVIDER_TEXT } : undefined;
    case 'list':
      return isApproximate ? getListAsFormatted(block.items) : undefined;
    case 'orderedList':
      return isApproximate ? getOrderedListAsFormatted(block.items, block.start) : undefined;
    case 'details':
      return isApproximate ? getDetailsAsFormatted(block) : undefined;
    case 'table':
      return isApproximate ? getTableAsFormatted(block) : undefined;
    case 'math':
      return isApproximate ? wrapFormattedTextWithEntity({ text: block.source }, {
        type: ApiMessageEntityTypes.Pre,
        offset: 0,
        length: block.source.length,
        language: LATEX_CODE_LANGUAGE,
      }) : undefined;
    default:
      return undefined;
  }
}

function getBlockquoteAsFormatted(
  text: ApiRichText,
  caption: ApiRichText,
  isApproximate: boolean,
  canCollapse?: true,
): ApiFormattedText | undefined {
  if (!isApproximate && getRichTextPlainText(caption)) {
    return undefined;
  }

  const formatted = getRichTextAsFormatted(text, isApproximate);
  const withCaption = formatted && isApproximate ? appendQuoteCaption(formatted, caption) : formatted;
  return withCaption ? wrapFormattedTextWithEntity(withCaption, {
    type: ApiMessageEntityTypes.Blockquote,
    offset: 0,
    length: withCaption.text.length,
    canCollapse,
  }) : undefined;
}

function getBlocksAsFormatted(blocks: ApiPageBlock[], isApproximate: boolean): ApiFormattedText | undefined {
  return blocks.reduce<ApiFormattedText | undefined>((result, block, index) => {
    const formatted = getBlockAsFormatted(block, isApproximate);
    if (!result || !formatted) {
      return undefined;
    }

    return appendFormattedText(result, formatted, index > 0);
  }, { text: '' });
}

function appendQuoteCaption(formatted: ApiFormattedText, caption: ApiRichText): ApiFormattedText | undefined {
  const formattedCaption = getRichTextAsFormatted(caption, true);
  if (!formattedCaption) {
    return undefined;
  }
  if (!formattedCaption.text) {
    return formatted;
  }

  const prefixedCaption = appendFormattedTextWithSeparator(
    { text: QUOTE_AUTHOR_PREFIX },
    formattedCaption,
    DEFAULT_STRING,
  );
  return appendFormattedSections(formatted, prefixedCaption);
}

function getListAsFormatted(items: ApiPageListItem[]): ApiFormattedText | undefined {
  return getListItemsAsFormatted(items, false);
}

function getOrderedListAsFormatted(
  items: ApiPageListOrderedItem[],
  start = 1,
): ApiFormattedText | undefined {
  return getListItemsAsFormatted(items, true, start);
}

function getListItemsAsFormatted(
  items: Array<ApiPageListItem | ApiPageListOrderedItem>,
  isOrdered: boolean,
  start = 1,
): ApiFormattedText | undefined {
  const formattedItems: ApiFormattedText[] = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const formatted = item.type === 'text'
      ? getRichTextAsFormatted(item.text, true)
      : getBlocksAsFormatted(item.blocks, true);
    if (!formatted) {
      return undefined;
    }

    const prefix = getListItemPrefix(item, isOrdered ? start + index : undefined);
    formattedItems.push(prefixFormattedLines(formatted, prefix, LIST_ITEM_INDENT));
  }

  return joinFormattedTexts(formattedItems, BLOCK_SEPARATOR);
}

function getListItemPrefix(item: ApiPageListItem | ApiPageListOrderedItem, orderedValue?: number) {
  if (item.isCheckbox) {
    return item.isChecked ? CHECKED_LIST_PREFIX : UNCHECKED_LIST_PREFIX;
  }

  return orderedValue === undefined ? BULLET_LIST_PREFIX : `${orderedValue}. `;
}

function prefixFormattedLines(
  formatted: ApiFormattedText,
  firstPrefix: string,
  continuationPrefix: string,
): ApiFormattedText {
  const insertionOffsets = [0];
  for (let index = 0; index < formatted.text.length; index++) {
    if (formatted.text[index] === BLOCK_SEPARATOR) {
      insertionOffsets.push(index + BLOCK_SEPARATOR.length);
    }
  }

  const text = formatted.text.split(BLOCK_SEPARATOR).map((line, index) => (
    `${index ? continuationPrefix : firstPrefix}${line}`
  )).join(BLOCK_SEPARATOR);
  const entities = formatted.entities?.map((entity) => {
    const end = entity.offset + entity.length;
    const offset = entity.offset + insertionOffsets.reduce((total, insertionOffset, index) => (
      insertionOffset <= entity.offset
        ? total + (index ? continuationPrefix.length : firstPrefix.length)
        : total
    ), 0);
    const adjustedEnd = end + insertionOffsets.reduce((total, insertionOffset, index) => (
      insertionOffset < end
        ? total + (index ? continuationPrefix.length : firstPrefix.length)
        : total
    ), 0);

    return {
      ...entity,
      offset,
      length: adjustedEnd - offset,
    };
  });

  return {
    text,
    entities,
  };
}

function getDetailsAsFormatted(block: Extract<ApiPageBlock, { type: 'details' }>): ApiFormattedText | undefined {
  const title = getNestedRichTextAsFormatted(block.title, ApiMessageEntityTypes.Bold, true);
  const content = getBlocksAsFormatted(block.blocks, true);
  if (!title || !content) {
    return undefined;
  }

  return appendFormattedSections(title, content);
}

function getTableAsFormatted(block: Extract<ApiPageBlock, { type: 'table' }>): ApiFormattedText | undefined {
  const title = getNestedRichTextAsFormatted(block.title, ApiMessageEntityTypes.Bold, true);
  if (!title) {
    return undefined;
  }

  const rows: ApiFormattedText[] = [];
  for (const row of block.rows) {
    const formatted = getTableRowAsFormatted(row.cells);
    if (!formatted) {
      return undefined;
    }
    rows.push(formatted);
  }

  const table = joinFormattedTexts(rows, BLOCK_SEPARATOR);
  return table ? appendFormattedSections(title, table) : undefined;
}

function getTableRowAsFormatted(cells: ApiPageTableCell[]): ApiFormattedText | undefined {
  const formattedCells: ApiFormattedText[] = [];

  for (const cell of cells) {
    const formatted = getRichTextAsFormatted(cell.text || EMPTY_RICH_TEXT, true);
    if (!formatted) {
      return undefined;
    }

    const normalized = {
      ...formatted,
      text: formatted.text.replace(/\n/g, TABLE_CELL_SEPARATOR),
    };
    formattedCells.push(cell.isHeader ? wrapFormattedTextWithEntity(normalized, {
      type: ApiMessageEntityTypes.Bold,
      offset: 0,
      length: normalized.text.length,
    }) : normalized);
  }

  return joinFormattedTexts(formattedCells, TABLE_CELL_SEPARATOR);
}

function appendFormattedSections(first: ApiFormattedText, second: ApiFormattedText): ApiFormattedText {
  if (!first.text) {
    return second;
  }
  if (!second.text) {
    return first;
  }

  return appendFormattedText(first, second, true);
}

function joinFormattedTexts(parts: ApiFormattedText[], separator: string): ApiFormattedText | undefined {
  if (!parts.length) {
    return undefined;
  }

  return parts.reduce((result, part, index) => (
    appendFormattedTextWithSeparator(result, part, index ? separator : DEFAULT_STRING)
  ), { text: '' });
}

function getRichTextAsFormatted(text: ApiRichText, isApproximate: boolean): ApiFormattedText | undefined {
  switch (text.type) {
    case 'empty':
      return { text: '' };
    case 'plain':
      return { text: text.text };
    case 'concat':
      return text.texts.reduce<ApiFormattedText | undefined>((result, part) => {
        const formatted = getRichTextAsFormatted(part, isApproximate);
        if (!result || !formatted) {
          return undefined;
        }

        return appendFormattedText(result, formatted, false);
      }, { text: '' });
    case 'bold':
      return getNestedRichTextAsFormatted(text.text, ApiMessageEntityTypes.Bold, isApproximate);
    case 'italic':
      return getNestedRichTextAsFormatted(text.text, ApiMessageEntityTypes.Italic, isApproximate);
    case 'underline':
      return getNestedRichTextAsFormatted(text.text, ApiMessageEntityTypes.Underline, isApproximate);
    case 'strike':
      return getNestedRichTextAsFormatted(text.text, ApiMessageEntityTypes.Strike, isApproximate);
    case 'fixed':
      return getNestedRichTextAsFormatted(text.text, ApiMessageEntityTypes.Code, isApproximate);
    case 'spoiler':
      return getNestedRichTextAsFormatted(text.text, ApiMessageEntityTypes.Spoiler, isApproximate);
    case 'marked':
    case 'subscript':
    case 'superscript':
      return isApproximate ? getRichTextAsFormatted(text.text, true) : undefined;
    case 'url':
      return getUrlRichTextAsFormatted(text, isApproximate);
    case 'mention':
      return getRichTextAsFormatted(text.text, isApproximate);
    case 'customEmoji':
      return {
        text: text.alt,
        entities: [{
          type: ApiMessageEntityTypes.CustomEmoji,
          offset: 0,
          length: text.alt.length,
          documentId: text.documentId,
        }],
      };
    case 'mentionName':
      return getMentionNameRichTextAsFormatted(text, isApproximate);
    case 'date':
      return getDateRichTextAsFormatted(text, isApproximate);
    case 'math':
      return isApproximate ? wrapFormattedTextWithEntity({ text: text.source }, {
        type: ApiMessageEntityTypes.Code,
        offset: 0,
        length: text.source.length,
      }) : undefined;
    default:
      return undefined;
  }
}

function getNestedRichTextAsFormatted(
  text: ApiRichText,
  type: InlineEntityType,
  isApproximate: boolean,
): ApiFormattedText | undefined {
  const formatted = getRichTextAsFormatted(text, isApproximate);
  if (!formatted) {
    return undefined;
  }

  return wrapFormattedTextWithEntity(formatted, {
    type,
    offset: 0,
    length: formatted.text.length,
  });
}

function wrapFormattedTextWithEntity(formatted: ApiFormattedText, entity: ApiMessageEntity): ApiFormattedText {
  return {
    ...formatted,
    entities: formatted.text ? [{
      ...entity,
      offset: 0,
      length: formatted.text.length,
    }, ...(formatted.entities || [])] : formatted.entities,
  };
}

function getUrlRichTextAsFormatted(
  text: Extract<ApiRichText, { type: 'url' }>,
  isApproximate: boolean,
): ApiFormattedText | undefined {
  const formatted = getRichTextAsFormatted(text.text, isApproximate);
  if (!formatted) {
    return undefined;
  }

  return wrapFormattedTextWithEntity(formatted, {
    type: ApiMessageEntityTypes.TextUrl,
    offset: 0,
    length: formatted.text.length,
    url: text.url,
  });
}

function appendFormattedText(
  base: ApiFormattedText,
  added: ApiFormattedText,
  withSeparator: boolean,
): ApiFormattedText {
  return appendFormattedTextWithSeparator(base, added, withSeparator ? BLOCK_SEPARATOR : DEFAULT_STRING);
}

function appendFormattedTextWithSeparator(
  base: ApiFormattedText,
  added: ApiFormattedText,
  separator: string,
): ApiFormattedText {
  const offset = base.text.length + separator.length;
  const addedEntities = added.entities?.map((entity) => ({
    ...entity,
    offset: entity.offset + offset,
  }));
  const entities = [...(base.entities || []), ...(addedEntities || [])];

  return {
    text: `${base.text}${separator}${added.text}`,
    entities: entities.length ? entities : undefined,
  };
}

function prepareTelegramEntities(
  text: string,
  entities: ApiMessageEntity[] = [],
) {
  let isValid = true;
  const sorted = entities.reduce<ApiMessageEntity[]>((result, entity) => {
    const normalized = trimTelegramEntity(text, entity);
    if (!normalized) {
      isValid &&= entity.offset >= 0 && entity.offset + entity.length <= text.length;
      return result;
    }

    result.push(normalized);
    return result;
  }, []).sort(compareTelegramEntities);
  const structural: StructuralEntity[] = [];

  sorted.filter((entity) => entity.type === ApiMessageEntityTypes.Blockquote).forEach((entity) => {
    if (structural.every((accepted) => !intersectsEntity(accepted, entity))) {
      structural.push(entity);
    } else {
      isValid = false;
    }
  });
  sorted.filter((entity) => entity.type === ApiMessageEntityTypes.Pre).forEach((entity) => {
    const hasInvalidOverlap = structural.some((accepted) => (
      accepted.type === ApiMessageEntityTypes.Pre
        ? intersectsEntity(accepted, entity)
        : intersectsEntity(accepted, entity) && !containsEntity(accepted, entity)
    ));
    if (hasInvalidOverlap) {
      isValid = false;
      return;
    }
    structural.push(entity);
  });

  const inline: ApiMessageEntity[] = [];
  sorted.filter((entity) => !isStructuralEntity(entity)).forEach((entity) => {
    if (hasValidInlineEntityRelations(entity, structural, inline)) {
      inline.push(entity);
    } else {
      isValid = false;
    }
  });
  const accepted = [...structural, ...inline];
  return {
    entities: sorted.filter((entity) => accepted.includes(entity)),
    isValid,
  };
}

function trimTelegramEntity(text: string, entity: ApiMessageEntity): ApiMessageEntity | undefined {
  if (entity.offset < 0 || entity.length <= 0 || getEntityEnd(entity) > text.length) {
    return undefined;
  }

  let end = getEntityEnd(entity);
  while (end > entity.offset && TRAILING_ENTITY_WHITESPACE_RE.test(text[end - 1])) {
    end--;
  }

  return end > entity.offset ? { ...entity, length: end - entity.offset } : undefined;
}

function hasValidInlineEntityRelations(
  entity: ApiMessageEntity,
  structural: StructuralEntity[],
  inline: ApiMessageEntity[],
) {
  const hasValidStructuralRelations = structural.every((other) => {
    if (!intersectsEntity(entity, other)) {
      return true;
    }
    if (other.type === ApiMessageEntityTypes.Pre) {
      return isFlexibleEntity(entity) && containsEntity(entity, other);
    }
    return containsEntity(other, entity) || (isFlexibleEntity(entity) && containsEntity(entity, other));
  });

  return hasValidStructuralRelations && inline.every((other) => (
    !intersectsEntity(entity, other)
    || (
      entity.type !== ApiMessageEntityTypes.Code
      && other.type !== ApiMessageEntityTypes.Code
      && entity.type !== other.type
      && (containsEntity(entity, other) || containsEntity(other, entity))
    )
  ));
}

function compareTelegramEntities(first: ApiMessageEntity, second: ApiMessageEntity) {
  return first.offset - second.offset
    || second.length - first.length
    || getTelegramEntityPriority(first) - getTelegramEntityPriority(second);
}

function getTelegramEntityPriority(entity: ApiMessageEntity) {
  return entity.type === ApiMessageEntityTypes.Pre
    ? entity.language ? 10 : 11
    : ENTITY_PRIORITY_BY_TYPE[entity.type] ?? 50;
}

function isFlexibleEntity(entity: ApiMessageEntity) {
  return entity.type === ApiMessageEntityTypes.Bold
    || entity.type === ApiMessageEntityTypes.Italic
    || entity.type === ApiMessageEntityTypes.Underline
    || entity.type === ApiMessageEntityTypes.Strike
    || entity.type === ApiMessageEntityTypes.Spoiler;
}

function containsEntity(outer: ApiMessageEntity, inner: ApiMessageEntity) {
  return outer.offset <= inner.offset && getEntityEnd(outer) >= getEntityEnd(inner);
}

function intersectsEntity(first: ApiMessageEntity, second: ApiMessageEntity) {
  return first.offset < getEntityEnd(second) && second.offset < getEntityEnd(first);
}

function getEntityEnd(entity: ApiMessageEntity) {
  return entity.offset + entity.length;
}

function buildRichTextFromFormatted(
  text: string,
  entities: ApiMessageEntity[],
  start = 0,
  end = text.length,
): ApiRichText {
  const inlineEntities = entities
    .map((entity) => getInlineEntityForStructuralLeaf(entity, start, end))
    .filter((entity): entity is ApiMessageEntity => Boolean(entity));

  return buildRichTextFromEntityNodes(text, buildEntityTree(inlineEntities), start, end);
}

// Flexible formatting may span a quote boundary, so preserve its intersection with each structural leaf
function getInlineEntityForStructuralLeaf(
  entity: ApiMessageEntity,
  start: number,
  end: number,
): ApiMessageEntity | undefined {
  if (isStructuralEntity(entity) || entity.offset >= end || getEntityEnd(entity) <= start) {
    return undefined;
  }
  if (entity.offset >= start && getEntityEnd(entity) <= end) {
    return entity;
  }
  if (!isFlexibleEntity(entity)) {
    return undefined;
  }

  const clippedStart = Math.max(entity.offset, start);
  const clippedEnd = Math.min(getEntityEnd(entity), end);
  return { ...entity, offset: clippedStart, length: clippedEnd - clippedStart };
}

function isStructuralEntity(
  entity: ApiMessageEntity,
): entity is StructuralEntity {
  return entity.type === ApiMessageEntityTypes.Pre || entity.type === ApiMessageEntityTypes.Blockquote;
}

function buildBlocksFromFormattedRange(
  text: string,
  entities: ApiMessageEntity[],
  start: number,
  end: number,
  structuralEntities: StructuralEntity[],
) {
  const blocks: ApiPageBlock[] = [];
  let cursor = start;
  function appendParagraph(from: number, to: number, shouldPreserveEmpty?: boolean) {
    if (from < to || (from === to && shouldPreserveEmpty)) {
      blocks.push({ type: 'paragraph', text: buildRichTextFromFormatted(text, entities, from, to) });
    }
  }

  structuralEntities.forEach((entity, index) => {
    let segmentStart = cursor;
    let segmentEnd = entity.offset;
    const shouldPreserveEmptyParagraph = segmentEnd - segmentStart > 1;

    if (index > 0 && text[segmentStart] === BLOCK_SEPARATOR) {
      segmentStart++;
    }
    if (segmentEnd > segmentStart && text[segmentEnd - 1] === BLOCK_SEPARATOR) {
      segmentEnd--;
    }

    appendParagraph(segmentStart, segmentEnd, shouldPreserveEmptyParagraph);
    blocks.push(buildStructuralBlockFromFormatted(text, entities, entity));
    cursor = getEntityEnd(entity);
  });

  const trailingStart = structuralEntities.length && text[cursor] === BLOCK_SEPARATOR ? cursor + 1 : cursor;
  appendParagraph(trailingStart, end);
  return blocks;
}

function buildStructuralBlockFromFormatted(
  text: string,
  entities: ApiMessageEntity[],
  entity: StructuralEntity,
): ApiPageBlock {
  const end = getEntityEnd(entity);
  if (entity.type === ApiMessageEntityTypes.Pre) {
    return {
      type: 'preformatted',
      text: { type: 'plain', text: text.slice(entity.offset, end) },
      language: entity.language || DEFAULT_STRING,
    };
  }

  const preEntities = entities.filter((child): child is StructuralEntity => (
    child.type === ApiMessageEntityTypes.Pre && containsEntity(entity, child)
  ));

  return preEntities.length ? {
    type: 'blockquoteBlocks',
    blocks: buildBlocksFromFormattedRange(text, entities, entity.offset, end, preEntities),
    caption: EMPTY_RICH_TEXT,
    canCollapse: entity.canCollapse ? true : undefined,
  } : {
    type: 'blockquote',
    text: buildRichTextFromFormatted(text, entities, entity.offset, end),
    caption: EMPTY_RICH_TEXT,
    canCollapse: entity.canCollapse ? true : undefined,
  };
}

function getOuterStructuralEntities(entities: ApiMessageEntity[]): StructuralEntity[] {
  const blockquotes = entities.filter((entity) => entity.type === ApiMessageEntityTypes.Blockquote);

  return entities.filter((entity): entity is StructuralEntity => (
    isStructuralEntity(entity)
    && (entity.type === ApiMessageEntityTypes.Blockquote
      || !blockquotes.some((blockquote) => containsEntity(blockquote, entity)))
  ));
}

function buildEntityTree(entities: ApiMessageEntity[]): EntityNode[] {
  const roots: EntityNode[] = [];
  const stack: EntityNode[] = [];

  entities.sort(compareTelegramEntities).forEach((entity) => {
    while (stack.length && entity.offset >= getEntityEnd(stack[stack.length - 1].entity)) {
      stack.pop();
    }

    const node: EntityNode = { entity, children: [] };
    const parent = stack[stack.length - 1];
    if (parent && getEntityEnd(entity) <= getEntityEnd(parent.entity)) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  });

  return roots;
}

function buildRichTextFromEntityNodes(
  text: string,
  nodes: EntityNode[],
  start: number,
  end: number,
): ApiRichText {
  const parts: ApiRichText[] = [];
  let cursor = start;

  nodes.forEach(({ entity, children }) => {
    if (cursor < entity.offset) {
      parts.push({ type: 'plain', text: text.slice(cursor, entity.offset) });
    }
    parts.push(wrapRichTextWithEntity(
      buildRichTextFromEntityNodes(text, children, entity.offset, getEntityEnd(entity)),
      entity,
    ));
    cursor = getEntityEnd(entity);
  });
  if (cursor < end) {
    parts.push({ type: 'plain', text: text.slice(cursor, end) });
  }

  return buildConcatRichText(parts);
}

function wrapRichTextWithEntity(text: ApiRichText, entity: ApiMessageEntity): ApiRichText {
  switch (entity.type) {
    case ApiMessageEntityTypes.Bold:
      return { type: 'bold', text };
    case ApiMessageEntityTypes.Italic:
      return { type: 'italic', text };
    case ApiMessageEntityTypes.Underline:
      return { type: 'underline', text };
    case ApiMessageEntityTypes.Strike:
      return { type: 'strike', text };
    case ApiMessageEntityTypes.Code:
      return { type: 'fixed', text };
    case ApiMessageEntityTypes.Spoiler:
      return { type: 'spoiler', text };
    case ApiMessageEntityTypes.TextUrl:
      return { type: 'url', text, url: entity.url };
    case ApiMessageEntityTypes.CustomEmoji:
      return { type: 'customEmoji', documentId: entity.documentId, alt: getRichTextPlainText(text) };
    case ApiMessageEntityTypes.MentionName:
      return { type: 'mentionName', text, userId: entity.userId };
    case ApiMessageEntityTypes.FormattedDate:
      return {
        type: 'date',
        text,
        date: entity.date,
        ...buildFormattedDateOptions(entity),
      };
    default:
      return text;
  }
}

function getMentionNameRichTextAsFormatted(
  text: Extract<ApiRichText, { type: 'mentionName' }>,
  isApproximate: boolean,
): ApiFormattedText | undefined {
  const formatted = getRichTextAsFormatted(text.text, isApproximate);
  if (!formatted) {
    return undefined;
  }

  return wrapFormattedTextWithEntity(formatted, {
    type: ApiMessageEntityTypes.MentionName,
    offset: 0,
    length: formatted.text.length,
    userId: text.userId,
  });
}

function getDateRichTextAsFormatted(
  text: ApiRichTextDate,
  isApproximate: boolean,
): ApiFormattedText | undefined {
  const formatted = getRichTextAsFormatted(text.text, isApproximate);
  if (!formatted) {
    return undefined;
  }

  return wrapFormattedTextWithEntity(formatted, {
    type: ApiMessageEntityTypes.FormattedDate,
    offset: 0,
    length: formatted.text.length,
    date: text.date,
    ...buildFormattedDateOptions(text),
  });
}

function buildFormattedDateOptions(
  value: FormattedDateEntityOptions,
): FormattedDateEntityOptions {
  return {
    relative: value.relative,
    dayOfWeek: value.dayOfWeek,
    shortDate: value.shortDate,
    longDate: value.longDate,
    shortTime: value.shortTime,
    longTime: value.longTime,
  };
}

function buildFormattedDateOptionsFromTiptapNode(node: TiptapJsonContent): FormattedDateEntityOptions {
  return {
    relative: getTiptapBooleanAttr(node, 'relative') ? true : undefined,
    dayOfWeek: getTiptapBooleanAttr(node, 'dayOfWeek') ? true : undefined,
    shortDate: getTiptapBooleanAttr(node, 'shortDate') ? true : undefined,
    longDate: getTiptapBooleanAttr(node, 'longDate') ? true : undefined,
    shortTime: getTiptapBooleanAttr(node, 'shortTime') ? true : undefined,
    longTime: getTiptapBooleanAttr(node, 'longTime') ? true : undefined,
  };
}
