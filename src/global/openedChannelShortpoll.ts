import type { ThreadId } from '../types';
import type { GlobalState } from './types';

import { callApi } from '../api/gramjs';
import { isChatChannel, isChatSuperGroup } from './helpers';
import { selectCurrentMessageList, selectTabState } from './selectors';

const MAX_OPENED_CHANNELS = 10;

type OpenedChannelEntrySource = 'visible' | 'preview';

type OpenedChannelEntry = {
  key: string;
  channelId: string;
  source: OpenedChannelEntrySource;
};

let openedEntryMru: string[] = [];
let lastReportedChannelIds: string[] = [];

export function resetOpenedChannelShortpollState() {
  openedEntryMru = [];
  lastReportedChannelIds = [];
}

export function getOpenedShortpollChannelIds(global: GlobalState) {
  const openedEntries = buildOpenedChannelEntries(global);
  const entriesByKey = new Map(openedEntries.map((entry) => [entry.key, entry]));
  const openedKeys = new Set(entriesByKey.keys());

  openedEntryMru = openedEntryMru.filter((key) => openedKeys.has(key));

  openedEntries
    .map((entry) => entry.key)
    .reverse()
    .forEach((key) => {
      if (openedEntryMru.indexOf(key) === -1) {
        openedEntryMru.unshift(key);
      }
    });

  const channelIds: string[] = [];
  const channelIdsSet = new Set<string>();

  openedEntryMru.forEach((key) => {
    if (channelIds.length >= MAX_OPENED_CHANNELS) {
      return;
    }

    const entry = entriesByKey.get(key);
    if (!entry || channelIdsSet.has(entry.channelId)) {
      return;
    }

    channelIds.push(entry.channelId);
    channelIdsSet.add(entry.channelId);
  });

  return channelIds;
}

export function syncOpenedShortpollChannelIds(global: GlobalState) {
  if (!selectTabState(global).isMasterTab) {
    return;
  }

  const channelIds = getOpenedShortpollChannelIds(global);
  if (areArraysEqual(channelIds, lastReportedChannelIds)) {
    return;
  }

  lastReportedChannelIds = channelIds;
  void callApi('setOpenedChannelIds', channelIds);
}

function buildOpenedChannelEntries(global: GlobalState) {
  return Object.values(global.byTabId).flatMap(({ id: tabId, quickPreview }) => {
    const entries: OpenedChannelEntry[] = [];
    const currentMessageList = selectCurrentMessageList(global, tabId);

    if (currentMessageList && shouldShortpollChannel(global, currentMessageList.chatId)) {
      entries.push({
        key: buildOpenedChannelEntryKey(tabId, currentMessageList.chatId, currentMessageList.threadId, 'visible'),
        channelId: currentMessageList.chatId,
        source: 'visible',
      });
    }

    if (quickPreview && shouldShortpollChannel(global, quickPreview.chatId)) {
      entries.push({
        key: buildOpenedChannelEntryKey(tabId, quickPreview.chatId, quickPreview.threadId, 'preview'),
        channelId: quickPreview.chatId,
        source: 'preview',
      });
    }

    return entries;
  });
}

function shouldShortpollChannel(global: GlobalState, chatId: string) {
  const chat = global.chats.byId[chatId];
  return Boolean(chat && (isChatChannel(chat) || isChatSuperGroup(chat)));
}

function buildOpenedChannelEntryKey(
  tabId: number, chatId: string, threadId: ThreadId | undefined, source: OpenedChannelEntrySource,
) {
  return `${tabId}:${source}:${chatId}:${threadId || 0}`;
}

function areArraysEqual(first: string[], second: string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
