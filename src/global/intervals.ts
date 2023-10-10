import { addCallback } from '../lib/teact/teactn';

import type { GlobalState } from './types';

import { getServerTime } from '../util/serverTime';
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
    startIntervals();
  } else {
    stopIntervals();
  }
});

function startIntervals() {
  if (intervals.length) return;
  intervals.push(window.setInterval(checkStoryExpiration, STORY_EXPIRATION_INTERVAL));
}

function stopIntervals() {
  intervals.forEach((interval) => clearInterval(interval));
  intervals = [];
}

function checkStoryExpiration() {
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
  let global = getGlobal();
  const serverTime = getServerTime();

  Object.values(global.stories.byPeerId).forEach((peerStories) => {
    const stories = Object.values(peerStories.byId);
    stories.forEach((story) => {
      if (!('expireDate' in story)) return;
      if (story.expireDate > serverTime) return;
      if ('isPinned' in story && story.isPinned) return;
      if ('isPublic' in story && !story.isPublic) return;

      global = removePeerStory(global, story.peerId, story.id);
    });
  });

  setGlobal(global);
}
