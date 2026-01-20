import type { ApiAppConfig, ApiLimitType } from './api/types';

import { MULTIACCOUNT_MAX_SLOTS } from './config';

export const MAX_UNIQUE_REACTIONS = 11;
export const GROUP_CALL_PARTICIPANTS_LIMIT = 100;
export const STORY_LIST_LIMIT = 100;
export const API_GENERAL_ID_LIMIT = 100;
export const RESALE_GIFTS_LIMIT = 50;
export const PINNED_MESSAGES_LIMIT = 50;
export const BLOCKED_LIST_LIMIT = 100;
export const GLOBAL_SEARCH_CONTACTS_LIMIT = 20;

// As in Telegram for Android
// https://github.com/DrKLO/Telegram/blob/51e9947527/TMessagesProj/src/main/java/org/telegram/messenger/MediaDataController.java#L7799
export const TOP_REACTIONS_LIMIT = 100;
export const RECENT_REACTIONS_LIMIT = 50;
export const REACTION_LIST_LIMIT = 100;

export const DEFAULT_LIMITS: Record<ApiLimitType, readonly [number, number]> = {
  uploadMaxFileparts: [4000, 8000],
  stickersFaved: [5, 10],
  savedGifs: [200, 400],
  dialogFiltersChats: [100, 200],
  dialogFilters: [10, 20],
  dialogFolderPinned: [5, 10],
  captionLength: [1024, 4096],
  channels: [500, 1000],
  channelsPublic: [10, 20],
  aboutLength: [70, 140],
  chatlistInvites: [3, 100],
  chatlistJoined: [2, 20],
  recommendedChannels: [10, 100],
  savedDialogsPinned: [5, 100],
  maxReactions: [1, 3],
  moreAccounts: [3, MULTIACCOUNT_MAX_SLOTS],
};

export const DEFAULT_MAX_MESSAGE_LENGTH = 4096;
export const DEFAULT_MAX_NOTE_LENGTH = 128;

export const DEFAULT_APP_CONFIG: ApiAppConfig = {
  hash: 0,
  limits: {
    uploadMaxFileparts: DEFAULT_LIMITS.uploadMaxFileparts,
    stickersFaved: DEFAULT_LIMITS.stickersFaved,
    savedGifs: DEFAULT_LIMITS.savedGifs,
    dialogFiltersChats: DEFAULT_LIMITS.dialogFiltersChats,
    dialogFilters: DEFAULT_LIMITS.dialogFilters,
    dialogFolderPinned: DEFAULT_LIMITS.dialogFolderPinned,
    captionLength: DEFAULT_LIMITS.captionLength,
    channels: DEFAULT_LIMITS.channels,
    channelsPublic: DEFAULT_LIMITS.channelsPublic,
    aboutLength: DEFAULT_LIMITS.aboutLength,
    chatlistInvites: DEFAULT_LIMITS.chatlistInvites,
    chatlistJoined: DEFAULT_LIMITS.chatlistJoined,
    recommendedChannels: DEFAULT_LIMITS.recommendedChannels,
    savedDialogsPinned: DEFAULT_LIMITS.savedDialogsPinned,
    moreAccounts: DEFAULT_LIMITS.moreAccounts,
    maxReactions: DEFAULT_LIMITS.maxReactions,
  },
  autologinDomains: [
    'instantview.telegram.org',
    'translations.telegram.org',
    'contest.dev',
    'contest.com',
    'bugs.telegram.org',
    'suggestions.telegram.org',
    'themes.telegram.org',
    'promote.telegram.org',
    'ads.telegram.org',
  ],
  channelLevelMax: 100,
  boostsPerSentGift: 3,
  channelRestrictAdsLevelMin: 50,
  seenByExpiresAt: 604800,
  seenByMaxChatMembers: 100,
  defaultEmojiStatusesStickerSetId: '773947703670341676',
  emojiSounds: {},
  giveawayAddPeersMax: 10,
  giveawayBoostsPerPremium: 4,
  giveawayCountriesMax: 10,
  isGiveawayGiftsPurchaseAvailable: false,
  groupTranscribeLevelMin: 6,
  hiddenMembersMinCount: 100,
  ignoreRestrictionReasons: [],
  canLimitNewMessagesWithoutPremium: false,
  readDateExpiresAt: 604800,
  premiumBotUsername: 'PremiumBot',
  premiumPromoOrder: [
    'stories',
    'more_upload',
    'double_limits',
    // 'business',
    'last_seen',
    'voice_to_text',
    'faster_download',
    'translations',
    'animated_emoji',
    'emoji_status',
    'saved_tags',
    // 'peer_colors',
    // 'wallpapers',
    'profile_badge',
    'message_privacy',
    'advanced_chat_management',
    'no_ads',
    // 'app_icons',
    'infinite_reactions',
    'animated_userpics',
    'premium_stickers',
    'effects',
  ],
  isPremiumPurchaseBlocked: false,
  maxUniqueReactions: 11,
  starGiftMaxConvertPeriod: 7776000,
  starGiftMaxMessageLength: 255,
  starRefStartPrefixes: [
    '_tgr_',
  ],
  isStarsGiftEnabled: true,
  paidReactionMaxAmount: 2500,
  starsUsdWithdrawRateX1000: 1300,
  storyChangelogUserId: '777000',
  maxPinnedStoriesCount: 3,
  starsSuggestedPostAmountMax: 100000,
  starsSuggestedPostAmountMin: 5,
  starsSuggestedPostAgeMin: 86400,
  starsSuggestedPostFutureMin: 300,
  starsSuggestedPostFutureMax: 2678400,
  starsSuggestedPostCommissionPermille: 850,
  tonSuggestedPostCommissionPermille: 850,
  todoItemLengthMax: 64,
  todoItemsMax: 30,
  todoTitleLengthMax: 32,
  tonSuggestedPostAmountMax: 10000000000000,
  tonSuggestedPostAmountMin: 10000000,
  tonTopupUrl: 'https://fragment.com/ads/topup',
  storyViewersExpirePeriod: 86400,
  topicsPinnedLimit: 5,
  bandwidthPremiumDownloadSpeedup: 10,
  bandwidthPremiumNotifyPeriod: 3600,
  bandwidthPremiumUploadSpeedup: 10,
  urlAuthDomains: [
    'web.telegram.org',
    'web.t.me',
    'k.t.me',
    'z.t.me',
    'a.t.me',
  ],
  whitelistedDomains: [
    'telegram.dog',
    'telegram.me',
    'telegram.org',
    't.me',
    'telesco.pe',
    'fragment.com',
    'translations.telegram.org',
  ],
  typingDraftTtl: 10,
  arePasskeysAvailable: true,
  passkeysMaxCount: 5,
  diceEmojies: [],
  diceEmojiesSuccess: {},
};
