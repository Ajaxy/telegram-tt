import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiInlineButtonAction,
  ApiInputRichMessage,
  ApiPageBlock,
  ApiPageCaption,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiPageTableCell,
  ApiPageTableRow,
  ApiRichButton,
  ApiRichText,
  ApiRichTextDate,
} from '../../types';

import { MAX_BUTTONS_PER_ROW, normalizeButtonText } from '../../../global/helpers/buttons';
import { hasRichText } from '../../../util/richText';
import { buildInputUserFromLocalDb } from './index';
import { buildInputDocument, buildInputPhoto } from './media';

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
  const blocks = buildMtpPageBlocks(value.blocks);
  const media = buildRichMessageMedia(value.blocks);
  if (!blocks.length || blocks.some((block) => !block) || !media) {
    return undefined;
  }

  return new GramJs.InputRichMessage({
    rtl: value.isRtl,
    noautolink: value.shouldDisableAutoLink,
    blocks: blocks as GramJs.TypePageBlock[],
    photos: media.photos.length ? media.photos : undefined,
    documents: media.documents.length ? media.documents : undefined,
  });
}

function buildMtpPageBlocks(blocks: ApiPageBlock[]) {
  return blocks.filter((block) => block.type !== 'buttonRow'
    || block.buttons.some((button) => hasRichText(normalizeButtonText(button.text))))
    .map(buildMtpPageBlock);
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
    case 'buttonRow': {
      const buttons = block.buttons.filter((button) => hasRichText(normalizeButtonText(button.text)))
        .map((button) => buildMtpRichButton(button, GramJs.PageButton));
      if (!buttons.length || buttons.length > MAX_BUTTONS_PER_ROW || buttons.some((button) => !button)) {
        return undefined;
      }
      return new GramJs.PageBlockButtonRow({
        buttons: buttons as GramJs.PageButton[],
        alignLeft: block.align === 'left' || undefined,
        alignCenter: block.align === 'center' || undefined,
        alignRight: block.align === 'right' || undefined,
      });
    }
    case 'divider':
      return new GramJs.PageBlockDivider();
    case 'blockquote':
      return buildQuotePageBlock(block.text, block.caption, false, block.canCollapse);
    case 'blockquoteBlocks':
      return buildBlockquoteBlocksPageBlock(block.blocks, block.caption);
    case 'pullquote':
      return buildQuotePageBlock(block.text, block.caption, true);
    case 'photo':
      return buildPhotoPageBlock(block);
    case 'video':
      return buildVideoPageBlock(block);
    case 'audio': {
      const caption = buildMtpPageCaption(block.caption);
      return caption ? new GramJs.PageBlockAudio({
        audioId: BigInt(block.audio.id), caption,
      }) : undefined;
    }
    case 'document': {
      const caption = buildMtpPageCaption(block.caption);
      return caption && block.document.id ? new GramJs.PageBlockDocument({
        documentId: BigInt(block.document.id), caption,
      }) : undefined;
    }
    case 'collage':
    case 'slideshow':
      return buildMediaGroupPageBlock(block);
    case 'math':
      return new GramJs.PageBlockMath({ source: block.source });
    case 'list':
      return buildListPageBlock(block.items);
    case 'orderedList':
      return buildOrderedListPageBlock(block.items, block.start, block.orderType, block.isReversed);
    case 'details':
      return buildDetailsPageBlock(block.title, block.blocks, block.isOpen);
    case 'table':
      return buildTablePageBlock(block.title, block.rows, block.isBordered, block.isStriped, block.isCompact);
    default:
      return undefined;
  }
}

function buildPhotoPageBlock(block: Extract<ApiPageBlock, { type: 'photo' }>) {
  const caption = buildMtpPageCaption(block.caption);
  if (!caption) {
    return undefined;
  }

  return new GramJs.PageBlockPhoto({
    spoiler: block.isSpoiler,
    photoId: BigInt(block.photo.id),
    caption,
    url: block.url,
    webpageId: block.webPageId ? BigInt(block.webPageId) : undefined,
  });
}

function buildVideoPageBlock(block: Extract<ApiPageBlock, { type: 'video' }>) {
  const caption = buildMtpPageCaption(block.caption);
  if (!caption) {
    return undefined;
  }

  return new GramJs.PageBlockVideo({
    autoplay: block.isAutoplay,
    loop: block.isLoop,
    spoiler: block.isSpoiler,
    videoId: BigInt(block.video.id),
    caption,
  });
}

function buildMediaGroupPageBlock(block: Extract<ApiPageBlock, { type: 'collage' | 'slideshow' }>) {
  const items = block.items.map(buildMtpPageBlock);
  const caption = buildMtpPageCaption(block.caption);
  if (!items.length || items.some((item) => !item) || !caption) {
    return undefined;
  }

  const params = {
    items: items as GramJs.TypePageBlock[],
    caption,
  };
  return block.type === 'collage'
    ? new GramJs.PageBlockCollage(params)
    : new GramJs.PageBlockSlideshow(params);
}

