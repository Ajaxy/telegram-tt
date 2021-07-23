import { ApiPhoto } from './messages';

export interface ApiUser {
  id: number;
  isMin: boolean;
  isSelf?: true;
  isVerified?: true;
  isContact?: true;
  type: ApiUserType;
  firstName?: string;
  lastName?: string;
  status?: ApiUserStatus;
  username: string;
  phoneNumber: string;
  accessHash?: string;
  avatarHash?: string;
  photos?: ApiPhoto[];
  botPlaceholder?: string;
  canBeInvitedToGroup?: boolean;

  // Obtained from GetFullUser / UserFullInfo
  fullInfo?: ApiUserFullInfo;
}

export interface ApiUserFullInfo {
  isBlocked?: boolean;
  bio?: string;
  commonChatsCount?: number;
  botDescription?: string;
  pinnedMessageId?: number;
}

export type ApiUserType = 'userTypeBot' | 'userTypeRegular' | 'userTypeDeleted' | 'userTypeUnknown';

export interface ApiUserStatus {
  type: (
    'userStatusEmpty' | 'userStatusLastMonth' | 'userStatusLastWeek' |
    'userStatusOffline' | 'userStatusOnline' | 'userStatusRecently'
  );
  wasOnline?: number;
  expires?: number;
}
