import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiInstantViewPage,
  ApiPageBlock,
  ApiPageCaption,
  ApiPageListItem,
  ApiPageListOrderedItem,
  ApiPageRelatedArticle,
  ApiPageTableCell,
  ApiPageTableRow,
  ApiPhoto,
  ApiRichText,
} from '../../types';

import {
  addDocumentToLocalDb,
  addMessageRepairInfo,
  addPhotoToLocalDb,
  addWebPageRepairInfo,
  type MediaRepairContext,
} from '../helpers/localDb';
import { buildApiPhoto } from './common';
import { type ApiPageDocument, buildApiPageDocument } from './media';
import { buildGeoPoint } from './messageContent';
import { buildApiPeerId } from './peers';

type PageRepairContext = {
  message?: MediaRepairContext;
  webPage?: GramJs.TypeWebPage;
};

type PageMediaContext = {
  photosById: Record<string, ApiPhoto>;
  documentsById: Record<string, ApiPageDocument>;
};

export function buildApiInstantViewPage(page: GramJs.Page, webPage: GramJs.WebPage): ApiInstantViewPage {
  const {
    url, blocks, photos, documents, views, rtl, part, v2,
  } = page;
  const mediaContext = buildApiPageMediaContext(photos, documents, { webPage });

  return {
    url,
    blocks: blocks.map((block) => buildApiPageBlock(block, mediaContext)),
    views,
    isRtl: rtl,
    isPart: part,
    isV2: v2,
  };
}

export function buildApiPageMediaContext(
  photos: GramJs.TypePhoto[],
  documents: GramJs.TypeDocument[],
  context: PageRepairContext,
): PageMediaContext {
  // Add web page media to the context
  if (context.webPage instanceof GramJs.WebPage) {
    if (context.webPage.photo) photos.push(context.webPage.photo);
    if (context.webPage.document) documents.push(context.webPage.document);
  }

  return {
    photosById: buildApiPagePhotosById(photos, context),
    documentsById: buildApiPageDocumentsById(documents, context),
  };
}

function buildApiPagePhotosById(
  photos: GramJs.TypePhoto[],
  context?: PageRepairContext,
): Record<string, ApiPhoto> {
  photos.forEach((photo) => addPagePhotoToLocalDb(photo, context));

  return photos.reduce<Record<string, ApiPhoto>>((acc, photo) => {
    if (photo instanceof GramJs.Photo) {
      acc[String(photo.id)] = buildApiPhoto(photo);
    }

    return acc;
  }, {});
}

function buildApiPageDocumentsById(
  documents: GramJs.TypeDocument[],
  context?: PageRepairContext,
): Record<string, ApiPageDocument> {
  documents.forEach((document) => addPageDocumentToLocalDb(document, context));

  return documents.reduce<Record<string, ApiPageDocument>>((acc, document) => {
    const apiDocument = buildApiPageDocument(document);
    if (document instanceof GramJs.Document && apiDocument) {
      acc[String(document.id)] = apiDocument;
    }

    return acc;
  }, {});
}

