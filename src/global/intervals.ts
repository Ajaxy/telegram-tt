import { addCallback } from '../lib/teact/teactn';

import type { GlobalState } from './types';

import { EPHEMERAL_MESSAGE_TTL_SECONDS } from '../config';
import { getServerTime } from '../util/serverTime';
import { resetOpenedChannelShortpollState, syncOpenedShortpollChannelIds } from './openedChannelShortpoll';
import { deleteEphemeralMessages, removePeerStory } from './reducers';
import { selectTabState } from './selectors';
import { getGlobal, setGlobal } from '.';

const STORY_EXPIRATION_INTERVAL = 2 * 60 * 1000; // 2 min

let intervals: number[] = [];
let ephemeralExpirationTimer: number | undefined;

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  const previousGlobal = prevGlobal;
  prevGlobal = global;

  const isCurrentMaster = selectTabState(global)?.isMasterTab;
  const isPreviousMaster = previousGlobal && selectTabState(previousGlobal)?.isMasterTab;
  if (isCurrentMaster === isPreviousMaster) return;

  if (isCurrentMaster && !isPreviousMaster) {
    startIntervals(global);
  } else {
    stopIntervals();
  }
});

addCallback((global: GlobalState) => {
  if (!selectTabState(global)?.isMasterTab) {
    return;
  }

  syncOpenedShortpollChannelIds(global);
});

function startIntervals(global: GlobalState) {
  if (intervals.length) return;

  resetOpenedChannelShortpollState();
  intervals.push(window.setInterval(checkStoryExpiration, STORY_EXPIRATION_INTERVAL));
  syncOpenedShortpollChannelIds(global);
  scheduleEphemeralExpiration(global);
}

function stopIntervals() {
  resetOpenedChannelShortpollState();
  intervals.forEach((interval) => clearInterval(interval));
  intervals = [];
  clearTimeout(ephemeralExpirationTimer);
  ephemeralExpirationTimer = undefined;
}

function checkStoryExpiration() {
  let global = getGlobal();
  if (!global.isInited) return;

  const serverTime = getServerTime();

  Object.values(global.stories.byPeerId).forEach((peerStories) => {
    const stories = Object.values(peerStories.byId);
    stories.forEach((story) => {
      if (story['@type'] !== 'story') return;
      if (story.expireDate > serverTime) return;
      if (story.isInProfile) return;

      global = removePeerStory(global, story.peerId, story.id);
    });
  });

  setGlobal(global);
}

export function scheduleEphemeralExpiration(global: GlobalState) {
  clearTimeout(ephemeralExpirationTimer);

  let nextExpiration: number | undefined;
  Object.values(global.messages.byChatId).forEach(({ ephemeralById }) => {
    Object.values(ephemeralById).forEach((message) => {
      if (message.sendingState) return;

      const expiration = message.date + EPHEMERAL_MESSAGE_TTL_SECONDS;
      if (nextExpiration === undefined || expiration < nextExpiration) {
        nextExpiration = expiration;
      }
    });
  });

  if (nextExpiration === undefined) return;

  const delay = (nextExpiration - getServerTime()) * 1000;
  ephemeralExpirationTimer = window.setTimeout(expireEphemeralMessages, Math.max(delay, 0));
}

function expireEphemeralMessages() {
  let global = getGlobal();
  const serverTime = getServerTime();

  Object.entries(global.messages.byChatId).forEach(([chatId, { ephemeralById }]) => {
    const expiredIds = Object.values(ephemeralById)
      .filter((message) => !message.sendingState
        && message.date + EPHEMERAL_MESSAGE_TTL_SECONDS <= serverTime)
      .map(({ id }) => id);
    if (expiredIds.length) {
      global = deleteEphemeralMessages(global, chatId, expiredIds);
    }
  });

  setGlobal(global);
  scheduleEphemeralExpiration(global);
}
