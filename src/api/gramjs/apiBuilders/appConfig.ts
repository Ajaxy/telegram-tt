/* eslint-disable @typescript-eslint/naming-convention */
import BigInt from 'big-integer';
import localDb from '../localDb';
import { Api as GramJs } from '../../../lib/gramjs';
import type { ApiAppConfig } from '../../types';
import { buildJson } from './misc';

type GramJsAppConfig = {
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
};

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
  };
}
