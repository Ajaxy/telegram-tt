import type { ApiDocument, ApiPhoto } from './messages';
import type { ApiBotInfo } from './bots';
import type { API_CHAT_TYPES } from '../../config';

export interface ApiUser {
  id: string;
  isMin: boolean;
  isSelf?: true;
  isVerified?: true;
  isPremium?: boolean;
  isContact?: true;
  type: ApiUserType;
  firstName?: string;
  lastName?: string;
  noStatus?: boolean;
  usernames?: ApiUsername[];
  phoneNumber: string;
  accessHash?: string;
  hasVideoAvatar?: boolean;
  avatarHash?: string;
  photos?: ApiPhoto[];
  botPlaceholder?: string;
  canBeInvitedToGroup?: boolean;
  commonChats?: {
    ids: string[];
    maxId: string;
    isFullyLoaded: boolean;
  };
  fakeType?: ApiFakeType;
  isAttachBot?: boolean;
  emojiStatus?: ApiEmojiStatus;

  // Obtained from GetFullUser / UserFullInfo
  fullInfo?: ApiUserFullInfo;
}

export interface ApiUserFullInfo {
  isBlocked?: boolean;
  bio?: string;
  commonChatsCount?: number;
  pinnedMessageId?: number;
  botInfo?: ApiBotInfo;
  profilePhoto?: ApiPhoto;
  noVoiceMessages?: boolean;
  premiumGifts?: ApiPremiumGiftOption[];
}

export type ApiFakeType = 'fake' | 'scam';

export type ApiUserType = 'userTypeBot' | 'userTypeRegular' | 'userTypeDeleted' | 'userTypeUnknown';

export interface ApiUserStatus {
  type: (
    'userStatusEmpty' | 'userStatusLastMonth' | 'userStatusLastWeek' |
    'userStatusOffline' | 'userStatusOnline' | 'userStatusRecently'
  );
  wasOnline?: number;
  expires?: number;
}

export interface ApiUsername {
  username: string;
  isActive?: boolean;
  isEditable?: boolean;
}

export type ApiChatType = typeof API_CHAT_TYPES[number];
export type ApiAttachMenuPeerType = 'self' | ApiChatType;

export interface ApiAttachBot {
  id: string;
  hasSettings?: boolean;
  shouldRequestWriteAccess?: boolean;
  shortName: string;
  peerTypes: ApiAttachMenuPeerType[];
  icons: ApiAttachBotIcon[];
}

export interface ApiAttachBotIcon {
  name: string;
  document: ApiDocument;
}

export interface ApiPremiumGiftOption {
  months: number;
  currency: string;
  amount: number;
  botUrl: string;
}

export interface ApiEmojiStatus {
  documentId: string;
  until?: number;
}
