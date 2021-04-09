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

  // Obtained from GetFullUser / UserFullInfo
  fullInfo?: ApiUserFullInfo;
}

export interface ApiUserFullInfo {
  bio?: string;
  commonChatsCount?: number;
  botDescription?: string;
  pinnedMessageId?: number;
  isMuted?: boolean;
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
