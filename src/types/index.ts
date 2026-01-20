import type { TeactNode } from '../lib/teact/teact';

import type {
  ApiAttachment,
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotInlineSwitchPm,
  ApiBotInlineSwitchWebview,
  ApiChat,
  ApiChatInviteImporter,
  ApiContact,
  ApiDisallowedGiftsSettings,
  ApiDocument,
  ApiDraft,
  ApiExportedInvite,
  ApiFakeType,
  ApiFormattedText,
  ApiInputReplyInfo,
  ApiInputSuggestedPostInfo,
  ApiLabeledPrice,
  ApiMediaFormat,
  ApiMessage,
  ApiMessageEntity,
  ApiNewMediaTodo,
  ApiNewPoll,
  ApiPeer,
  ApiPhoto,
  ApiReaction,
  ApiReactionWithPaid,
  ApiStarGiftAttributeIdBackdrop,
  ApiStarGiftAttributeIdPattern,
  ApiStarGiftRegular,
  ApiStarsSubscription,
  ApiStarsTransaction,
  ApiSticker,
  ApiStickerSet,
  ApiStory,
  ApiStorySkipped,
  ApiThreadInfo,
  ApiTopic,
  ApiTypingStatus,
  ApiVideo,
  MediaContent,
  StarGiftAttributeIdModel,
} from '../api/types';
import type { DC_IDS } from '../config';
import type { SearchResultKey } from '../util/keys/searchResultKey';
import type { IconName } from './icons';

export type TextPart = TeactNode;

export type DcId = typeof DC_IDS[number];

export type SessionUserInfo = {
  userId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUri?: string;
  color?: number;
  isPremium?: boolean;
  emojiStatusId?: string;
};

export type SharedSessionData = {
  date?: number;
  dcId: number;
  isTest?: true;
} & Partial<Record<`dc${DcId}_${'auth_key' | 'server_salt'}`, string>> & SessionUserInfo;

export type AccountInfo = {
  isTest?: true;
} & SessionUserInfo;

export enum LoadMoreDirection {
  Backwards,
  Forwards,
  Around,
}

export enum FocusDirection {
  Up,
  Down,
  Static,
}

export type ScrollTargetPosition = ScrollLogicalPosition | 'centerOrTop';

export interface IAlbum {
  albumId: string;
  messages: ApiMessage[];
  isPaidMedia?: boolean;
  mainMessage: ApiMessage;
  captionMessage?: ApiMessage;
  hasMultipleCaptions: boolean;
  commentsMessage?: ApiMessage;
}

export type ThreadId = string | number;

export type ThemeKey = 'light' | 'dark';
export type AnimationLevel = 0 | 1 | 2;
export type FoldersPosition = 'top' | 'left';
export type PerformanceTypeKey = (
  'pageTransitions' | 'messageSendingAnimations' | 'mediaViewerAnimations'
  | 'messageComposerAnimations' | 'contextMenuAnimations' | 'contextMenuBlur' | 'rightColumnAnimations'
  | 'animatedEmoji' | 'loopAnimatedStickers' | 'reactionEffects' | 'stickerEffects' | 'autoplayGifs' | 'autoplayVideos'
  | 'storyRibbonAnimations' | 'snapEffect'
);
export type PerformanceType = Record<PerformanceTypeKey, boolean>;

export interface IThemeSettings {
  background?: string;
  backgroundColor?: string;
  patternColor?: string;
  isBlurred?: boolean;
}

export type LangCode = (
  'en' | 'ar' | 'be' | 'ca' | 'nl' | 'fr' | 'de' | 'id' | 'it' | 'ko' | 'ms' | 'fa' | 'pl' | 'pt-br' | 'ru' | 'es'
  | 'tr' | 'uk' | 'uz'
);

export type TimeFormat = '24h' | '12h';

