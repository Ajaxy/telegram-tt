import type { TeactNode } from '../lib/teact/teact';

import type {
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiBotInlineSwitchPm,
  ApiBotInlineSwitchWebview,
  ApiChat,
  ApiChatInviteImporter,
  ApiDocument,
  ApiExportedInvite,
  ApiFakeType,
  ApiLanguage,
  ApiMessage,
  ApiPhoto,
  ApiReaction,
  ApiReactionWithPaid,
  ApiStickerSet,
  ApiUser,
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
  | 'storyRibbonAnimations'
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
  languages?: ApiLanguage[];
  language: LangCode;
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
  shouldShowLoginCodeInChatList?: boolean;
  shouldForceHttpTransport?: boolean;
  shouldAllowHttpTransport?: boolean;
  shouldCollectDebugLogs?: boolean;
  shouldDebugExportedSenders?: boolean;
  shouldWarnAboutSvg?: boolean;
}

export interface ApiPrivacySettings {
  visibility: PrivacyVisibility;
  isUnspecified?: boolean;
  allowUserIds: string[];
  allowChatIds: string[];
  blockUserIds: string[];
  blockChatIds: string[];
  shouldAllowPremium?: true;
}

export interface ApiInputPrivacyRules {
  visibility: PrivacyVisibility;
  isUnspecified?: boolean;
  allowedUsers?: ApiUser[];
  allowedChats?: ApiChat[];
  blockedUsers?: ApiUser[];
  blockedChats?: ApiChat[];
  shouldAllowPremium?: true;
}

export type IAnchorPosition = {
  x: number;
  y: number;
};

export interface ShippingOption {
  id: string;
  title: string;
  amount: number;
  prices: Price[];
}

export interface Price {
  label: string;
  amount: number;
}

export interface ApiInvoiceContainer {
  isTest?: boolean;
  isNameRequested?: boolean;
  isPhoneRequested?: boolean;
  isEmailRequested?: boolean;
  isShippingAddressRequested?: boolean;
  isFlexible?: boolean;
  shouldSendPhoneToProvider?: boolean;
  shouldSendEmailToProvider?: boolean;
  currency?: string;
  prices?: Price[];
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
  | 'dialogs';
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

export type ApiPrivacyKey = 'phoneNumber' | 'addByPhone' | 'lastSeen' | 'profilePhoto' | 'voiceMessages' |
'forwards' | 'chatInvite' | 'phoneCall' | 'phoneP2P' | 'bio' | 'birthday';
export type PrivacyVisibility = 'everybody' | 'contacts' | 'closeFriends' | 'nonContacts' | 'nobody';

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
  version: number;
  keywords: Record<string, string[]>;
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
