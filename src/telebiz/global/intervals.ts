import { addCallback } from '../../lib/teact/teactn';
import { getActions, getGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { selectCurrentMessageList, selectTabState } from '../../global/selectors';
import { selectIsTelebizAuthenticated, selectTelebizSelectedRelationship } from './selectors';

const RELATIONSHIPS_REFETCH_INTERVAL = 10 * 60 * 1000; // 10 min
const ACTIVE_RELATIONSHIP_REFETCH_INTERVAL = 2 * 60 * 1000; // 2 min
const ACTIVITY_SYNC_INTERVAL = 2 * 60 * 1000; // 2 min
const NOTIFICATIONS_REFETCH_INTERVAL = 1 * 60 * 1000; // 1 min

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
  intervals.push(window.setInterval(fetchRelationships, RELATIONSHIPS_REFETCH_INTERVAL));
  intervals.push(window.setInterval(fetchActiveRelationship, ACTIVE_RELATIONSHIP_REFETCH_INTERVAL));
  intervals.push(window.setInterval(syncChatActivities, ACTIVITY_SYNC_INTERVAL));
  intervals.push(window.setInterval(fetchNotifications, NOTIFICATIONS_REFETCH_INTERVAL));
}

function stopIntervals() {
  intervals.forEach((interval) => clearInterval(interval));
  intervals = [];
}

function fetchRelationships() {
  const global = getGlobal();
  if (!selectIsTelebizAuthenticated(global)) return;

  getActions().loadTelebizRelationships();
}

function fetchActiveRelationship() {
  const global = getGlobal();
  if (!selectIsTelebizAuthenticated(global)) return;
  const { chatId } = selectCurrentMessageList(global) || {};
  if (!chatId) return;
  const activeRelationship = selectTelebizSelectedRelationship(global, chatId);
  if (!activeRelationship) return;

  getActions().loadTelebizEntity({
    integrationId: activeRelationship.integration_id,
    entityType: activeRelationship.entity_type,
    entityId: activeRelationship.entity_id,
    forceRefresh: true,
  });
}

function syncChatActivities() {
  const global = getGlobal();
  if (!selectIsTelebizAuthenticated(global)) return;

  getActions().syncTelebizChatActivities();
}

function fetchNotifications() {
  const global = getGlobal();
  if (!selectIsTelebizAuthenticated(global)) return;

  getActions().loadTelebizNotificationCounts();
}
