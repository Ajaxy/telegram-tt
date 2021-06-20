import {
  ApiLanguage, ApiMessage, ApiStickerSet, ApiShippingAddress,
} from '../api/types';

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

export interface IAlbum {
  albumId: string;
  messages: ApiMessage[];
  mainMessage: ApiMessage;
}

export type ThemeKey = 'light' | 'dark';
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
};

export type LangCode = (
  'en' | 'ar' | 'be' | 'ca' | 'nl' | 'fr' | 'de' | 'id' | 'it' | 'ko' | 'ms' | 'fa' | 'pl' | 'pt-br' | 'ru' | 'es'
  | 'tr' | 'uk' | 'uz'
);

export interface ISettings extends NotifySettings, Record<string, any> {
  theme: ThemeKey;
  shouldUseSystemTheme: boolean;
  messageTextSize: number;
  animationLevel: 0 | 1 | 2;
  messageSendKeyCombo: 'enter' | 'ctrl-enter';
  shouldAutoDownloadMediaFromContacts: boolean;
  shouldAutoDownloadMediaInPrivateChats: boolean;
  shouldAutoDownloadMediaInGroups: boolean;
  shouldAutoDownloadMediaInChannels: boolean;
  shouldAutoPlayGifs: boolean;
  shouldAutoPlayVideos: boolean;
  shouldSuggestStickers: boolean;
  shouldLoopStickers: boolean;
  hasPassword?: boolean;
  languages?: ApiLanguage[];
  language: LangCode;
}

export interface ApiPrivacySettings {
  visibility: PrivacyVisibility;
  allowUserIds: number[];
  allowChatIds: number[];
  blockUserIds: number[];
  blockChatIds: number[];
}

export interface IInputPrivacyContact {
  id: number;
  accessHash?: string;
}

export interface IInputPrivacyRules {
  visibility: PrivacyVisibility;
  allowedUsers?: IInputPrivacyContact[];
  allowedChats?: IInputPrivacyContact[];
  blockedUsers?: IInputPrivacyContact[];
  blockedChats?: IInputPrivacyContact[];
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

export interface Invoice {
  currency?: string;
  emailRequested?: boolean;
  emailToProvider?: boolean;
  flexible?: boolean;
  nameRequested?: boolean;
  phoneRequested?: boolean;
  phoneToProvider?: boolean;
  prices?: Price[];
  shippingAddressRequested?: boolean;
  test?: boolean;
}

export interface Receipt {
  currency: string;
  prices: Price[];
  info?: {
    shippingAddress?: ApiShippingAddress;
    phone?: string;
    name?: string;
  };
  totalAmount: number;
  credentialsTitle: string;
  shippingPrices?: Price[];
  shippingMethod?: string;
  photoUrl?: string;
  text?: string;
  title?: string;
}

export enum SettingsScreens {
  Main,
  EditProfile,
  Notifications,
  Language,
  General,
  GeneralChatBackground,
  GeneralChatBackgroundColor,
  Privacy,
  PrivacyPhoneNumber,
  PrivacyLastSeen,
  PrivacyProfilePhoto,
  PrivacyForwarding,
  PrivacyGroupChats,
  PrivacyPhoneNumberAllowedContacts,
  PrivacyPhoneNumberDeniedContacts,
  PrivacyLastSeenAllowedContacts,
  PrivacyLastSeenDeniedContacts,
  PrivacyProfilePhotoAllowedContacts,
  PrivacyProfilePhotoDeniedContacts,
  PrivacyForwardingAllowedContacts,
  PrivacyForwardingDeniedContacts,
  PrivacyGroupChatsAllowedContacts,
  PrivacyGroupChatsDeniedContacts,
  PrivacyActiveSessions,
  PrivacyBlockedUsers,
  Folders,
  FoldersCreateFolder,
  FoldersEditFolder,
  FoldersIncludedChats,
  FoldersExcludedChats,
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
}

export type StickerSetOrRecent = Pick<ApiStickerSet, (
  'id' | 'title' | 'count' | 'stickers' | 'hasThumbnail' | 'isAnimated'
)>;

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
  Media,
  Links,
  Files,
  Music,
  Voice,
}

export enum RightColumnContent {
  ChatInfo,
  UserInfo,
  Search,
  Management,
  StickerSearch,
  GifSearch,
  PollResults,
}

export enum MediaViewerOrigin {
  Inline,
  ScheduledInline,
  SharedMedia,
  ProfileAvatar,
  MiddleHeaderAvatar,
  Album,
  ScheduledAlbum,
  SearchResult,
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

export type ProfileTabType = 'members' | 'media' | 'documents' | 'links' | 'audio';
export type SharedMediaType = 'media' | 'documents' | 'links' | 'audio';
export type ApiPrivacyKey = 'phoneNumber' | 'lastSeen' | 'profilePhoto' | 'forwards' | 'chatInvite';
export type PrivacyVisibility = 'everybody' | 'contacts' | 'nonContacts' | 'nobody';

export enum ProfileState {
  Profile,
  SharedMedia,
  MemberList,
}

export enum PaymentStep {
  ShippingInfo,
  Shipping,
  PaymentInfo,
  Checkout
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
  GroupUserPermissionsCreate,
  GroupUserPermissions,
  ChatAdministrators,
  GroupRecentActions,
  ChatAdminRights,
  GroupMembers,
}

export type ManagementType = 'user' | 'group' | 'channel';

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
