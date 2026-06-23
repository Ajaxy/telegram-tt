import type {
  ApiAudio,
  ApiDocument,
  ApiGeoPoint,
  ApiPhoto,
  ApiSticker,
  ApiVideo,
} from './messages';

export type ApiRichText =
  { type: 'empty' }
  | { type: 'plain'; text: string }
  | { type: 'bold'; text: ApiRichText }
  | { type: 'italic'; text: ApiRichText }
  | { type: 'underline'; text: ApiRichText }
  | { type: 'strike'; text: ApiRichText }
  | { type: 'fixed'; text: ApiRichText }
  | { type: 'url'; text: ApiRichText; url: string; webPageId?: string }
  | { type: 'email'; text: ApiRichText; email: string }
  | { type: 'concat'; texts: ApiRichText[] }
  | { type: 'subscript'; text: ApiRichText }
  | { type: 'superscript'; text: ApiRichText }
  | { type: 'marked'; text: ApiRichText }
  | { type: 'phone'; text: ApiRichText; phone: string }
  | { type: 'image'; document: ApiDocument; width: number; height: number }
  | { type: 'anchor'; text: ApiRichText; name: string }
  | { type: 'math'; source: string }
  | { type: 'customEmoji'; documentId: string; document?: ApiSticker; alt: string }
  | { type: 'spoiler'; text: ApiRichText }
  | { type: 'mention'; text: ApiRichText }
  | { type: 'hashtag'; text: ApiRichText }
  | { type: 'botCommand'; text: ApiRichText }
  | { type: 'cashtag'; text: ApiRichText }
  | { type: 'autoUrl'; text: ApiRichText }
  | { type: 'autoEmail'; text: ApiRichText }
  | { type: 'autoPhone'; text: ApiRichText }
  | { type: 'bankCard'; text: ApiRichText }
  | { type: 'mentionName'; text: ApiRichText; userId: string }
  | {
    type: 'date';
    text: ApiRichText;
    date: number;
    relative?: true;
    shortTime?: true;
    longTime?: true;
    shortDate?: true;
    longDate?: true;
    dayOfWeek?: true;
  };

export interface ApiPageCaption {
  text: ApiRichText;
  credit: ApiRichText;
}

export type ApiPageListItem = {
  type: 'text';
  text: ApiRichText;
  isCheckbox?: true;
  isChecked?: true;
} | {
  type: 'blocks';
  blocks: ApiPageBlock[];
  isCheckbox?: true;
  isChecked?: true;
};

export type ApiPageListOrderedItem = {
  type: 'text';
  num?: string;
  value?: number;
  orderType?: string;
  text: ApiRichText;
  isCheckbox?: true;
  isChecked?: true;
} | {
  type: 'blocks';
  num?: string;
  value?: number;
  orderType?: string;
  blocks: ApiPageBlock[];
  isCheckbox?: true;
  isChecked?: true;
};

export interface ApiPageTableCell {
  text?: ApiRichText;
  colspan?: number;
  rowspan?: number;
  isHeader?: true;
  alignCenter?: true;
  alignRight?: true;
  verticalAlignMiddle?: true;
  verticalAlignBottom?: true;
}

export interface ApiPageTableRow {
  cells: ApiPageTableCell[];
}

export interface ApiPageRelatedArticle {
  url: string;
  webPageId?: string;
  title?: string;
  description?: string;
  photo?: ApiPhoto;
  author?: string;
  publishedDate?: number;
}

export type ApiPageBlockBlockquote = {
  type: 'blockquote';
  text: ApiRichText;
  caption: ApiRichText;
};

export type ApiPageBlockPullquote = {
  type: 'pullquote';
  text: ApiRichText;
  caption: ApiRichText;
};

export type ApiPageBlockBlockquoteBlocks = {
  type: 'blockquoteBlocks';
  blocks: ApiPageBlock[];
  caption: ApiRichText;
};

export type ApiPageBlockPhoto = {
  type: 'photo';
  photo: ApiPhoto;
  caption: ApiPageCaption;
  url?: string;
  webPageId?: string;
  isSpoiler?: true;
};

