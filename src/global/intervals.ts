import { addCallback } from '../lib/teact/teactn';
import { getGlobal, setGlobal } from '.';

import type { GlobalState } from './types';

import { getServerTime } from '../util/serverTime';
import { removeUserStory } from './reducers';
import { selectTabState } from './selectors';

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
  let global = getGlobal();
  const serverTime = getServerTime();

  Object.values(global.stories.byUserId).forEach((userStories) => {
    const stories = Object.values(userStories.byId);
    stories.forEach((story) => {
      if (!('expireDate' in story)) return;
      if (story.expireDate > serverTime) return;
      if ('isPinned' in story && story.isPinned) return;
      if ('isPublic' in story && !story.isPublic) return;

      global = removeUserStory(global, story.userId, story.id);
    });
  });

  setGlobal(global);
}
