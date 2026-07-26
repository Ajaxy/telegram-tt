import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiInputRichMessage,
  ApiPageBlock,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiPageTableCell,
  ApiPageTableRow,
  ApiRichText,
  ApiRichTextDate,
} from '../../types';

const DEFAULT_STRING = '';
const TEXT_BLOCK_TYPES = new Set<ApiPageBlock['type']>([
  'title',
  'subtitle',
  'header',
  'subheader',
  'paragraph',
  'preformatted',
  'footer',
  'kicker',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'thinking',
]);

export function buildInputRichMessage(value: ApiInputRichMessage): GramJs.InputRichMessage | undefined {
  const blocks = value.blocks.map(buildMtpPageBlock);
  if (!blocks.length || blocks.some((block) => !block)) {
    return undefined;
  }

  return new GramJs.InputRichMessage({
    rtl: value.isRtl,
    noautolink: value.shouldDisableAutoLink,
    blocks: blocks as GramJs.TypePageBlock[],
  });
}

function buildMtpPageBlock(block: ApiPageBlock): GramJs.TypePageBlock | undefined {
  if (TEXT_BLOCK_TYPES.has(block.type) && 'text' in block) {
    const text = buildMtpRichText(block.text);
    if (!text) {
      return undefined;
    }

    return buildTextPageBlock(block.type, text, block.type === 'preformatted' ? block.language : undefined);
  }

  switch (block.type) {
    case 'divider':
      return new GramJs.PageBlockDivider();
    case 'blockquote':
      return buildQuotePageBlock(block.text, block.caption, false);
    case 'blockquoteBlocks':
      return buildBlockquoteBlocksPageBlock(block.blocks, block.caption);
    case 'pullquote':
      return buildQuotePageBlock(block.text, block.caption, true);
    case 'math':
      return new GramJs.PageBlockMath({ source: block.source });
    case 'list':
      return buildListPageBlock(block.items);
    case 'orderedList':
      return buildOrderedListPageBlock(block.items, block.start, block.orderType, block.isReversed);
    case 'details':
      return buildDetailsPageBlock(block.title, block.blocks, block.isOpen);
    case 'table':
      return buildTablePageBlock(block.title, block.rows, block.isBordered, block.isStriped);
    default:
      return undefined;
  }
}

function buildTextPageBlock(
  type: ApiPageBlock['type'],
  text: GramJs.TypeRichText,
  language?: string,
): GramJs.TypePageBlock | undefined {
  switch (type) {
    case 'title':
      return new GramJs.PageBlockTitle({ text });
    case 'subtitle':
      return new GramJs.PageBlockSubtitle({ text });
    case 'header':
      return new GramJs.PageBlockHeader({ text });
    case 'subheader':
      return new GramJs.PageBlockSubheader({ text });
    case 'paragraph':
      return new GramJs.PageBlockParagraph({ text });
    case 'preformatted':
      return new GramJs.PageBlockPreformatted({ text, language: language || DEFAULT_STRING });
    case 'footer':
      return new GramJs.PageBlockFooter({ text });
    case 'kicker':
      return new GramJs.PageBlockKicker({ text });
    case 'heading1':
      return new GramJs.PageBlockHeading1({ text });
    case 'heading2':
      return new GramJs.PageBlockHeading2({ text });
    case 'heading3':
      return new GramJs.PageBlockHeading3({ text });
    case 'heading4':
      return new GramJs.PageBlockHeading4({ text });
    case 'heading5':
      return new GramJs.PageBlockHeading5({ text });
    case 'heading6':
      return new GramJs.PageBlockHeading6({ text });
    case 'thinking':
      return new GramJs.PageBlockThinking({ text });
    default:
      return undefined;
  }
}

function buildQuotePageBlock(
  text: ApiRichText,
  caption: ApiRichText,
  isPullquote: boolean,
): GramJs.TypePageBlock | undefined {
  const mtpText = buildMtpRichText(text);
  const mtpCaption = buildMtpRichText(caption);

  if (!mtpText || !mtpCaption) {
    return undefined;
  }

  return isPullquote
    ? new GramJs.PageBlockPullquote({ text: mtpText, caption: mtpCaption })
    : new GramJs.PageBlockBlockquote({ text: mtpText, caption: mtpCaption });
}

