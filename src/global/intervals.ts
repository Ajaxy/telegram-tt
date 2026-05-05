import { addCallback } from '../lib/teact/teactn';

import type { GlobalState } from './types';

import { getServerTime } from '../util/serverTime';
import { resetOpenedChannelShortpollState, syncOpenedShortpollChannelIds } from './openedChannelShortpoll';
import { removePeerStory } from './reducers';
import { selectTabState } from './selectors';
import { getGlobal, setGlobal } from '.';

const STORY_EXPIRATION_INTERVAL = 2 * 60 * 1000; // 2 min

let intervals: number[] = [];

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
}

function stopIntervals() {
  resetOpenedChannelShortpollState();
  intervals.forEach((interval) => clearInterval(interval));
  intervals = [];
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
