import { ApiMessage, ApiPhoto } from './messages';
import { ApiBotCommand } from './bots';
import { ApiChatInviteImporter } from './misc';

type ApiChatType = (
  'chatTypePrivate' | 'chatTypeSecret' |
  'chatTypeBasicGroup' | 'chatTypeSuperGroup' |
  'chatTypeChannel'
);

export interface ApiChat {
  id: string;
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
  draftDate?: number;
  isProtected?: boolean;

  // Calls
  isCallActive?: boolean;
  isCallNotEmpty?: boolean;

  // Current user permissions
  isNotJoined?: boolean;
  isListed?: boolean;
  isCreator?: boolean;
  isRestricted?: boolean;
  restrictionReason?: ApiRestrictionReason;
  adminRights?: ApiChatAdminRights;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;

  migratedTo?: {
    chatId: string;
    accessHash?: string;
  };

  // Obtained from GetChatSettings
  settings?: ApiChatSettings;
  // Obtained from GetFullChat / GetFullChannel
  fullInfo?: ApiChatFullInfo;
  // Obtained with UpdateUserTyping or UpdateChatUserTyping updates
  typingStatus?: ApiTypingStatus;

  joinRequests?: ApiChatInviteImporter[];
  sendAsIds?: string[];
}

export interface ApiTypingStatus {
  userId?: string;
  action: string;
  timestamp: number;
  emoji?: string;
}

export interface ApiChatFullInfo {
  about?: string;
  onlineCount?: number;
  members?: ApiChatMember[];
  kickedMembers?: ApiChatMember[];
  adminMembers?: ApiChatMember[];
  canViewMembers?: boolean;
  isPreHistoryHidden?: boolean;
  inviteLink?: string;
  groupCallId?: string;
  slowMode?: {
    seconds: number;
    nextSendDate?: number;
  };
  migratedFrom?: {
    chatId: string;
    maxMessageId?: number;
  };
  linkedChatId?: string;
  botCommands?: ApiBotCommand[];
  enabledReactions?: string[];
  sendAsId?: string;
  canViewStatistics?: boolean;
  recentRequesterIds?: string[];
  requestsPending?: number;
  statisticsDcId?: number;
}

export interface ApiChatMember {
  userId: string;
  inviterId?: string;
  joinedDate?: number;
  kickedByUserId?: string;
  promotedByUserId?: string;
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
  manageCall?: true;
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
  untilDate?: number;
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
  pinnedChatIds?: string[];
  includedChatIds: string[];
  excludedChatIds: string[];
}

export interface ApiChatSettings {
  isAutoArchived?: boolean;
  canReportSpam?: boolean;
  canAddContact?: boolean;
  canBlockContact?: boolean;
}