export function buildApiRichText(text: GramJs.TypeRichText, context: PageMediaContext): ApiRichText {
  if (text instanceof GramJs.TextEmpty) {
    return { type: 'empty' };
  }

  if (text instanceof GramJs.TextPlain) {
    return { type: 'plain', text: text.text };
  }

  if (text instanceof GramJs.TextBold) {
    return { type: 'bold', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextItalic) {
    return { type: 'italic', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextUnderline) {
    return { type: 'underline', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextStrike) {
    return { type: 'strike', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextFixed) {
    return { type: 'fixed', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextUrl) {
    return {
      type: 'url',
      text: buildApiRichText(text.text, context),
      url: text.url,
      webPageId: text.webpageId ? text.webpageId.toString() : undefined, // Ignore 0n
    };
  }

  if (text instanceof GramJs.TextEmail) {
    return { type: 'email', text: buildApiRichText(text.text, context), email: text.email };
  }

  if (text instanceof GramJs.TextConcat) {
    return { type: 'concat', texts: text.texts.map((part) => buildApiRichText(part, context)) };
  }

  if (text instanceof GramJs.TextSubscript) {
    return { type: 'subscript', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextSuperscript) {
    return { type: 'superscript', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextMarked) {
    return { type: 'marked', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextPhone) {
    return { type: 'phone', text: buildApiRichText(text.text, context), phone: text.phone };
  }

  if (text instanceof GramJs.TextImage) {
    const document = getPageDocument(context, text.documentId);
    if (document?.mediaType !== 'document') {
      return { type: 'empty' };
    }

    return {
      type: 'image',
      document,
      width: text.w,
      height: text.h,
    };
  }

  if (text instanceof GramJs.TextAnchor) {
    return { type: 'anchor', text: buildApiRichText(text.text, context), name: text.name };
  }

  if (text instanceof GramJs.TextMath) {
    return { type: 'math', source: text.source };
  }

  if (text instanceof GramJs.TextCustomEmoji) {
    const document = getPageDocument(context, text.documentId);

    return {
      type: 'customEmoji',
      documentId: text.documentId.toString(),
      document: document?.mediaType === 'sticker' ? document : undefined,
      alt: text.alt,
    };
  }

  if (text instanceof GramJs.TextSpoiler) {
    return { type: 'spoiler', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextMention) {
    return { type: 'mention', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextHashtag) {
    return { type: 'hashtag', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextBotCommand) {
    return { type: 'botCommand', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextCashtag) {
    return { type: 'cashtag', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextAutoUrl) {
    return { type: 'autoUrl', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextAutoEmail) {
    return { type: 'autoEmail', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextAutoPhone) {
    return { type: 'autoPhone', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextBankCard) {
    return { type: 'bankCard', text: buildApiRichText(text.text, context) };
  }

  if (text instanceof GramJs.TextMentionName) {
    return {
      type: 'mentionName',
      text: buildApiRichText(text.text, context),
      userId: buildApiPeerId(text.userId, 'user'),
    };
  }

  if (text instanceof GramJs.TextDate) {
    return {
      type: 'date',
      text: buildApiRichText(text.text, context),
      date: text.date,
      relative: text.relative,
      shortTime: text.shortTime,
      longTime: text.longTime,
      shortDate: text.shortDate,
      longDate: text.longDate,
      dayOfWeek: text.dayOfWeek,
    };
  }

  return { type: 'empty' };
}

export function buildApiPageBlock(block: GramJs.TypePageBlock, context: PageMediaContext): ApiPageBlock {
  if (block instanceof GramJs.PageBlockUnsupported) {
    return { type: 'unsupported' };
  }

  if (block instanceof GramJs.PageBlockTitle) {
    return { type: 'title', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockSubtitle) {
    return { type: 'subtitle', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockAuthorDate) {
    return {
      type: 'authorDate',
      author: buildApiRichText(block.author, context),
      publishedDate: block.publishedDate,
    };
  }

  if (block instanceof GramJs.PageBlockHeader) {
    return { type: 'header', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockSubheader) {
    return { type: 'subheader', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockParagraph) {
    return { type: 'paragraph', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockPreformatted) {
    return { type: 'preformatted', text: buildApiRichText(block.text, context), language: block.language };
  }

  if (block instanceof GramJs.PageBlockFooter) {
    return { type: 'footer', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockDivider) {
    return { type: 'divider' };
  }

  if (block instanceof GramJs.PageBlockAnchor) {
    return { type: 'anchor', name: block.name };
  }

  if (block instanceof GramJs.PageBlockList) {
    return { type: 'list', items: block.items.map((item) => buildApiPageListItem(item, context)) };
  }

  if (block instanceof GramJs.PageBlockBlockquote) {
    return {
      type: 'blockquote',
      text: buildApiRichText(block.text, context),
      caption: buildApiRichText(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockBlockquoteBlocks) {
    return {
      type: 'blockquoteBlocks',
      blocks: block.blocks.map((childBlock) => buildApiPageBlock(childBlock, context)),
      caption: buildApiRichText(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockPullquote) {
    return {
      type: 'pullquote',
      text: buildApiRichText(block.text, context),
      caption: buildApiRichText(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockPhoto) {
    const photo = getPagePhoto(context, block.photoId);
    if (!photo) {
      return { type: 'unsupported' };
    }

    return {
      type: 'photo',
      photo,
      caption: buildApiPageCaption(block.caption, context),
      url: block.url,
      webPageId: block.webpageId ? block.webpageId.toString() : undefined,
      isSpoiler: block.spoiler,
    };
  }

  if (block instanceof GramJs.PageBlockVideo) {
    const video = getPageDocument(context, block.videoId);
    if (video?.mediaType !== 'video') {
      return { type: 'unsupported' };
    }

    return {
      type: 'video',
      video,
      caption: buildApiPageCaption(block.caption, context),
      isAutoplay: block.autoplay,
      isLoop: block.loop,
      isSpoiler: block.spoiler,
    };
  }

  if (block instanceof GramJs.PageBlockCover) {
    return { type: 'cover', cover: buildApiPageBlock(block.cover, context) };
  }

  if (block instanceof GramJs.PageBlockEmbed) {
    const posterPhoto = block.posterPhotoId ? getPagePhoto(context, block.posterPhotoId) : undefined;
    if (block.posterPhotoId && !posterPhoto) {
      return { type: 'unsupported' };
    }

    return {
      type: 'embed',
      caption: buildApiPageCaption(block.caption, context),
      url: block.url,
      html: block.html,
      posterPhoto,
      width: block.w,
      height: block.h,
      isFullWidth: block.fullWidth,
      shouldAllowScrolling: block.allowScrolling,
    };
  }

  if (block instanceof GramJs.PageBlockEmbedPost) {
    const authorPhoto = getPagePhoto(context, block.authorPhotoId);
    if (!authorPhoto) {
      return { type: 'unsupported' };
    }

    return {
      type: 'embedPost',
      url: block.url,
      webPageId: block.webpageId ? block.webpageId.toString() : undefined,
      authorPhoto,
      author: block.author,
      date: block.date,
      blocks: block.blocks.map((childBlock) => buildApiPageBlock(childBlock, context)),
      caption: buildApiPageCaption(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockCollage) {
    return {
      type: 'collage',
      items: block.items.map((item) => buildApiPageBlock(item, context)),
      caption: buildApiPageCaption(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockSlideshow) {
    return {
      type: 'slideshow',
      items: block.items.map((item) => buildApiPageBlock(item, context)),
      caption: buildApiPageCaption(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockChannel) {
    const { channel } = block;
    const channelUsername = ('username' in channel && channel.username)
      || ('usernames' in channel && channel.usernames?.[0]?.username);
    if (!channelUsername || !('title' in channel)) {
      return { type: 'unsupported' };
    }

    return {
      type: 'channel',
      channelUsername,
      title: channel.title,
    };
  }

  if (block instanceof GramJs.PageBlockAudio) {
    const audio = getPageDocument(context, block.audioId);
    if (audio?.mediaType !== 'audio') {
      return { type: 'unsupported' };
    }

    return { type: 'audio', audio, caption: buildApiPageCaption(block.caption, context) };
  }

  if (block instanceof GramJs.PageBlockKicker) {
    return { type: 'kicker', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockTable) {
    return {
      type: 'table',
      title: buildApiRichText(block.title, context),
      rows: block.rows.map((row) => buildApiPageTableRow(row, context)),
      isBordered: block.bordered,
      isStriped: block.striped,
    };
  }

  if (block instanceof GramJs.PageBlockOrderedList) {
    return {
      type: 'orderedList',
      items: block.items.map((item) => buildApiPageListOrderedItem(item, context)),
      start: block.start,
      orderType: block.type,
      isReversed: block.reversed,
    };
  }

  if (block instanceof GramJs.PageBlockDetails) {
    return {
      type: 'details',
      title: buildApiRichText(block.title, context),
      blocks: block.blocks.map((childBlock) => buildApiPageBlock(childBlock, context)),
      isOpen: block.open,
    };
  }

  if (block instanceof GramJs.PageBlockRelatedArticles) {
    const articles = block.articles.map((article) => buildApiPageRelatedArticle(article, context));
    if (articles.every((article) => !article)) {
      return { type: 'unsupported' };
    }

    return {
      type: 'relatedArticles',
      title: buildApiRichText(block.title, context),
      articles: articles.filter(Boolean),
    };
  }

  if (block instanceof GramJs.PageBlockMap) {
    return {
      type: 'map',
      geo: buildGeoPoint(block.geo),
      zoom: block.zoom,
      width: block.w,
      height: block.h,
      caption: buildApiPageCaption(block.caption, context),
    };
  }

  if (block instanceof GramJs.PageBlockHeading1) {
    return { type: 'heading1', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockHeading2) {
    return { type: 'heading2', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockHeading3) {
    return { type: 'heading3', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockHeading4) {
    return { type: 'heading4', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockHeading5) {
    return { type: 'heading5', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockHeading6) {
    return { type: 'heading6', text: buildApiRichText(block.text, context) };
  }

  if (block instanceof GramJs.PageBlockMath) {
    return { type: 'math', source: block.source };
  }

  if (block instanceof GramJs.PageBlockThinking) {
    return { type: 'thinking', text: buildApiRichText(block.text, context) };
  }

  return { type: 'unsupported' };
}

function buildApiPageCaption(caption: GramJs.TypePageCaption, context: PageMediaContext): ApiPageCaption {
  return {
    text: buildApiRichText(caption.text, context),
    credit: buildApiRichText(caption.credit, context),
  };
}

function buildApiPageListItem(item: GramJs.TypePageListItem, context: PageMediaContext): ApiPageListItem {
  if (item instanceof GramJs.PageListItemText) {
    return {
      type: 'text',
      text: buildApiRichText(item.text, context),
      isCheckbox: item.checkbox,
      isChecked: item.checked,
    };
  }

  return {
    type: 'blocks',
    blocks: item.blocks.map((block) => buildApiPageBlock(block, context)),
    isCheckbox: item.checkbox,
    isChecked: item.checked,
  };
}

function buildApiPageListOrderedItem(
  item: GramJs.TypePageListOrderedItem,
  context: PageMediaContext,
): ApiPageListOrderedItem {
  if (item instanceof GramJs.PageListOrderedItemText) {
    return {
      type: 'text',
      num: item.num,
      value: item.value,
      orderType: item.type,
      text: buildApiRichText(item.text, context),
      isCheckbox: item.checkbox,
      isChecked: item.checked,
    };
  }

  return {
    type: 'blocks',
    num: item.num,
    value: item.value,
    orderType: item.type,
    blocks: item.blocks.map((block) => buildApiPageBlock(block, context)),
    isCheckbox: item.checkbox,
    isChecked: item.checked,
  };
}

function buildApiPageTableCell(cell: GramJs.TypePageTableCell, context: PageMediaContext): ApiPageTableCell {
  return {
    text: cell.text && buildApiRichText(cell.text, context),
    colspan: cell.colspan,
    rowspan: cell.rowspan,
    isHeader: cell.header,
    alignCenter: cell.alignCenter,
    alignRight: cell.alignRight,
    verticalAlignMiddle: cell.valignMiddle,
    verticalAlignBottom: cell.valignBottom,
  };
}

function buildApiPageTableRow(row: GramJs.TypePageTableRow, context: PageMediaContext): ApiPageTableRow {
  return {
    cells: row.cells.map((cell) => buildApiPageTableCell(cell, context)),
  };
}

function buildApiPageRelatedArticle(
  article: GramJs.TypePageRelatedArticle,
  context: PageMediaContext,
): ApiPageRelatedArticle | undefined {
  const photo = article.photoId ? getPagePhoto(context, article.photoId) : undefined;
  if (article.photoId && !photo) {
    return undefined;
  }

  return {
    url: article.url,
    webPageId: article.webpageId ? article.webpageId.toString() : undefined, // Ignore 0n
    title: article.title,
    description: article.description,
    photo,
    author: article.author,
    publishedDate: article.publishedDate,
  };
}

function getPagePhoto(context: PageMediaContext, id: bigint): ApiPhoto | undefined {
  return context.photosById[id.toString()];
}

function getPageDocument(context: PageMediaContext, id: bigint): ApiPageDocument | undefined {
  return context.documentsById[id.toString()];
}

function addPagePhotoToLocalDb(photo: GramJs.TypePhoto, context?: PageRepairContext) {
  let repairablePhoto = photo;
  if (context?.message) {
    repairablePhoto = addMessageRepairInfo(photo, context.message);
  } else if (context?.webPage) {
    repairablePhoto = addWebPageRepairInfo(photo, context.webPage);
  }

  addPhotoToLocalDb(repairablePhoto);
}

function addPageDocumentToLocalDb(document: GramJs.TypeDocument, context?: PageRepairContext) {
  let repairableDocument = document;
  if (context?.message) {
    repairableDocument = addMessageRepairInfo(document, context.message);
  } else if (context?.webPage) {
    repairableDocument = addWebPageRepairInfo(document, context.webPage);
  }

  addDocumentToLocalDb(repairableDocument);
}
