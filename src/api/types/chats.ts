import type { ApiBotCommand } from './bots';
import type {
  ApiChatReactions, ApiFormattedText, ApiInputMessageReplyInfo, ApiInputSuggestedPostInfo, ApiPhoto, ApiStickerSet,
} from './messages';
import type { ApiChatInviteImporter, ApiRestrictionReason } from './misc';
import type {
  ApiBotVerification,
  ApiEmojiStatusType,
  ApiFakeType,
  ApiProfileTab,
  ApiSendAsPeerId,
  ApiTypePeerColor,
} from './peers';
import type {
  ApiUser, ApiUsername,
} from './users';

type ApiChatType = (
  'chatTypePrivate' | 'chatTypeSecret' |
  'chatTypeBasicGroup' | 'chatTypeSuperGroup' |
  'chatTypeChannel'
);

export type ApiPeer = ApiChat | ApiUser;

export interface ApiChat {
  id: string;
  folderId?: number;
  type: ApiChatType;
  title: string;
  hasUnreadMark?: boolean;
  lastReadOutboxMessageId?: number;
  lastReadInboxMessageId?: number;
  unreadCount?: number;
  unreadMentionsCount?: number;
  unreadReactionsCount?: number;
  isVerified?: true;
  areSignaturesShown?: boolean;
  areProfilesShown?: boolean;
  isLinkedInDiscussion?: boolean;
  hasGeo?: boolean;
  accessHash?: string;
  isMin?: boolean;
  hasVideoAvatar?: boolean;
  avatarPhotoId?: string;
  usernames?: ApiUsername[];
  hasUsername?: boolean;
  membersCount?: number;
  creationDate?: number;
  isSupport?: true;
  draftDate?: number;
  isProtected?: boolean;
  fakeType?: ApiFakeType;
  color?: ApiTypePeerColor;
  profileColor?: ApiTypePeerColor;
  emojiStatus?: ApiEmojiStatusType;
  isForum?: boolean;
  isForumAsMessages?: true;
  isMonoforum?: boolean;
  withForumTabs?: boolean;
  linkedMonoforumId?: string;
  areChannelMessagesAllowed?: boolean;
  boostLevel?: number;
  botVerificationIconId?: string;
  hasAutoTranslation?: true;
  level?: number;

  // Calls
  isCallActive?: boolean;
  isCallNotEmpty?: boolean;

  // Current user permissions
  isNotJoined?: boolean;
  isListed?: boolean;
  isCreator?: boolean;
  isForbidden?: boolean; // Forbidden - can't send messages (user was kicked, for example)
  isRestricted?: boolean; // Restricted - can't access the chat (user was banned or chat is violating rules)
  restrictionReasons?: ApiRestrictionReason[];
  adminRights?: ApiChatAdminRights;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;

  migratedTo?: {
    chatId: string;
    accessHash?: string;
  };

  joinRequests?: ApiChatInviteImporter[];
  isJoinToSend?: boolean;
  isJoinRequest?: boolean;
  sendAsPeerIds?: ApiSendAsPeerId[];
  sendPaidReactionsAsPeerIds?: ApiSendAsPeerId[];
  sendPaidReactionsPeer?: ApiSendAsPeerId;

  unreadReactions?: number[];
  unreadMentions?: number[];

  // Stories
  areStoriesHidden?: boolean;
  hasStories?: boolean;
  hasUnreadStories?: boolean;
  maxStoryId?: number;

  subscriptionUntil?: number;

  // Locally determined field
  detectedLanguage?: string;

  paidMessagesStars?: number;
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
  joinInfo?: {
    joinedDate: number;
    inviterId?: string;
    isViaRequest?: boolean;
  };
  linkedChatId?: string;
  botCommands?: ApiBotCommand[];
  enabledReactions?: ApiChatReactions;
  reactionsLimit?: number;
  sendAsId?: string;
  canViewStatistics?: boolean;
  canViewMonetization?: boolean;
  recentRequesterIds?: string[];
  requestsPending?: number;
  statisticsDcId?: number;
  stickerSet?: ApiStickerSet;
  emojiSet?: ApiStickerSet;
  profilePhoto?: ApiPhoto;
  areParticipantsHidden?: boolean;
  isTranslationDisabled?: true;
  hasPinnedStories?: boolean;
  isPaidReactionAvailable?: boolean;
  hasScheduledMessages?: boolean;
  starGiftCount?: number;
  areStarGiftsAvailable?: boolean;
  arePaidMessagesAvailable?: true;

  boostsApplied?: number;
  boostsToUnrestrict?: number;
  botVerification?: ApiBotVerification;
  mainTab?: ApiProfileTab;
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
  isViaRequest?: true;
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
  postStories?: true;
  editStories?: true;
  deleteStories?: true;
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
  manageTopics?: true;
  sendPhotos?: true;
  sendVideos?: true;
  sendRoundvideos?: true;
  sendAudios?: true;
  sendVoices?: true;
  sendDocs?: true;
  sendPlain?: true;
  untilDate?: number;
}

export interface ApiChatFolder {
  id: number;
  title: ApiFormattedText;
  noTitleAnimations?: true;
  description?: string;
  emoticon?: string;
  contacts?: true;
  nonContacts?: true;
  groups?: true;
  channels?: true;
  bots?: true;
  color?: number;
  excludeMuted?: true;
  excludeRead?: true;
  excludeArchived?: true;
  pinnedChatIds?: string[];
  includedChatIds: string[];
  excludedChatIds: string[];
  isChatList?: true;
  hasMyInvites?: true;
}

export interface ApiChatlistInviteNew {
  title: ApiFormattedText;
  noTitleAnimations?: true;
  emoticon?: string;
  peerIds: string[];
  slug: string;
}

export interface ApiChatlistInviteAlready {
  folderId: number;
  missingPeerIds: string[];
  alreadyPeerIds: string[];
  slug: string;
}

export type ApiChatlistInvite = ApiChatlistInviteNew | ApiChatlistInviteAlready;

export interface ApiChatlistExportedInvite {
  title: string;
  url: string;
  peerIds: string[];
}

export interface ApiMissingInvitedUser {
  id: string;
  isRequiringPremiumToInvite?: boolean;
  isRequiringPremiumToMessage?: boolean;
}

export interface ApiChatLink {
  chatId: string;
  text: ApiFormattedText;
}

export type ApiDraft = {
  text?: ApiFormattedText;
  replyInfo?: ApiInputMessageReplyInfo;
  suggestedPostInfo?: ApiInputSuggestedPostInfo;
  date?: number;
  effectId?: string;
  isLocal?: boolean;
};

export type ApiSponsoredPeer = {
  randomId: string;
  peerId: string;
  sponsorInfo?: string;
  additionalInfo?: string;
};
