import { ApiMessage, ApiPhoto } from './messages';

type ApiChatType = (
  'chatTypePrivate' | 'chatTypeSecret' |
  'chatTypeBasicGroup' | 'chatTypeSuperGroup' |
  'chatTypeChannel'
);

export interface ApiChat {
  id: number;
  folderId?: number;
  type: ApiChatType;
  title?: string;
  hasUnreadMark?: boolean;
  lastMessage?: ApiMessage;
  lastReadOutboxMessageId?: number;
  lastReadInboxMessageId?: number;
  unreadCount?: number;
  unreadMentionsCount?: number;
  isVerified?: boolean;
  isMuted?: boolean;
  isSignaturesShown?: boolean;
  hasPrivateLink?: boolean;
  accessHash?: string;
  isMin?: boolean;
  avatarHash?: string;
  username?: string;
  membersCount?: number;
  joinDate?: number;
  isSupport?: boolean;
  photos?: ApiPhoto[];

  // Current user permissions
  isNotJoined?: boolean;
  isCreator?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
  adminRights?: ApiChatAdminRights;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;

  migratedTo?: {
    chatId: number;
    accessHash?: string;
  };

  // Obtained from GetFullChat / GetFullChannel
  fullInfo?: ApiChatFullInfo;
  // Obtained from GetOnlines
  onlineCount?: number;
  // Obtained with UpdateUserTyping or UpdateChatUserTyping updates
  typingStatus?: ApiTypingStatus;
}

export interface ApiTypingStatus {
  userId?: number;
  action: string;
  timestamp: number;
}

export interface ApiChatFullInfo {
  about?: string;
  members?: ApiChatMember[];
  kickedMembers?: ApiChatMember[];
  adminMembers?: ApiChatMember[];
  canViewMembers?: boolean;
  isPreHistoryHidden?: boolean;
  inviteLink?: string;
  slowMode?: {
    seconds: number;
    nextSendDate?: number;
  };
  migratedFrom?: {
    chatId: number;
    maxMessageId?: number;
  };
  linkedChatId?: number;
}

export interface ApiChatMember {
  userId: number;
  inviterId?: number;
  joinedDate?: number;
  kickedByUserId?: number;
  promotedByUserId?: number;
  bannedRights?: ApiChatBannedRights;
  adminRights?: ApiChatAdminRights;
  customTitle?: string;
  isAdmin?: true;
  isOwner?: true;
}

export interface ApiChatAdminRights {
  changeInfo?: true;
  postMessages?: true;
  editMessages?: true;
  deleteMessages?: true;
  banUsers?: true;
  inviteUsers?: true;
  pinMessages?: true;
  addAdmins?: true;
  anonymous?: true;
}

export interface ApiChatBannedRights {
  viewMessages?: true;
  sendMessages?: true;
  sendMedia?: true;
  sendStickers?: true;
  sendGifs?: true;
  sendGames?: true;
  sendInline?: true;
  embedLinks?: true;
  sendPolls?: true;
  changeInfo?: true;
  inviteUsers?: true;
  pinMessages?: true;
}

export interface ApiRestrictionReason {
  reason: string;
  text: string;
}

export interface ApiChatFolder {
  id: number;
  title: string;
  description?: string;
  emoticon?: string;
  contacts?: true;
  nonContacts?: true;
  groups?: true;
  channels?: true;
  bots?: true;
  excludeMuted?: true;
  excludeRead?: true;
  excludeArchived?: true;
  pinnedChatIds?: number[];
  includedChatIds: number[];
  excludedChatIds: number[];
}
