import type { ApiDocument, ApiPhoto } from './messages';
import type { ApiBotInfo } from './bots';

export interface ApiUser {
  id: string;
  isMin: boolean;
  isSelf?: true;
  isVerified?: true;
  isContact?: true;
  type: ApiUserType;
  firstName?: string;
  lastName?: string;
  noStatus?: boolean;
  username: string;
  phoneNumber: string;
  accessHash?: string;
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
  isAttachMenuBot?: boolean;

  // Obtained from GetFullUser / UserFullInfo
  fullInfo?: ApiUserFullInfo;
}

export interface ApiUserFullInfo {
  isBlocked?: boolean;
  bio?: string;
  commonChatsCount?: number;
  pinnedMessageId?: number;
  botInfo?: ApiBotInfo;
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

export interface ApiAttachMenuBot {
  id: string;
  shortName: string;
  icons: ApiAttachMenuBotIcon[];
}

export interface ApiAttachMenuBotIcon {
  name: string;
  document: ApiDocument;
}
