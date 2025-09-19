import type { AccountInfo, SessionUserInfo, SharedSessionData } from '../types';

import {
  ACCOUNT_QUERY,
  DATA_BROADCAST_CHANNEL_PREFIX,
  ESTABLISH_BROADCAST_CHANNEL_PREFIX,
  GLOBAL_STATE_CACHE_PREFIX,
  MULTITAB_LOCALSTORAGE_KEY_PREFIX,
  SESSION_ACCOUNT_PREFIX,
} from '../config';
import { IS_MULTIACCOUNT_SUPPORTED } from './browser/globalEnvironment';

const WORKER_NAME = typeof WorkerGlobalScope !== 'undefined' && globalThis.self instanceof WorkerGlobalScope
  ? globalThis.self.name : undefined;
const WORKER_ACCOUNT_SLOT = WORKER_NAME ? Number(new URLSearchParams(WORKER_NAME).get(ACCOUNT_QUERY)) : undefined;

export const ACCOUNT_SLOT = WORKER_ACCOUNT_SLOT || (
  IS_MULTIACCOUNT_SUPPORTED ? getAccountSlot(globalThis.location.href) : undefined
);

export const DATA_BROADCAST_CHANNEL_NAME = `${DATA_BROADCAST_CHANNEL_PREFIX}_${ACCOUNT_SLOT || 1}`;
export const ESTABLISH_BROADCAST_CHANNEL_NAME = `${ESTABLISH_BROADCAST_CHANNEL_PREFIX}_${ACCOUNT_SLOT || 1}`;
export const MULTITAB_STORAGE_KEY = `${MULTITAB_LOCALSTORAGE_KEY_PREFIX}_${ACCOUNT_SLOT || 1}`;
export const GLOBAL_STATE_CACHE_KEY = ACCOUNT_SLOT
  ? `${GLOBAL_STATE_CACHE_PREFIX}_${ACCOUNT_SLOT}` : GLOBAL_STATE_CACHE_PREFIX;

export function getAccountSlot(url: string) {
  const params = new URL(url).searchParams;
  const slot = params.get(ACCOUNT_QUERY);
  const slotNumber = slot ? Number(slot) : 1;
  if (!slotNumber || Number.isNaN(slotNumber) || slotNumber === 1) return undefined;
  return slotNumber;
}

export function getAccountsInfo() {
  if (!IS_MULTIACCOUNT_SUPPORTED) return {};
  const allKeys = Object.keys(localStorage);
  const allSlots = allKeys.filter((key) => key.startsWith(SESSION_ACCOUNT_PREFIX));
  const accountInfo: Record<number, AccountInfo> = {};
  for (const key of allSlots) {
    const i = Number(key.slice(SESSION_ACCOUNT_PREFIX.length));
    const info = getAccountInfo(i);
    if (info) {
      accountInfo[i] = info;
    }
  }
  return accountInfo;
}

function getAccountInfo(slot: number): AccountInfo | undefined {
  const sessionData = loadSlotSession(slot);
  const {
    userId, avatarUri, color, emojiStatusId, firstName, lastName, isPremium, isTest, phone,
  } = sessionData || {};

  if (!userId) return undefined;

  return {
    userId,
    avatarUri,
    color,
    emojiStatusId,
    firstName,
    lastName,
    isPremium,
    isTest,
    phone,
  };
}

export function loadSlotSession(slot: number | undefined): SharedSessionData | undefined {
  try {
    const data = JSON.parse(localStorage.getItem(`${SESSION_ACCOUNT_PREFIX}${slot || 1}`) || '{}') as SharedSessionData;
    if (!data.dcId) return undefined;
    return data;
  } catch (e) {
    return undefined;
  }
}

export function storeAccountData(slot: number | undefined, data: Partial<SessionUserInfo>) {
  const currentSlotData = loadSlotSession(slot);

  if (!currentSlotData) return;

  const updatedSharedData: SharedSessionData = {
    ...currentSlotData,
    ...data,
  };

  if (!updatedSharedData.userId) return;

  writeSlotSession(slot, updatedSharedData);
}

export function writeSlotSession(slot: number | undefined, data: SharedSessionData) {
  localStorage.setItem(`${SESSION_ACCOUNT_PREFIX}${slot || 1}`, JSON.stringify(data));
}

export function getAccountSlotUrl(slot: number, forLogin?: boolean, isTest?: boolean) {
  const url = new URL(globalThis.location.href);
  if (slot !== 1) {
    url.searchParams.set(ACCOUNT_QUERY, String(slot));
  } else {
    url.searchParams.delete(ACCOUNT_QUERY);
  }

  if (isTest) {
    url.searchParams.set('test', 'true');
  } else {
    url.searchParams.delete('test');
  }

  url.hash = forLogin ? 'login' : '';
  return url.toString();
}

// Validate current version across all tabs to avoid conflicts
if (typeof window === 'object') {
  const versionChannel = new BroadcastChannel('tt-version');
  versionChannel.postMessage({ version: APP_VERSION });

  versionChannel.addEventListener('message', (event) => {
    const { version } = event.data;
    if (!version) return;
    if (semverCompare(APP_VERSION, version) === -1) {
      window.location.reload();
    }

    // If incoming version is older, send back the current version
    if (semverCompare(APP_VERSION, version) === 1) {
      versionChannel.postMessage({ version: APP_VERSION });
    }
  });
}

function semverCompare(a: string, b: string) {
  if (a.startsWith(`${b}-`)) return -1;
  if (b.startsWith(`${a}-`)) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'case', caseFirst: 'upper' });
}
