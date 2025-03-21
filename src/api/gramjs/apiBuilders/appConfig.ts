/* eslint-disable @typescript-eslint/naming-convention */
import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiAppConfig, ApiLimitType, ApiPremiumSection } from '../../types';

import {
  DEFAULT_LIMITS,
  MAX_UNIQUE_REACTIONS,
  SERVICE_NOTIFICATIONS_USER_ID,
  STORY_EXPIRE_PERIOD,
  STORY_VIEWERS_EXPIRE_PERIOD,
} from '../../../config';
import localDb from '../localDb';
import { buildJson } from './misc';

type LimitType = 'default' | 'premium';
type Limit =
  | 'upload_max_fileparts'
  | 'stickers_faved_limit'
  | 'saved_gifs_limit'
  | 'dialog_filters_chats_limit'
  | 'dialog_filters_limit'
  | 'dialogs_folder_pinned_limit'
  | 'dialogs_pinned_limit'
  | 'caption_length_limit'
  | 'channels_limit'
  | 'channels_public_limit'
  | 'about_length_limit'
  | 'chatlist_invites_limit'
  | 'chatlist_joined_limit'
  | 'recommended_channels_limit'
  | 'saved_dialogs_pinned_limit';
type LimitKey = `${Limit}_${LimitType}`;
type LimitsConfig = Record<LimitKey, number>;

export interface GramJsAppConfig extends LimitsConfig {
  emojies_sounds: Record<string, {
    id: string;
    access_hash: string;
    file_reference_base64: string;
  }>;
  emojies_send_dice: string[];
  groupcall_video_participants_max: number;
  reactions_uniq_max: number;
  chat_read_mark_size_threshold: number;
  chat_read_mark_expire_period: number;
  pm_read_date_expire_period: number;
  reactions_user_max_default: number;
  reactions_user_max_premium: number;
  autologin_domains: string[];
  autologin_token: string;
  url_auth_domains: string[];
  premium_purchase_blocked: boolean;
  giveaway_gifts_purchase_available: boolean;
  giveaway_add_peers_max: number;
  premium_bot_username: string;
  premium_invoice_slug: string;
  premium_promo_order: string[];
  default_emoji_statuses_stickerset_id: string;
  hidden_members_group_size_min: number;
  autoarchive_setting_available: boolean;
  authorization_autoconfirm_period: number;
  giveaway_boosts_per_premium: number;
  giveaway_countries_max: number;
  boosts_per_sent_gift: number;
  stars_paid_reaction_amount_max: number;
  // Forums
  topics_pinned_limit: number;
  // Stories
  stories_all_hidden?: boolean;
  story_expire_period: number;
  story_viewers_expire_period: number;
  stories_changelog_user_id?: number;
  stories_pinned_to_top_count_max?: number;
  // Boosts
  group_transcribe_level_min?: number;
  new_noncontact_peers_require_premium_without_ownpremium?: boolean;
  channel_restrict_sponsored_level_min?: number;
  channel_revenue_withdrawal_enabled?: boolean;
  // Upload premium notifications
  upload_premium_speedup_notify_period?: number;
  upload_premium_speedup_download?: number;
  upload_premium_speedup_upload?: number;
  stars_gifts_enabled?: boolean;
  stargifts_message_length_max?: number;
  stargifts_convert_period_max?: number;
  starref_start_param_prefixes?: string[];
  ton_blockchain_explorer_url?: string;
  stargifts_pinned_to_top_limit?: number;
}

function buildEmojiSounds(appConfig: GramJsAppConfig) {
  const { emojies_sounds } = appConfig;
  return emojies_sounds ? Object.keys(emojies_sounds).reduce((acc: Record<string, string>, key) => {
    const l = emojies_sounds[key];
    localDb.documents[l.id] = new GramJs.Document({
      id: BigInt(l.id),
      accessHash: BigInt(l.access_hash),
      dcId: 1,
      mimeType: 'audio/ogg',
      fileReference: Buffer.alloc(0),
      size: BigInt(0),
    } as GramJs.Document);

    acc[key] = l.id;
    return acc;
  }, {}) : {};
}

function getLimit(appConfig: GramJsAppConfig, key: Limit, fallbackKey: ApiLimitType) {
  const defaultLimit = appConfig[`${key}_default`] || DEFAULT_LIMITS[fallbackKey][0];
  const premiumLimit = appConfig[`${key}_premium`] || DEFAULT_LIMITS[fallbackKey][1];
  return [defaultLimit, premiumLimit] as const;
}