export interface AccountSettings {
  hasWebNotifications: boolean;
  hasPushNotifications: boolean;
  hasContactJoinedNotifications?: boolean;
  notificationSoundVolume: number;
  canAutoLoadPhotoFromContacts: boolean;
  canAutoLoadPhotoInPrivateChats: boolean;
  canAutoLoadPhotoInGroups: boolean;
  canAutoLoadPhotoInChannels: boolean;
  canAutoLoadVideoFromContacts: boolean;
  canAutoLoadVideoInPrivateChats: boolean;
  canAutoLoadVideoInGroups: boolean;
  canAutoLoadVideoInChannels: boolean;
  canAutoLoadFileFromContacts: boolean;
  canAutoLoadFileInPrivateChats: boolean;
  canAutoLoadFileInGroups: boolean;
  canAutoLoadFileInChannels: boolean;
  autoLoadFileMaxSizeMb: number;
  shouldSuggestStickers: boolean;
  shouldSuggestCustomEmoji: boolean;
  shouldUpdateStickerSetOrder: boolean;
  hasPassword?: boolean;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  shouldArchiveAndMuteNewNonContact?: boolean;
  shouldNewNonContactPeersRequirePremium?: boolean;
  nonContactPeersPaidStars?: number;
  shouldDisplayGiftsButton?: boolean;
  disallowedGifts?: ApiDisallowedGiftsSettings;
  shouldHideReadMarks?: boolean;
  canTranslate: boolean;
  canTranslateChats: boolean;
  translationLanguage?: string;
  doNotTranslate: string[];
  shouldPaidMessageAutoApprove: boolean;
}

export type IAnchorPosition = {
  x: number;
  y: number;
  width?: number;
  height?: number;
};

export interface ShippingOption {
  id: string;
  title: string;
  amount: number;
  prices: ApiLabeledPrice[];
}

export enum SettingsScreens {
  Main,
  EditProfile,
  Notifications,
  DataStorage,
  Language,
  ActiveSessions,
  General,
  GeneralChatBackground,
  GeneralChatBackgroundColor,
  Privacy,
  PrivacyPhoneNumber,
  PrivacyAddByPhone,
  PrivacyLastSeen,
  PrivacyProfilePhoto,
  PrivacyBio,
  PrivacyBirthday,
  PrivacyGifts,
  PrivacyPhoneCall,
  PrivacyPhoneP2P,
  PrivacyForwarding,
  PrivacyVoiceMessages,
  PrivacyMessages,
  PrivacyGroupChats,
  PrivacyPhoneNumberAllowedContacts,
  PrivacyPhoneNumberDeniedContacts,
  PrivacyLastSeenAllowedContacts,
  PrivacyLastSeenDeniedContacts,
  PrivacyProfilePhotoAllowedContacts,
  PrivacyProfilePhotoDeniedContacts,
  PrivacyBioAllowedContacts,
  PrivacyBioDeniedContacts,
  PrivacyBirthdayAllowedContacts,
  PrivacyBirthdayDeniedContacts,
  PrivacyGiftsAllowedContacts,
  PrivacyGiftsDeniedContacts,
  PrivacyPhoneCallAllowedContacts,
  PrivacyPhoneCallDeniedContacts,
  PrivacyPhoneP2PAllowedContacts,
  PrivacyPhoneP2PDeniedContacts,
  PrivacyForwardingAllowedContacts,
  PrivacyForwardingDeniedContacts,
  PrivacyVoiceMessagesAllowedContacts,
  PrivacyVoiceMessagesDeniedContacts,
  PrivacyGroupChatsAllowedContacts,
  PrivacyGroupChatsDeniedContacts,
  PrivacyBlockedUsers,
  PrivacyNoPaidMessages,
  Performance,
  Folders,
  FoldersCreateFolder,
  FoldersEditFolder,
  FoldersEditFolderFromChatList,
  FoldersEditFolderInvites,
  FoldersIncludedChats,
  FoldersIncludedChatsFromChatList,
  FoldersExcludedChats,
  FoldersExcludedChatsFromChatList,
  TwoFaDisabled,
  TwoFaNewPassword,
  TwoFaNewPasswordConfirm,
  TwoFaNewPasswordHint,
  TwoFaNewPasswordEmail,
  TwoFaNewPasswordEmailCode,
  TwoFaEnabled,
  TwoFaChangePasswordCurrent,
  TwoFaChangePasswordNew,
  TwoFaChangePasswordConfirm,
  TwoFaChangePasswordHint,
  TwoFaTurnOff,
  TwoFaRecoveryEmailCurrentPassword,
  TwoFaRecoveryEmail,
  TwoFaRecoveryEmailCode,
  TwoFaCongratulations,
  ActiveWebsites,
  PasscodeDisabled,
  PasscodeNewPasscode,
  PasscodeNewPasscodeConfirm,
  PasscodeEnabled,
  PasscodeChangePasscodeCurrent,
  PasscodeChangePasscodeNew,
  PasscodeChangePasscodeConfirm,
  PasscodeTurnOff,
  PasscodeCongratulations,
  Experimental,
  Stickers,
  QuickReaction,
  CustomEmoji,
  DoNotTranslate,
  FoldersShare,
  Passkeys,
}

