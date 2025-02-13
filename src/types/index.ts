import type { TeactNode } from '../lib/teact/teact';

import type {
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotInlineSwitchPm,
  ApiBotInlineSwitchWebview,
  ApiChatInviteImporter,
  ApiDocument,
  ApiDraft,
  ApiExportedInvite,
  ApiFakeType,
  ApiFormattedText,
  ApiLabeledPrice,
  ApiMediaFormat,
  ApiMessage,
  ApiPhoto,
  ApiReaction,
  ApiReactionWithPaid,
  ApiStarGiftRegular,
  ApiStarsSubscription,
  ApiStarsTransaction,
  ApiStickerSet,
  ApiThreadInfo,
  ApiTopic,
  ApiTypingStatus,
  ApiVideo,
} from '../api/types';
import type { SearchResultKey } from '../util/keys/searchResultKey';
import type { IconName } from './icons';

export type TextPart = TeactNode;

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
export type PerformanceTypeKey = (
  'pageTransitions' | 'messageSendingAnimations' | 'mediaViewerAnimations'
  | 'messageComposerAnimations' | 'contextMenuAnimations' | 'contextMenuBlur' | 'rightColumnAnimations'
  | 'animatedEmoji' | 'loopAnimatedStickers' | 'reactionEffects' | 'stickerEffects' | 'autoplayGifs' | 'autoplayVideos'
  | 'storyRibbonAnimations' | 'snapEffect'
);
export type PerformanceType = {
  [key in PerformanceTypeKey]: boolean;
};

export interface IThemeSettings {
  background?: string;
  backgroundColor?: string;
  patternColor?: string;
  isBlurred?: boolean;
}

export type NotifySettings = {
  hasPrivateChatsNotifications?: boolean;
  hasPrivateChatsMessagePreview?: boolean;
  hasGroupNotifications?: boolean;
  hasGroupMessagePreview?: boolean;
  hasBroadcastNotifications?: boolean;
  hasBroadcastMessagePreview?: boolean;
  hasContactJoinedNotifications?: boolean;
  hasWebNotifications: boolean;
  hasPushNotifications: boolean;
  notificationSoundVolume: number;
};

export type LangCode = (
  'en' | 'ar' | 'be' | 'ca' | 'nl' | 'fr' | 'de' | 'id' | 'it' | 'ko' | 'ms' | 'fa' | 'pl' | 'pt-br' | 'ru' | 'es'
  | 'tr' | 'uk' | 'uz'
);

export type TimeFormat = '24h' | '12h';

export interface ISettings extends NotifySettings, Record<string, any> {
  theme: ThemeKey;
  shouldUseSystemTheme: boolean;
  messageTextSize: number;
  animationLevel: AnimationLevel;
  messageSendKeyCombo: 'enter' | 'ctrl-enter';
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
  language: string;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  timeFormat: TimeFormat;
  wasTimeFormatSetManually: boolean;
  isConnectionStatusMinimized: boolean;
  shouldArchiveAndMuteNewNonContact?: boolean;
  shouldNewNonContactPeersRequirePremium?: boolean;
  shouldHideReadMarks?: boolean;
  canTranslate: boolean;
  canTranslateChats: boolean;
  translationLanguage?: string;
  doNotTranslate: string[];
  canDisplayChatInTitle: boolean;
  shouldForceHttpTransport?: boolean;
  shouldAllowHttpTransport?: boolean;
  shouldCollectDebugLogs?: boolean;
  shouldDebugExportedSenders?: boolean;
  shouldWarnAboutSvg?: boolean;
  shouldSkipWebAppCloseConfirmation: boolean;
}

export type IAnchorPosition = {
  x: number;
  y: number;
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
  | 'stories'
  | 'storiesArchive'
  | 'similarChannels'
  | 'similarBots'
  | 'dialogs'
  | 'gifts';
export type SharedMediaType = 'media' | 'documents' | 'links' | 'audio' | 'voice';
export type MiddleSearchType = 'chat' | 'myChats' | 'channels';
export type MiddleSearchParams = {
  requestedQuery?: string;
  savedTag?: ApiReaction;
  isHashtag?: boolean;
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
}

export type ManagementType = 'user' | 'group' | 'channel' | 'bot';

export type NotifyException = {
  isMuted: boolean;
  isSilent?: boolean;
  shouldShowPreviews?: boolean;
};

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

export type StarGiftCategory = number | 'all' | 'limited' | 'stock';

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
  shouldIncludeUnique: boolean;
  shouldIncludeDisplayed: boolean;
  shouldIncludeHidden: boolean;
};
