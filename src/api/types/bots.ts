import type {
  ApiDimensions, ApiDocument,
  ApiPhoto, ApiReplyKeyboard,
  ApiSticker, ApiThumbnail,
  ApiVideo, MediaContainer,
  MediaContent,
} from './messages';

export type ApiInlineResultType = (
  'article' | 'audio' | 'contact' | 'document' | 'game' | 'gif' | 'location' | 'mpeg4_gif' |
  'photo' | 'sticker' | 'venue' | 'video' | 'voice' | 'file' | 'geo'
);

export interface ApiWebDocument {
  mediaType: 'webDocument';
  url: string;
  size: number;
  mimeType: string;
  accessHash?: string;
  dimensions?: ApiDimensions;
}

export type ApiBotInlineMessage = {
  content: MediaContent;
  replyMarkup?: ApiReplyKeyboard;
};

export interface ApiBotInlineResult {
  id: string;
  queryId: string;
  type: ApiInlineResultType;
  title?: string;
  description?: string;
  url?: string;
  content?: ApiWebDocument;
  webThumbnail?: ApiWebDocument;
  sendMessage: ApiBotInlineMessage;
}

export interface ApiBotInlineMediaResult {
  id: string;
  queryId: string;
  type: ApiInlineResultType;
  title?: string;
  description?: string;
  sticker?: ApiSticker;
  document?: ApiDocument;
  photo?: ApiPhoto;
  gif?: ApiVideo;
  thumbnail?: ApiThumbnail;
  sendMessage: ApiBotInlineMessage;
}

export interface ApiBotInlineSwitchPm {
  text: string;
  startParam: string;
}

export interface ApiBotInlineSwitchWebview {
  text: string;
  url: string;
}

export interface ApiBotCommand {
  botId: string;
  command: string;
  description: string;
}

type ApiBotMenuButtonCommands = {
  type: 'commands';
};

type ApiBotMenuButtonWebApp = {
  type: 'webApp';
  text: string;
  url: string;
};

export type ApiBotMenuButton = ApiBotMenuButtonWebApp | ApiBotMenuButtonCommands;

export interface ApiBotAppSettings {
  placeholderPath?: string;
  backgroundColor?: string;
  backgroundDarkColor?: string;
  headerColor?: string;
  headerDarkColor?: string;
}

export interface ApiBotInfo {
  botId: string;
  commands?: ApiBotCommand[];
  description?: string;
  photo?: ApiPhoto;
  gif?: ApiVideo;
  menuButton: ApiBotMenuButton;
  privacyPolicyUrl?: string;
  hasPreviewMedia?: true;
  appSettings?: ApiBotAppSettings;
}

export interface ApiBotPreviewMedia extends MediaContainer {
  date: number;
}