function buildMtpPageCaption(caption: ApiPageCaption) {
  const text = buildMtpRichText(caption.text);
  const credit = buildMtpRichText(caption.credit);
  return text && credit ? new GramJs.PageCaption({ text, credit }) : undefined;
}

function buildRichMessageMedia(blocks: ApiPageBlock[]) {
  const photosById = new Map<string, GramJs.InputPhoto>();
  const documentsById = new Map<string, GramJs.InputDocument>();
  let isValid = true;

  blocks.forEach((block) => visitPageBlock(block, (mediaBlock) => {
    if (mediaBlock.type === 'photo') {
      const id = mediaBlock.photo.id;
      const photo = buildInputPhoto(mediaBlock.photo);
      if (!photo) {
        isValid = false;
        return;
      }

      photosById.set(id, photo);
      return;
    }

    const media = mediaBlock.type === 'document' ? mediaBlock.document
      : mediaBlock.type === 'audio' ? mediaBlock.audio : mediaBlock.video;
    const document = buildInputDocument(media);
    if (!document) {
      isValid = false;
      return;
    }

    documentsById.set(media.id!, document);
  }));

  return isValid ? {
    photos: Array.from(photosById.values()),
    documents: Array.from(documentsById.values()),
  } : undefined;
}

function visitPageBlock(
  block: ApiPageBlock,
  callback: (block: Extract<ApiPageBlock, { type: 'photo' | 'video' | 'audio' | 'document' }>) => void,
) {
  switch (block.type) {
    case 'photo':
    case 'video':
    case 'audio':
    case 'document':
      callback(block);
      break;
    case 'collage':
    case 'slideshow':
      block.items.forEach((item) => visitPageBlock(item, callback));
      break;
    case 'blockquoteBlocks':
    case 'details':
      block.blocks.forEach((item) => visitPageBlock(item, callback));
      break;
    case 'list':
    case 'orderedList':
      block.items.forEach((item) => {
        if (item.type === 'blocks') item.blocks.forEach((child) => visitPageBlock(child, callback));
      });
      break;
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
  canCollapse?: true,
): GramJs.TypePageBlock | undefined {
  const mtpText = buildMtpRichText(text);
  const mtpCaption = buildMtpRichText(caption);

  if (!mtpText || !mtpCaption) {
    return undefined;
  }

  return isPullquote
    ? new GramJs.PageBlockPullquote({ text: mtpText, caption: mtpCaption })
    : new GramJs.PageBlockBlockquote({ text: mtpText, caption: mtpCaption, collapsed: canCollapse });
}

function buildBlockquoteBlocksPageBlock(
  blocks: ApiPageBlock[],
  caption: ApiRichText,
) {
  const mtpBlocks = buildMtpPageBlocks(blocks);
  const mtpCaption = buildMtpRichText(caption);

  if (!mtpCaption || !mtpBlocks.length || mtpBlocks.some((block) => !block)) {
    return undefined;
  }

  return new GramJs.PageBlockBlockquoteBlocks({
    blocks: mtpBlocks as GramJs.TypePageBlock[],
    caption: mtpCaption,
  });
}

function buildDetailsPageBlock(
  title: ApiRichText,
  blocks: ApiPageBlock[],
  isOpen?: true,
) {
  const mtpTitle = buildMtpRichText(title);
  const mtpBlocks = buildMtpPageBlocks(blocks);

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
    case 'button':
      return hasRichText(normalizeButtonText(text.text))
        ? buildMtpRichButton(text, GramJs.TextButton) : new GramJs.TextEmpty();
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
  isCompact?: true,
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
    compact: isCompact,
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

  const blocks = buildMtpPageBlocks(item.blocks);
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

  const blocks = buildMtpPageBlocks(item.blocks);
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

function buildMtpRichButton<T extends GramJs.TextButton | GramJs.PageButton>(
  button: ApiRichButton,
  Constructor: new(options: ConstructorParameters<typeof GramJs.PageButton>[0]) => T,
): T | undefined {
  const type = buildInputInlineButtonAction(button.action);
  const text = buildMtpRichText(normalizeButtonText(button.text));
  if (!type || !text) return undefined;
  return new Constructor({
    text,
    type,
    style: button.style && new GramJs.RichButtonStyle({
      bgPrimary: button.style.type === 'primary' || undefined,
      bgDanger: button.style.type === 'destructive' || undefined,
      bgSuccess: button.style.type === 'success' || undefined,
      link: button.style.isLink || undefined,
    }),
  });
}

function buildInputInlineButtonAction(action: ApiInlineButtonAction): GramJs.TypeInlineButtonType | undefined {
  switch (action.type) {
    case 'url':
      return action.url ? new GramJs.InlineButtonTypeUrl({ url: action.url }) : undefined;
    case 'copy':
      return action.copyText ? new GramJs.InlineButtonTypeCopy({ copyText: action.copyText }) : undefined;
    case 'disabled':
      return new GramJs.InlineButtonTypeDisabled();
    case 'userProfile': {
      const userId = buildInputUserFromLocalDb(action.userId);
      return userId ? new GramJs.InputInlineButtonTypeUserProfile({
        userId,
      }) : undefined;
    }
    default:
      return undefined;
  }
}