export type StickerSetOrReactionsSetOrRecent = Pick<ApiStickerSet, (
  'id' | 'accessHash' | 'title' | 'count' | 'stickers' | 'isEmoji' | 'installedDate' | 'isArchived' |
  'hasThumbnail' | 'hasStaticThumb' | 'hasAnimatedThumb' | 'hasVideoThumb' | 'thumbCustomEmojiId'
)> & { reactions?: ApiReactionWithPaid[] };

export enum LeftColumnContent {
  ChatList,
  GlobalSearch,
  Settings,
  Contacts,
  Archived,
  NewChannelStep1,
  NewChannelStep2,
  NewGroupStep1,
  NewGroupStep2,
}

export enum GlobalSearchContent {
  ChatList,
  ChannelList,
  BotApps,
  PublicPosts,
  Media,
  Links,
  Files,
  Music,
  Voice,
}

export enum RightColumnContent {
  ChatInfo,
  Management,
  Statistics,
  BoostStatistics,
  MessageStatistics,
  StoryStatistics,
  StickerSearch,
  GifSearch,
  PollResults,
  AddingMembers,
  CreateTopic,
  EditTopic,
  MonetizationStatistics,
  NewGroup,
}

export type MediaViewerMedia = ApiPhoto | ApiVideo | ApiDocument;

export enum MediaViewerOrigin {
  Inline,
  ScheduledInline,
  SharedMedia,
  ProfileAvatar,
  SettingsAvatar,
  MiddleHeaderAvatar,
  Album,
  ScheduledAlbum,
  SearchResult,
  ChannelAvatar,
  SuggestedAvatar,
  StarsTransaction,
  PreviewMedia,
  SponsoredMessage,
}

export enum StoryViewerOrigin {
  StoryRibbon,
  MiddleHeaderAvatar,
  ChatList,
  SearchResult,
}

export enum AudioOrigin {
  Inline,
  SharedMedia,
  Search,
  OneTimeModal,
}

export enum ChatCreationProgress {
  Idle,
  InProgress,
  Complete,
  Error,
}

export enum ProfileEditProgress {
  Idle,
  InProgress,
  Complete,
  Error,
}

export enum ManagementProgress {
  Idle,
  InProgress,
  Complete,
  Error,
}

export interface ManagementState {
  isActive: boolean;
  nextScreen?: ManagementScreens;
  checkedUsername?: string;
  isUsernameAvailable?: boolean;
  error?: string;
  invites?: ApiExportedInvite[];
  revokedInvites?: ApiExportedInvite[];
  editingInvite?: ApiExportedInvite;
  inviteInfo?: {
    invite: ApiExportedInvite;
    importers?: ApiChatInviteImporter[];
    requesters?: ApiChatInviteImporter[];
  };
}

export enum NewChatMembersProgress {
  Closed,
  InProgress,
  Loading,
}

export type ProfileTabType =
  | 'members'
  | 'commonChats'
  | 'media'
  | 'previewMedia'
  | 'documents'
  | 'links'
  | 'audio'
  | 'voice'
  | 'gif'
  | 'stories'
  | 'storiesArchive'
  | 'similarChannels'
  | 'similarBots'
  | 'dialogs'
  | 'gifts';
export type SharedMediaType = 'media' | 'documents' | 'links' | 'audio' | 'voice' | 'gif';
export type MiddleSearchType = 'chat' | 'myChats' | 'channels';
export type MiddleSearchParams = {
  requestedQuery?: string;
  savedTag?: ApiReaction;
  isHashtag?: boolean;
  fromPeerId?: string;
  fetchingQuery?: string;
  type: MiddleSearchType;
  results?: MiddleSearchResults;
};
export type MiddleSearchResults = {
  query: string;
  totalCount?: number;
  nextOffsetId?: number;
  nextOffsetPeerId?: string;
  nextOffsetRate?: number;
  foundIds?: SearchResultKey[];
};

export interface LoadingState {
  areAllItemsLoadedForwards: boolean;
  areAllItemsLoadedBackwards: boolean;
}

export interface ChatMediaSearchSegment {
  foundIds: number[];
  loadingState: LoadingState;
}

export interface ChatMediaSearchParams {
  currentSegment: ChatMediaSearchSegment;
  segments: ChatMediaSearchSegment[];
  isLoading: boolean;
}

export enum ProfileState {
  Profile,
  SharedMedia,
  MemberList,
  GiftList,
  StoryList,
  SavedDialogs,
}

export enum PaymentStep {
  Checkout,
  SavedPayments,
  ConfirmPassword,
  PaymentInfo,
  ShippingInfo,
  Shipping,
  ConfirmPayment,
}

