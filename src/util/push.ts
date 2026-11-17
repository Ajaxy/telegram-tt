import { PUSH_IDB_STORE } from './browser/idb';
import { base64UrlToBuffer, bufferToBase64Url, isBase64Url } from './encoding/base64';
import { toChannelId } from './entities/ids';

export const PUSH_STATE_KEY = 'state';
export const PUSH_DISPLAY_LOCK = 'tt-push-display';
export const PUSH_REGISTRATION_LOCK = 'tt-push-registration';
export const PUSH_KEY_LENGTH = 256;
export const PUSH_KEY_ID_LENGTH = 8;
export const PUSH_MESSAGE_KEY_LENGTH = 16;
export const PUSH_BLOCK_LENGTH = 16;
export const PUSH_CLICK_PREFIX = 'click_';
export const PUSH_CLICK_TIMEOUT_MS = 2 * 60 * 1000;

export type PushRetry = {
  attempts: number;
  retryAt: number;
};

export type PushAccount = {
  slot: number;
  // Hidden previews use the random key fingerprint to prevent guessing the account's user ID
  userHash: string;
  keyId?: string;
  isTest?: boolean;
  shouldHidePreviews: boolean;
  shouldShowPreviewsWhenLocked: boolean;
  isEnabled: boolean;
  registrationRetry?: PushRetry & {
    tokenHash: string;
    keyId?: string;
    accountsHash: string;
  };
  registration?: {
    tokenHash: string;
    keyId?: string;
    accountsHash: string;
    subscribedAt: number;
  };
};

export type PushState = {
  accounts: Record<number, PushAccount>;
  hiddenMessage: string;
  isPaused?: boolean;
  hasPasscode?: boolean;
  revision: string;
  subscriptionRetry?: PushRetry;
};

export type PushData = {
  user_id: string;
  loc_key: string;
  title?: string;
  description?: string;
  message?: string;
  mute?: boolean;
  custom: Record<string, string>;
};

export type PushEnvelope = { p: string } | PushData;

export type PushTarget = {
  chatId?: string;
  messageId?: number;
  threadId?: number;
  storyId?: number;
  isStoryReaction?: boolean;
  kind?: 'message' | 'reaction' | 'story';
};

export type PushNotification = PushTarget & {
  slot: number;
  userHash: string;
  title: string;
  body: string;
  p?: string;
  isSilent?: boolean;
  shouldUseSystemSound?: boolean;
  icon?: string;
  shouldReplaceHistory?: boolean;
  isGeneric?: boolean;
  id?: string;
  clientId?: string;
  clickedAt?: number;
  revision?: string;
  lockEpoch?: number;
};

export function readPushState() {
  return PUSH_IDB_STORE.get<PushState>(PUSH_STATE_KEY);
}

export async function hashPushValue(value: string) {
  return bufferToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

export async function getPushKeyId(key: Uint8Array<ArrayBuffer>) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', key));
  return bufferToBase64Url(hash.slice(-PUSH_KEY_ID_LENGTH));
}

export function readPushKeyId(payload: string) {
  if (!isBase64Url(payload)) return undefined;
  try {
    const bytes = base64UrlToBuffer(payload);
    const headerLength = PUSH_KEY_ID_LENGTH + PUSH_MESSAGE_KEY_LENGTH;
    if (bytes.length < headerLength + PUSH_BLOCK_LENGTH || (bytes.length - headerLength) % PUSH_BLOCK_LENGTH) {
      return undefined;
    }
    return bufferToBase64Url(bytes.slice(0, PUSH_KEY_ID_LENGTH));
  } catch {
    return undefined;
  }
}

export function parsePushEnvelope(value: unknown): PushEnvelope | undefined {
  if (!isPushObject(value)) return undefined;
  const data = isPushObject(value.data) ? value.data : value;
  if ('p' in data) {
    return typeof data.p === 'string' && readPushKeyId(data.p) ? { p: data.p } : undefined;
  }
  const userId = readPushId(data.user_id);
  if (!userId || typeof data.loc_key !== 'string' || !/^[A-Z_0-9]+$/.test(data.loc_key)) return undefined;
  const custom: Record<string, string> = {};
  if (isPushObject(data.custom)) {
    Object.entries(data.custom).forEach(([key, field]) => {
      if (typeof field === 'string' || (typeof field === 'number' && Number.isSafeInteger(field))) {
        custom[key] = String(field);
      }
    });
  }
  return {
    user_id: userId,
    loc_key: data.loc_key,
    title: typeof data.title === 'string' ? data.title : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
    mute: data.mute === '1' || data.mute === 1 || data.mute === true,
    custom,
  };
}

export function getPushTarget(data: PushData): PushTarget {
  const custom = data.custom;
  const channelId = readPushId(custom.channel_id);
  const groupId = readPushId(custom.chat_id);
  const userId = readPushId(custom.from_id);
  const isStoryReaction = data.loc_key.startsWith('REACT_STORY');
  const isStory = data.loc_key.startsWith('STORY_') || isStoryReaction;
  return {
    chatId: channelId ? toChannelId(channelId) : groupId ? `-${groupId}` : userId,
    messageId: readPushMessageId(custom.msg_id),
    threadId: readPushMessageId(custom.top_msg_id || custom.topic_id),
    storyId: isStory ? readPushMessageId(custom.story_id || custom.msg_id) : undefined,
    isStoryReaction: isStoryReaction || undefined,
    kind: isStory ? 'story' : data.loc_key.includes('REACT') ? 'reaction' : 'message',
  };
}

export function readPushMessageId(value: unknown) {
  const id = readPushId(value);
  if (!id) return undefined;
  const number = Number(id);
  return Number.isSafeInteger(number) ? number : undefined;
}

function readPushId(value: unknown) {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) return undefined;
  const text = String(value);
  return /^[1-9]\d*$/.test(text) ? text : undefined;
}

function isPushObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