function buildBlockquoteBlocksPageBlock(blocks: ApiPageBlock[], caption: ApiRichText) {
  const mtpBlocks = blocks.map(buildMtpPageBlock);
  const mtpCaption = buildMtpRichText(caption);

  if (!mtpCaption || !mtpBlocks.length || mtpBlocks.some((block) => !block)) {
    return undefined;
  }

  return new GramJs.PageBlockBlockquoteBlocks({
    blocks: mtpBlocks as GramJs.TypePageBlock[],
    caption: mtpCaption,
  });
}

function buildDetailsPageBlock(title: ApiRichText, blocks: ApiPageBlock[], isOpen?: true) {
  const mtpTitle = buildMtpRichText(title);
  const mtpBlocks = blocks.map(buildMtpPageBlock);

  if (!mtpTitle || mtpBlocks.some((block) => !block)) {
    return undefined;
  }

  return new GramJs.PageBlockDetails({
    title: mtpTitle,
    blocks: mtpBlocks as GramJs.TypePageBlock[],
    open: isOpen,
  });
}

function buildMtpRichText(text: ApiRichText): GramJs.TypeRichText | undefined {
  switch (text.type) {
    case 'empty':
      return new GramJs.TextEmpty();
    case 'plain':
      return new GramJs.TextPlain({ text: text.text });
    case 'bold':
      return buildNestedRichText(text.text, GramJs.TextBold);
    case 'italic':
      return buildNestedRichText(text.text, GramJs.TextItalic);
    case 'underline':
      return buildNestedRichText(text.text, GramJs.TextUnderline);
    case 'strike':
      return buildNestedRichText(text.text, GramJs.TextStrike);
    case 'fixed':
      return buildNestedRichText(text.text, GramJs.TextFixed);
    case 'spoiler':
      return buildNestedRichText(text.text, GramJs.TextSpoiler);
    case 'marked':
      return buildNestedRichText(text.text, GramJs.TextMarked);
    case 'subscript':
      return buildNestedRichText(text.text, GramJs.TextSubscript);
    case 'superscript':
      return buildNestedRichText(text.text, GramJs.TextSuperscript);
    case 'url':
      return buildUrlRichText(text);
    case 'email':
      return buildEmailRichText(text);
    case 'mention':
      return buildNestedRichText(text.text, GramJs.TextMention);
    case 'mentionName':
      return buildMentionNameRichText(text);
    case 'concat':
      return buildConcatRichText(text.texts);
    case 'math':
      return new GramJs.TextMath({ source: text.source });
    case 'date':
      return buildDateRichText(text);
    case 'customEmoji':
      return new GramJs.TextCustomEmoji({
        documentId: BigInt(text.documentId),
        alt: text.alt,
      });
    default:
      return undefined;
  }
}

function buildNestedRichText(
  text: ApiRichText,
  Constructor: new(options: { text: GramJs.TypeRichText }) => GramJs.TypeRichText,
) {
  const mtpText = buildMtpRichText(text);

  return mtpText ? new Constructor({ text: mtpText }) : undefined;
}

function buildUrlRichText(text: Extract<ApiRichText, { type: 'url' }>) {
  const mtpText = buildMtpRichText(text.text);

  return mtpText ? new GramJs.TextUrl({
    text: mtpText,
    url: text.url,
    webpageId: BigInt(text.webPageId || 0),
  }) : undefined;
}

function buildEmailRichText(text: Extract<ApiRichText, { type: 'email' }>) {
  const mtpText = buildMtpRichText(text.text);

  return mtpText ? new GramJs.TextEmail({
    text: mtpText,
    email: text.email,
  }) : undefined;
}

function buildMentionNameRichText(text: Extract<ApiRichText, { type: 'mentionName' }>) {
  const mtpText = buildMtpRichText(text.text);

  return mtpText ? new GramJs.TextMentionName({
    text: mtpText,
    userId: BigInt(text.userId),
  }) : undefined;
}

function buildConcatRichText(texts: ApiRichText[]) {
  const mtpTexts = texts.map(buildMtpRichText);
  if (!mtpTexts.length || mtpTexts.some((text) => !text)) {
    return undefined;
  }

  return new GramJs.TextConcat({ texts: mtpTexts as GramJs.TypeRichText[] });
}