export const UPLOADING_WALLPAPER_SLUG = 'UPLOADING_WALLPAPER_SLUG';

export enum ManagementScreens {
  Initial,
  ChatPrivacyType,
  Discussion,
  ChannelSubscribers,
  GroupType,
  GroupPermissions,
  GroupRemovedUsers,
  ChannelRemovedUsers,
  GroupUserPermissionsCreate,
  GroupUserPermissions,
  ChatAdministrators,
  GroupRecentActions,
  ChatAdminRights,
  ChatNewAdminRights,
  GroupMembers,
  GroupAddAdmins,
  Invites,
  EditInvite,
  Reactions,
  InviteInfo,
  JoinRequests,
  NewDiscussionGroup,
}

export type ManagementType = 'user' | 'group' | 'channel' | 'bot';

export type EmojiKeywords = {
  isLoading?: boolean;
  version?: number;
  keywords?: Record<string, string[]>;
};

export type InlineBotSettings = {
  id: string;
  help?: string;
  query?: string;
  offset?: string;
  canLoadMore?: boolean;
  results?: (ApiBotInlineResult | ApiBotInlineMediaResult)[];
  isGallery?: boolean;
  switchPm?: ApiBotInlineSwitchPm;
  switchWebview?: ApiBotInlineSwitchWebview;
  cacheTime: number;
};

export type CustomPeerType = 'premium' | 'toBeDistributed' | 'contacts' | 'nonContacts'
  | 'groups' | 'channels' | 'bots' | 'excludeMuted' | 'excludeArchived' | 'excludeRead' | 'stars';

export type CustomPeer = {
  isCustomPeer: true;
  key?: string | number;
  subtitleKey?: string;
  avatarIcon?: IconName;
  isAvatarSquare?: boolean;
  peerColorId?: number;
  isVerified?: boolean;
  fakeType?: ApiFakeType;
  emojiStatusId?: string;
  customPeerAvatarColor?: string;
  withPremiumGradient?: boolean;
  isPremium?: boolean;
} & ({
  titleKey: string;
  title?: undefined;
} | {
  title: string;
  titleKey?: undefined;
});

export type UniqueCustomPeer<T = CustomPeerType> = CustomPeer & {
  type: T;
};

export type MessageListType =
  'thread'
  | 'pinned'
  | 'scheduled';

export type ChatListType = 'active' | 'archived' | 'saved';

export interface MessageList {
  chatId: string;
  threadId: ThreadId;
  type: MessageListType;
}

export interface ActiveEmojiInteraction {
  id: number;
  x: number;
  y: number;
  messageId?: number;
  startSize?: number;
  animatedEffect?: string;
  isReversed?: boolean;
}

export type ActiveDownloads = Record<string, {
  format: ApiMediaFormat;
  filename: string;
  size: number;
  originChatId?: string;
  originMessageId?: number;
}>;

export type IDimensions = {
  width: number;
  height: number;
};

export type StarsTransactionType = 'all' | 'inbound' | 'outbound';
export type StarsTransactionHistory = Record<StarsTransactionType, {
  transactions: ApiStarsTransaction[];
  nextOffset?: string;
} | undefined>;
export type StarsSubscriptions = {
  list: ApiStarsSubscription[];
  nextOffset?: string;
  isLoading?: boolean;
};

export type ConfettiStyle = 'poppers' | 'top-down';

export type StarGiftInfo = {
  peerId: string;
  gift: ApiStarGiftRegular;
  shouldHideName?: boolean;
  message?: ApiFormattedText;
  shouldUpgrade?: boolean;
};

export type TypingDraft = {
  senderId: string;
  id: string;
  date: number;
  text: ApiFormattedText;
};

export interface TabThread {
  scrollOffset?: number;
  replyStack?: number[];
  viewportIds?: number[];
}

export interface Thread {
  lastScrollOffset?: number;
  lastViewportIds?: number[];
  listedIds?: number[];
  outlyingLists?: number[][];
  pinnedIds?: number[];
  scheduledIds?: number[];
  editingId?: number;
  editingScheduledId?: number;
  editingDraft?: ApiFormattedText;
  editingScheduledDraft?: ApiFormattedText;
  draft?: ApiDraft;
  noWebPage?: boolean;
  threadInfo?: ApiThreadInfo;
  firstMessageId?: number;
  typingStatus?: ApiTypingStatus;
  typingDraftIdByRandomId?: Record<string, number>;
}

export interface ServiceNotification {
  id: number;
  message: ApiMessage;
  version?: string;
  isUnread?: boolean;
  isDeleted?: boolean;
}

