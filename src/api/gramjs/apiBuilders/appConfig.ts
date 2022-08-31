/* eslint-disable @typescript-eslint/naming-convention */
import BigInt from 'big-integer';
import localDb from '../localDb';
import { Api as GramJs } from '../../../lib/gramjs';
import type { ApiAppConfig } from '../../types';
import type { ApiLimitType } from '../../../global/types';
import { buildJson } from './misc';
import { DEFAULT_LIMITS } from '../../../config';

type LimitType = 'default' | 'premium';
type Limit = 'upload_max_fileparts' | 'stickers_faved_limit' | 'saved_gifs_limit' | 'dialog_filters_chats_limit' |
'dialog_filters_limit' | 'dialogs_folder_pinned_limit' | 'dialogs_pinned_limit' | 'caption_length_limit' |
'channels_limit' | 'channels_public_limit' | 'about_length_limit';
type LimitKey = `${Limit}_${LimitType}`;
type LimitsConfig = Record<LimitKey, number>;

interface GramJsAppConfig extends LimitsConfig {
  emojies_sounds: Record<string, {
    id: string;
    access_hash: string;
    file_reference_base64: string;
  }>;
  emojies_send_dice: string[];
  groupcall_video_participants_max: number;
  reactions_default: string;
  reactions_uniq_max: number;
  chat_read_mark_size_threshold: number;
  chat_read_mark_expire_period: number;
  autologin_domains: string[];
  autologin_token: string;
  url_auth_domains: string[];
  premium_purchase_blocked: boolean;
  premium_bot_username: string;
  premium_invoice_slug: string;
  premium_promo_order: string[];
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
      fileReference: Buffer.from(atob(l.file_reference_base64
        .replace(/-/g, '+')
        .replace(/_/g, '/'))),
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

export function buildAppConfig(json: GramJs.TypeJSONValue): ApiAppConfig {
  const appConfig = buildJson(json) as GramJsAppConfig;

  return {
    emojiSounds: buildEmojiSounds(appConfig),
    defaultReaction: appConfig.reactions_default,
    seenByMaxChatMembers: appConfig.chat_read_mark_size_threshold,
    seenByExpiresAt: appConfig.chat_read_mark_expire_period,
    autologinDomains: appConfig.autologin_domains || [],
    autologinToken: appConfig.autologin_token || '',
    urlAuthDomains: appConfig.url_auth_domains || [],
    premiumBotUsername: appConfig.premium_bot_username,
    premiumInvoiceSlug: appConfig.premium_invoice_slug,
    premiumPromoOrder: appConfig.premium_promo_order,
    isPremiumPurchaseBlocked: appConfig.premium_purchase_blocked,
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
    },
  };
}
