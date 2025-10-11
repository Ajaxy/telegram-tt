import type { ApiPhoto } from './messages';

export interface ApiPeerPhotos {
  fallbackPhoto?: ApiPhoto;
  personalPhoto?: ApiPhoto;
  photos: ApiPhoto[];
  count: number;
  nextOffset?: number;
  isLoading?: boolean;
}

export type ApiFakeType = 'fake' | 'scam';

export interface ApiBotVerification {
  botId: string;
  iconId: string;
  description: string;
}

export type ApiEmojiStatusType = ApiEmojiStatus | ApiEmojiStatusCollectible;

export interface ApiEmojiStatus {
  type: 'regular';
  documentId: string;
  until?: number;
}

export interface ApiEmojiStatusCollectible {
  type: 'collectible';
  collectibleId: string;
  documentId: string;
  title: string;
  slug: string;
  patternDocumentId: string;
  centerColor: string;
  edgeColor: string;
  patternColor: string;
  textColor: string;
  until?: number;
}

export interface ApiPeerSettings {
  isAutoArchived?: boolean;
  canReportSpam?: boolean;
  canAddContact?: boolean;
  canBlockContact?: boolean;
  chargedPaidMessageStars?: number;
  registrationMonth?: string;
  phoneCountry?: string;
  nameChangeDate?: number;
  photoChangeDate?: number;
}

export interface ApiSendAsPeerId {
  id: string;
  isPremium?: boolean;
}

export interface ApiPeerColor {
  color?: number;
  backgroundEmojiId?: string;
}

export type ApiPeerColorSet = string[];
export type ApiPeerProfileColorSet = {
  paletteColors: string[];
  bgColors: string[];
  storyColors: string[];
};

export type ApiPeerColorOption<T extends ApiPeerColorSet | ApiPeerProfileColorSet> = {
  isHidden?: true;
  colors?: T;
  darkColors?: T;
};

export interface ApiPeerColors {
  general: Record<number, ApiPeerColorOption<ApiPeerColorSet>>;
  generalHash?: number;
  profile: Record<number, ApiPeerColorOption<ApiPeerProfileColorSet>>;
  profileHash?: number;
}

export type ApiProfileTab = 'stories' | 'gifts' | 'media' | 'documents' | 'audio' | 'voice' | 'links' | 'gif';