export interface TopicsInfo {
  totalCount: number;
  topicsById: Record<ThreadId, ApiTopic>;
  listedTopicIds?: number[];
  orderedPinnedTopicIds?: number[];
}

export type TranslatedMessage = {
  isPending?: boolean;
  text?: ApiFormattedText;
  summary?: TextSummary;
};

export type TextSummary = {
  isPending?: false;
  text: ApiFormattedText;
} | {
  isPending: true;
  text?: undefined;
};

export type ChatTranslatedMessages = {
  byLangCode: Record<string, Record<number, TranslatedMessage>>;
};

export type ChatRequestedTranslations = {
  toLanguage?: string;
  manualMessages?: Record<number, string>;
};

export type SimilarBotsInfo = {
  similarBotsIds?: string[];
  count: number;
};

export type ConfettiParams = OptionalCombine<{
  style?: ConfettiStyle;
  withStars?: boolean;
}, {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}>;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type WebPageMediaSize = 'large' | 'small';

export type AttachmentCompression = 'compress' | 'original';

export type StarGiftCategory = 'all' | 'myUnique' | 'collectible';

export type CallSound = (
  'join' | 'allowTalk' | 'leave' | 'connecting' | 'incoming' | 'end' | 'connect' | 'busy' | 'ringing'
);

export type BotAppPermissions = {
  geolocation?: boolean;
};

export type GiftProfileFilterOptions = {
  sortType: 'byDate' | 'byValue';
  shouldIncludeUnlimited: boolean;
  shouldIncludeLimited: boolean;
  shouldIncludeUpgradable: boolean;
  shouldIncludeUnique: boolean;
  shouldIncludeDisplayed: boolean;
  shouldIncludeHidden: boolean;
};
export type ResaleGiftsSortType = 'byDate' | 'byPrice' | 'byNumber';
export type ResaleGiftsFilterOptions = {
  sortType: ResaleGiftsSortType;
  modelAttributes?: StarGiftAttributeIdModel[];
  patternAttributes?: ApiStarGiftAttributeIdPattern[];
  backdropAttributes?: ApiStarGiftAttributeIdBackdrop[];
};

export type SendMessageParams = {
  chat?: ApiChat;
  attachments?: ApiAttachment[];
  lastMessageId?: number;
  text?: string;
  entities?: ApiMessageEntity[];
  replyInfo?: ApiInputReplyInfo;
  suggestedPostInfo?: ApiInputSuggestedPostInfo;
  attachment?: ApiAttachment;
  sticker?: ApiSticker;
  story?: ApiStory | ApiStorySkipped;
  gif?: ApiVideo;
  poll?: ApiNewPoll;
  todo?: ApiNewMediaTodo;
  dice?: string;
  contact?: ApiContact;
  isSilent?: boolean;
  scheduledAt?: number;
  scheduleRepeatPeriod?: number;
  groupedId?: string;
  noWebPage?: boolean;
  sendAs?: ApiPeer;
  shouldGroupMessages?: boolean;
  shouldUpdateStickerSetOrder?: boolean;
  wasDrafted?: boolean;
  isInvertedMedia?: true;
  effectId?: string;
  webPageMediaSize?: WebPageMediaSize;
  webPageUrl?: string;
  starsAmount?: number;
  isPending?: true;
  messageList?: MessageList;
  isReaction?: true; // Reaction to the story are sent in the form of a message
  messagePriceInStars?: number;
  localMessage?: ApiMessage;
  forwardedLocalMessagesSlice?: ForwardedLocalMessagesSlice;
  isForwarding?: boolean;
  forwardParams?: ForwardMessagesParams;
  isStoryReply?: boolean;
  suggestedMedia?: MediaContent;
};

export type ForwardedLocalMessagesSlice = {
  messageIds: number[];
  localMessages: ApiMessage[];
};

export type ForwardMessagesParams = {
  fromChat: ApiChat;
  toChat: ApiChat;
  toThreadId?: ThreadId;
  messages: ApiMessage[];
  isSilent?: boolean;
  scheduledAt?: number;
  scheduleRepeatPeriod?: number;
  sendAs?: ApiPeer;
  withMyScore?: boolean;
  noAuthors?: boolean;
  noCaptions?: boolean;
  isCurrentUserPremium?: boolean;
  wasDrafted?: boolean;
  lastMessageId?: number;
  forwardedLocalMessagesSlice?: ForwardedLocalMessagesSlice;
  messagePriceInStars?: number;
  effectId?: string;
};