export function buildAppConfig(json: GramJs.TypeJSONValue, hash: number): ApiAppConfig {
  const appConfig = buildJson(json) as GramJsAppConfig;

  return {
    emojiSounds: buildEmojiSounds(appConfig),
    seenByMaxChatMembers: appConfig.chat_read_mark_size_threshold,
    seenByExpiresAt: appConfig.chat_read_mark_expire_period,
    readDateExpiresAt: appConfig.pm_read_date_expire_period,
    autologinDomains: appConfig.autologin_domains || [],
    urlAuthDomains: appConfig.url_auth_domains || [],
    maxUniqueReactions: appConfig.reactions_uniq_max ?? MAX_UNIQUE_REACTIONS,
    premiumBotUsername: appConfig.premium_bot_username,
    premiumInvoiceSlug: appConfig.premium_invoice_slug,
    premiumPromoOrder: appConfig.premium_promo_order as ApiPremiumSection[],
    isPremiumPurchaseBlocked: appConfig.premium_purchase_blocked,
    isGiveawayGiftsPurchaseAvailable: appConfig.giveaway_gifts_purchase_available,
    defaultEmojiStatusesStickerSetId: appConfig.default_emoji_statuses_stickerset_id,
    topicsPinnedLimit: appConfig.topics_pinned_limit,
    maxUserReactionsDefault: appConfig.reactions_user_max_default,
    maxUserReactionsPremium: appConfig.reactions_user_max_premium,
    hiddenMembersMinCount: appConfig.hidden_members_group_size_min,
    giveawayAddPeersMax: appConfig.giveaway_add_peers_max,
    giveawayBoostsPerPremium: appConfig.giveaway_boosts_per_premium,
    giveawayCountriesMax: appConfig.giveaway_countries_max,
    boostsPerSentGift: appConfig.boosts_per_sent_gift,
    canDisplayAutoarchiveSetting: appConfig.autoarchive_setting_available,
    limits: {
      uploadMaxFileparts: getLimit(appConfig, 'upload_max_fileparts', 'uploadMaxFileparts'),
      stickersFaved: getLimit(appConfig, 'stickers_faved_limit', 'stickersFaved'),
      savedGifs: getLimit(appConfig, 'saved_gifs_limit', 'savedGifs'),
      dialogFiltersChats: getLimit(appConfig, 'dialog_filters_chats_limit', 'dialogFiltersChats'),
      dialogFilters: getLimit(appConfig, 'dialog_filters_limit', 'dialogFilters'),
      dialogFolderPinned: getLimit(appConfig, 'dialogs_pinned_limit', 'dialogFolderPinned'),
      captionLength: getLimit(appConfig, 'caption_length_limit', 'captionLength'),
      channels: getLimit(appConfig, 'channels_limit', 'channels'),
      channelsPublic: getLimit(appConfig, 'channels_public_limit', 'channelsPublic'),
      aboutLength: getLimit(appConfig, 'about_length_limit', 'aboutLength'),
      chatlistInvites: getLimit(appConfig, 'chatlist_invites_limit', 'chatlistInvites'),
      chatlistJoined: getLimit(appConfig, 'chatlist_joined_limit', 'chatlistJoined'),
      recommendedChannels: getLimit(appConfig, 'recommended_channels_limit', 'recommendedChannels'),
      savedDialogsPinned: getLimit(appConfig, 'saved_dialogs_pinned_limit', 'savedDialogsPinned'),
    },
    hash,
    areStoriesHidden: appConfig.stories_all_hidden,
    storyExpirePeriod: appConfig.story_expire_period ?? STORY_EXPIRE_PERIOD,
    storyViewersExpirePeriod: appConfig.story_viewers_expire_period ?? STORY_VIEWERS_EXPIRE_PERIOD,
    storyChangelogUserId: appConfig.stories_changelog_user_id?.toString() ?? SERVICE_NOTIFICATIONS_USER_ID,
    maxPinnedStoriesCount: appConfig.stories_pinned_to_top_count_max,
    groupTranscribeLevelMin: appConfig.group_transcribe_level_min,
    canLimitNewMessagesWithoutPremium: appConfig.new_noncontact_peers_require_premium_without_ownpremium,
    bandwidthPremiumNotifyPeriod: appConfig.upload_premium_speedup_notify_period,
    bandwidthPremiumUploadSpeedup: appConfig.upload_premium_speedup_upload,
    bandwidthPremiumDownloadSpeedup: appConfig.upload_premium_speedup_download,
    channelRestrictAdsLevelMin: appConfig.channel_restrict_sponsored_level_min,
    paidReactionMaxAmount: appConfig.stars_paid_reaction_amount_max,
    isChannelRevenueWithdrawalEnabled: appConfig.channel_revenue_withdrawal_enabled,
    isStarsGiftEnabled: appConfig.stars_gifts_enabled,
    starGiftMaxMessageLength: appConfig.stargifts_message_length_max,
    starGiftMaxConvertPeriod: appConfig.stargifts_convert_period_max,
    starRefStartPrefixes: appConfig.starref_start_param_prefixes,
    tonExplorerUrl: appConfig.ton_blockchain_explorer_url,
    savedGiftPinLimit: appConfig.stargifts_pinned_to_top_limit,
  };
}
