import {
  ApiPhoto, ApiSticker, ApiThumbnail, ApiVideo,
} from './messages';

export type ApiInlineResultType = (
  'article' | 'audio' | 'contact' | 'document' | 'game' | 'gif' | 'location' | 'mpeg4_gif' |
  'photo' | 'sticker' | 'venue' | 'video' | 'voice' | 'file'
);

export interface ApiWebDocument {
  url: string;
  mimeType: string;
}

export interface ApiBotInlineResult {
  id: string;
  queryId: string;
  type: ApiInlineResultType;
  title?: string;
  description?: string;
  url?: string;
  webThumbnail?: ApiWebDocument;
}

export interface ApiBotInlineMediaResult {
  id: string;
  queryId: string;
  type: ApiInlineResultType;
  title?: string;
  description?: string;
  sticker?: ApiSticker;
  photo?: ApiPhoto;
  gif?: ApiVideo;
  thumbnail?: ApiThumbnail;
}

export interface ApiBotInlineSwitchPm {
  text: string;
  startParam: string;
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

export interface ApiBotInfo {
  botId: string;
  commands?: ApiBotCommand[];
  description: string;
  menuButton: ApiBotMenuButton;
}
