import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiAppConfig, ApiLimitType, ApiPremiumSection } from '../../types';

import { omitUndefined } from '../../../util/iteratees';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_LIMITS,
} from '../../../limits';
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
  | 'saved_dialogs_pinned_limit'
  | 'reactions_user_max';
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
  whitelisted_domains: string[];
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
  story_viewers_expire_period: number;
  stories_changelog_user_id: number;
  stories_pinned_to_top_count_max: number;
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
  stars_paid_messages_available?: boolean;
  stars_usd_withdraw_rate_x1000?: number;
  stars_paid_message_commission_permille?: number;
  stars_paid_message_amount_max?: number;
  stargifts_pinned_to_top_limit?: number;
  freeze_since_date?: number;
  freeze_until_date?: number;
  freeze_appeal_url?: string;
  channel_autotranslation_level_min?: number;
  stars_stargift_resale_amount_max?: number;
  stars_stargift_resale_amount_min?: number;
  stars_stargift_resale_commission_permille?: number;
  ton_stargift_resale_amount_min?: number;
  ton_stargift_resale_amount_max?: number;
  ton_stargift_resale_commission_permille?: number;
  stars_suggested_post_amount_max?: number;
  stars_suggested_post_amount_min?: number;
  stars_suggested_post_commission_permille?: number;
  stars_suggested_post_age_min?: number;
  stars_suggested_post_future_max?: number;
  stars_suggested_post_future_min?: number;
  ton_suggested_post_commission_permille?: number;
  ton_suggested_post_amount_max?: number;
  ton_suggested_post_amount_min?: number;
  ton_usd_rate?: number;
  ton_topup_url?: string;
  poll_answers_max?: number;
  todo_items_max?: number;
  todo_title_length_max?: number;
  todo_item_length_max?: number;
  ignore_restriction_reasons?: string[];
  need_age_video_verification?: boolean;
  verify_age_bot_username?: string;
  verify_age_country?: string;
  verify_age_min?: number;
  contact_note_length_limit?: number;
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
      size: 0n,
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

  const config: Partial<ApiAppConfig> = {
    emojiSounds: buildEmojiSounds(appConfig),
    seenByMaxChatMembers: appConfig.chat_read_mark_size_threshold,
    seenByExpiresAt: appConfig.chat_read_mark_expire_period,
    readDateExpiresAt: appConfig.pm_read_date_expire_period,
    autologinDomains: appConfig.autologin_domains || [],
    urlAuthDomains: appConfig.url_auth_domains || [],
    whitelistedDomains: appConfig.whitelisted_domains || [],
    maxUniqueReactions: appConfig.reactions_uniq_max,
    premiumBotUsername: appConfig.premium_bot_username,
    premiumInvoiceSlug: appConfig.premium_invoice_slug,
    premiumPromoOrder: appConfig.premium_promo_order as ApiPremiumSection[],
    isPremiumPurchaseBlocked: appConfig.premium_purchase_blocked,
    isGiveawayGiftsPurchaseAvailable: appConfig.giveaway_gifts_purchase_available,
    defaultEmojiStatusesStickerSetId: appConfig.default_emoji_statuses_stickerset_id,
    topicsPinnedLimit: appConfig.topics_pinned_limit,
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
      maxReactions: getLimit(appConfig, 'reactions_user_max', 'maxReactions'),
      moreAccounts: DEFAULT_LIMITS.moreAccounts,
    },
    contactNoteLimit: appConfig.contact_note_length_limit,
    hash,
    storyViewersExpirePeriod: appConfig.story_viewers_expire_period,
    storyChangelogUserId: appConfig.stories_changelog_user_id?.toString(),
    maxPinnedStoriesCount: appConfig.stories_pinned_to_top_count_max,
    groupTranscribeLevelMin: appConfig.group_transcribe_level_min,
    canLimitNewMessagesWithoutPremium: appConfig.new_noncontact_peers_require_premium_without_ownpremium,
    starsPaidMessagesAvailable: appConfig.stars_paid_messages_available,
    starsPaidMessageCommissionPermille: appConfig.stars_paid_message_commission_permille,
    starsPaidMessageAmountMax: appConfig.stars_paid_message_amount_max,
    starsUsdWithdrawRateX1000: appConfig.stars_usd_withdraw_rate_x1000,
    bandwidthPremiumNotifyPeriod: appConfig.upload_premium_speedup_notify_period,
    bandwidthPremiumUploadSpeedup: appConfig.upload_premium_speedup_upload,
    bandwidthPremiumDownloadSpeedup: appConfig.upload_premium_speedup_download,
    channelRestrictAdsLevelMin: appConfig.channel_restrict_sponsored_level_min,
    channelAutoTranslationLevelMin: appConfig.channel_autotranslation_level_min,
    paidReactionMaxAmount: appConfig.stars_paid_reaction_amount_max,
    isChannelRevenueWithdrawalEnabled: appConfig.channel_revenue_withdrawal_enabled,
    isStarsGiftEnabled: appConfig.stars_gifts_enabled,
    starGiftMaxMessageLength: appConfig.stargifts_message_length_max,
    starGiftMaxConvertPeriod: appConfig.stargifts_convert_period_max,
    starRefStartPrefixes: appConfig.starref_start_param_prefixes,
    tonExplorerUrl: appConfig.ton_blockchain_explorer_url,
    savedGiftPinLimit: appConfig.stargifts_pinned_to_top_limit,
    freezeSinceDate: appConfig.freeze_since_date,
    freezeUntilDate: appConfig.freeze_until_date,
    freezeAppealUrl: appConfig.freeze_appeal_url,
    starsStargiftResaleAmountMin: appConfig.stars_stargift_resale_amount_min,
    starsStargiftResaleAmountMax: appConfig.stars_stargift_resale_amount_max,
    starsStargiftResaleCommissionPermille: appConfig.stars_stargift_resale_commission_permille,
    tonStargiftResaleAmountMin: appConfig.ton_stargift_resale_amount_min,
    tonStargiftResaleAmountMax: appConfig.ton_stargift_resale_amount_max,
    tonStargiftResaleCommissionPermille: appConfig.ton_stargift_resale_commission_permille,
    starsSuggestedPostAmountMax: appConfig.stars_suggested_post_amount_max,
    starsSuggestedPostAmountMin: appConfig.stars_suggested_post_amount_min,
    starsSuggestedPostCommissionPermille: appConfig.stars_suggested_post_commission_permille,
    starsSuggestedPostAgeMin: appConfig.stars_suggested_post_age_min,
    starsSuggestedPostFutureMax: appConfig.stars_suggested_post_future_max,
    starsSuggestedPostFutureMin: appConfig.stars_suggested_post_future_min,
    tonSuggestedPostCommissionPermille: appConfig.ton_suggested_post_commission_permille,
    tonSuggestedPostAmountMax: appConfig.ton_suggested_post_amount_max,
    tonSuggestedPostAmountMin: appConfig.ton_suggested_post_amount_min,
    tonUsdRate: appConfig.ton_usd_rate,
    tonTopupUrl: appConfig.ton_topup_url,
    pollMaxAnswers: appConfig.poll_answers_max,
    todoItemsMax: appConfig.todo_items_max,
    todoTitleLengthMax: appConfig.todo_title_length_max,
    todoItemLengthMax: appConfig.todo_item_length_max,
    ignoreRestrictionReasons: appConfig.ignore_restriction_reasons,
    needAgeVideoVerification: appConfig.need_age_video_verification,
    verifyAgeBotUsername: appConfig.verify_age_bot_username,
    verifyAgeCountry: appConfig.verify_age_country,
    verifyAgeMin: appConfig.verify_age_min,
  };

  return {
    ...DEFAULT_APP_CONFIG,
    ...omitUndefined(config),
  };
}
