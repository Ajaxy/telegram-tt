import type {
  ApiChatReactions, ApiMessage, ApiPhoto, ApiStickerSet,
} from './messages';
import type { ApiBotCommand } from './bots';
import type { ApiChatInviteImporter } from './misc';
import type { ApiFakeType, ApiUsername } from './users';

type ApiChatType = (
  'chatTypePrivate' | 'chatTypeSecret' |
  'chatTypeBasicGroup' | 'chatTypeSuperGroup' |
  'chatTypeChannel'
);

export interface ApiChat {
  id: string;
  folderId?: number;
  type: ApiChatType;
  title: string;
  hasUnreadMark?: boolean;
  lastMessage?: ApiMessage;
  lastReadOutboxMessageId?: number;
  lastReadInboxMessageId?: number;
  unreadCount?: number;
  unreadMentionsCount?: number;
  unreadReactionsCount?: number;
  isVerified?: boolean;
  isMuted?: boolean;
  isSignaturesShown?: boolean;
  hasPrivateLink?: boolean;
  accessHash?: string;
  isMin?: boolean;
  hasVideoAvatar?: boolean;
  avatarHash?: string;
  usernames?: ApiUsername[];
  membersCount?: number;
  joinDate?: number;
  isSupport?: boolean;
  photos?: ApiPhoto[];
  draftDate?: number;
  isProtected?: boolean;
  fakeType?: ApiFakeType;
  isForum?: boolean;
  topics?: Record<number, ApiTopic>;
  topicsCount?: number;
  orderedPinnedTopicIds?: number[];

  // Calls
  isCallActive?: boolean;
  isCallNotEmpty?: boolean;

  // Current user permissions
  isNotJoined?: boolean;
  isListed?: boolean;
  isCreator?: boolean;
  isForbidden?: boolean; // Forbidden - can't send messages (user was kicked, for example)
  isRestricted?: boolean; // Restricted - can't access the chat (user was banned or chat is violating rules)
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

  joinRequests?: ApiChatInviteImporter[];
  isJoinToSend?: boolean;
  isJoinRequest?: boolean;
  sendAsPeerIds?: ApiSendAsPeerId[];

  unreadReactions?: number[];
  unreadMentions?: number[];
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
  adminMembersById?: Record<string, ApiChatMember>;
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
  enabledReactions?: ApiChatReactions;
  sendAsId?: string;
  canViewStatistics?: boolean;
  recentRequesterIds?: string[];
  requestsPending?: number;
  statisticsDcId?: number;
  stickerSet?: ApiStickerSet;
  profilePhoto?: ApiPhoto;
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
  manageTopics?: true;
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
  manageTopics?: true;
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

export interface ApiSendAsPeerId {
  id: string;
  isPremium?: boolean;
}

export interface ApiTopic {
  id: number;
  isClosed?: boolean;
  isPinned?: boolean;
  isHidden?: boolean;
  isOwner?: boolean;
  // eslint-disable-next-line max-len
  // TODO[forums] https://github.com/telegramdesktop/tdesktop/blob/1aece79a471d99a8b63d826b1bce1f36a04d7293/Telegram/SourceFiles/data/data_forum_topic.cpp#L318
  isMin?: boolean;
  date: number;
  title: string;
  iconColor: number;
  iconEmojiId?: string;
  lastMessageId: number;
  unreadCount: number;
  unreadMentionsCount: number;
  unreadReactionsCount: number;
  fromId: string;

  isMuted?: boolean;
}