function buildListPageBlock(items: ApiPageListItem[]): GramJs.TypePageBlock | undefined {
  const mtpItems = items.map(buildMtpPageListItem);
  if (!mtpItems.length || mtpItems.some((item) => !item)) {
    return undefined;
  }

  return new GramJs.PageBlockList({ items: mtpItems as GramJs.TypePageListItem[] });
}

function buildOrderedListPageBlock(
  items: ApiPageListOrderedItem[],
  start?: number,
  orderType?: string,
  isReversed?: true,
): GramJs.TypePageBlock | undefined {
  const mtpItems = items.map(buildMtpPageListOrderedItem);
  if (!mtpItems.length || mtpItems.some((item) => !item)) {
    return undefined;
  }

  return new GramJs.PageBlockOrderedList({
    items: mtpItems as GramJs.TypePageListOrderedItem[],
    start,
    type: orderType,
    reversed: isReversed,
  });
}

function buildTablePageBlock(
  title: ApiRichText,
  rows: ApiPageTableRow[],
  isBordered?: true,
  isStriped?: true,
): GramJs.TypePageBlock | undefined {
  const mtpTitle = buildMtpRichText(title);
  const mtpRows = rows.map(buildMtpPageTableRow);
  if (!mtpTitle || !mtpRows.length || mtpRows.some((row) => !row)) {
    return undefined;
  }

  return new GramJs.PageBlockTable({
    title: mtpTitle,
    rows: mtpRows as GramJs.TypePageTableRow[],
    bordered: isBordered,
    striped: isStriped,
  });
}

function buildMtpPageListItem(item: ApiPageListItem): GramJs.TypePageListItem | undefined {
  if (item.type === 'text') {
    const text = buildMtpRichText(item.text);
    return text ? new GramJs.PageListItemText({
      text,
      checkbox: item.isCheckbox,
      checked: item.isChecked,
    }) : undefined;
  }

  const blocks = item.blocks.map(buildMtpPageBlock);
  if (!blocks.length || blocks.some((block) => !block)) {
    return undefined;
  }

  return new GramJs.PageListItemBlocks({
    blocks: blocks as GramJs.TypePageBlock[],
    checkbox: item.isCheckbox,
    checked: item.isChecked,
  });
}

function buildMtpPageListOrderedItem(item: ApiPageListOrderedItem): GramJs.TypePageListOrderedItem | undefined {
  if (item.type === 'text') {
    const text = buildMtpRichText(item.text);
    return text ? new GramJs.PageListOrderedItemText({
      text,
      num: item.num,
      value: item.value,
      type: item.orderType,
      checkbox: item.isCheckbox,
      checked: item.isChecked,
    }) : undefined;
  }

  const blocks = item.blocks.map(buildMtpPageBlock);
  if (!blocks.length || blocks.some((block) => !block)) {
    return undefined;
  }

  return new GramJs.PageListOrderedItemBlocks({
    blocks: blocks as GramJs.TypePageBlock[],
    num: item.num,
    value: item.value,
    type: item.orderType,
    checkbox: item.isCheckbox,
    checked: item.isChecked,
  });
}

function buildMtpPageTableRow(row: ApiPageTableRow): GramJs.TypePageTableRow | undefined {
  const cells = row.cells.map(buildMtpPageTableCell);
  if (!cells.length || cells.some((cell) => !cell)) {
    return undefined;
  }

  return new GramJs.PageTableRow({ cells: cells as GramJs.TypePageTableCell[] });
}

function buildMtpPageTableCell(cell: ApiPageTableCell): GramJs.TypePageTableCell | undefined {
  const text = cell.text ? buildMtpRichText(cell.text) : undefined;
  if (cell.text && !text) {
    return undefined;
  }

  return new GramJs.PageTableCell({
    text,
    colspan: cell.colspan,
    rowspan: cell.rowspan,
    header: cell.isHeader,
    alignCenter: cell.alignCenter,
    alignRight: cell.alignRight,
    valignMiddle: cell.verticalAlignMiddle,
    valignBottom: cell.verticalAlignBottom,
  });
}

function buildDateRichText(text: ApiRichTextDate) {
  const mtpText = buildMtpRichText(text.text);

  return mtpText ? new GramJs.TextDate({
    text: mtpText,
    date: text.date,
    relative: text.relative,
    shortTime: text.shortTime,
    longTime: text.longTime,
    shortDate: text.shortDate,
    longDate: text.longDate,
    dayOfWeek: text.dayOfWeek,
  }) : undefined;
}