export type ApiPageBlockVideo = {
  type: 'video';
  video: ApiVideo;
  caption: ApiPageCaption;
  isAutoplay?: true;
  isLoop?: true;
  isSpoiler?: true;
};

export type ApiPageBlockEmbed = {
  type: 'embed';
  caption: ApiPageCaption;
  url?: string;
  html?: string;
  posterPhoto?: ApiPhoto;
  width?: number;
  height?: number;
  isFullWidth?: true;
  shouldAllowScrolling?: true;
};

export type ApiPageBlockEmbedPost = {
  type: 'embedPost';
  url: string;
  webPageId?: string;
  authorPhoto: ApiPhoto;
  author: string;
  date: number;
  blocks: ApiPageBlock[];
  caption: ApiPageCaption;
};

export type ApiPageBlockDetails = {
  type: 'details';
  title: ApiRichText;
  blocks: ApiPageBlock[];
  isOpen?: true;
};

export type ApiPageBlockRelatedArticles = {
  type: 'relatedArticles';
  title: ApiRichText;
  articles: ApiPageRelatedArticle[];
};

export type ApiPageBlockMap = {
  type: 'map';
  geo?: ApiGeoPoint;
  zoom: number;
  width: number;
  height: number;
  caption: ApiPageCaption;
};

export type ApiPageBlockSlideshow = {
  type: 'slideshow';
  items: ApiPageBlock[];
  caption: ApiPageCaption;
};

export type ApiPageBlockCollage = {
  type: 'collage';
  items: ApiPageBlock[];
  caption: ApiPageCaption;
};

export type ApiPageBlockTable = {
  type: 'table';
  title: ApiRichText;
  rows: ApiPageTableRow[];
  isBordered?: true;
  isStriped?: true;
};

export type ApiPageBlockOrderedList = {
  type: 'orderedList';
  items: ApiPageListOrderedItem[];
  start?: number;
  orderType?: string;
  isReversed?: true;
};

export type ApiPageBlock =
  { type: 'unsupported' }
  | { type: 'title'; text: ApiRichText }
  | { type: 'subtitle'; text: ApiRichText }
  | { type: 'authorDate'; author: ApiRichText; publishedDate: number }
  | { type: 'header'; text: ApiRichText }
  | { type: 'subheader'; text: ApiRichText }
  | { type: 'paragraph'; text: ApiRichText }
  | { type: 'preformatted'; text: ApiRichText; language: string }
  | { type: 'footer'; text: ApiRichText }
  | { type: 'divider' }
  | { type: 'anchor'; name: string }
  | { type: 'list'; items: ApiPageListItem[] }
  | ApiPageBlockBlockquote
  | ApiPageBlockBlockquoteBlocks
  | ApiPageBlockPullquote
  | ApiPageBlockPhoto
  | ApiPageBlockVideo
  | { type: 'cover'; cover: ApiPageBlock }
  | ApiPageBlockEmbed
  | ApiPageBlockEmbedPost
  | ApiPageBlockCollage
  | ApiPageBlockSlideshow
  | { type: 'channel'; channelUsername: string; title: string }
  | { type: 'audio'; audio: ApiAudio; caption: ApiPageCaption }
  | { type: 'kicker'; text: ApiRichText }
  | ApiPageBlockTable
  | ApiPageBlockOrderedList
  | ApiPageBlockDetails
  | ApiPageBlockRelatedArticles
  | ApiPageBlockMap
  | { type: 'heading1'; text: ApiRichText }
  | { type: 'heading2'; text: ApiRichText }
  | { type: 'heading3'; text: ApiRichText }
  | { type: 'heading4'; text: ApiRichText }
  | { type: 'heading5'; text: ApiRichText }
  | { type: 'heading6'; text: ApiRichText }
  | { type: 'thinking'; text: ApiRichText }
  | { type: 'math'; source: string };

export interface ApiInstantViewPage {
  url: string;
  blocks: ApiPageBlock[];
  views?: number;
  isRtl?: true;
  isPart?: true;
  isV2?: true;
}
