import { Api as GramJs, type Update } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';
import { UpdateConnectionState, UpdateServerTimeOffset } from '../../../lib/gramjs/network';
import type { Entity } from '../../../lib/gramjs/types';

import type { ApiChat } from '../../types';
import type { invokeRequest } from '../methods/client';

import { DEBUG } from '../../../config';
import SortedQueue from '../../../util/SortedQueue';
import { buildApiPeerId } from '../apiBuilders/peers';
import { buildInputChannel, buildMtpPeerId } from '../gramjsBuilders';
import localDb from '../localDb';
import { sendApiUpdate } from './apiUpdateEmitter';
import { processAndUpdateEntities } from './entityProcessor';
import { updater } from './mtpUpdateHandler';

import { buildLocalUpdatePts, type UpdatePts } from './UpdatePts';

export type State = {
  seq: number;
  date: number;
  pts: number;
  qts: number;
};
type SeqUpdate = (GramJs.Updates | GramJs.UpdatesCombined) & { _isFromDifference?: true };
type PtsUpdate = ((GramJs.TypeUpdate & { pts: number }) | UpdatePts) & { _isFromDifference?: true };
type ChannelDifferenceReason = 'gapRecovery' | 'shortpoll';
type ChannelScheduler = {
  timeout?: number;
  deadline?: number;
  reason?: ChannelDifferenceReason;
  isInFlight: boolean;
  shortpollTimeoutMs?: number;
  isShortpollEligible?: boolean;
};

const COMMON_BOX_QUEUE_ID = '0';

const SHORTPOLL_CHANNEL_DIFFERENCE_LIMIT = 100;
const CATCH_UP_CHANNEL_DIFFERENCE_LIMIT = 1000;

const SHORTPOLL_DEFAULT_TIMEOUT_MS = 1000;
const INITIAL_SHORTPOLL_TIMEOUT_MS = 10000;
const CHANNEL_DIFFERENCE_RETRY_TIMEOUT_MS = 5000;
const UPDATE_WAIT_TIMEOUT = 500;

const TERMINAL_CHANNEL_DIFFERENCE_ERRORS = new Set([
  'CHANNEL_INVALID',
  'CHANNEL_PRIVATE',
]);

let invoke: typeof invokeRequest;
let isInited = false;

let seqTimeout: number | undefined;
const CHANNEL_SCHEDULERS = new Map<string, ChannelScheduler>();
const OPENED_CHANNEL_IDS = new Set<string>();

const SEQ_QUEUE = new SortedQueue<SeqUpdate>(seqComparator);
const PTS_QUEUE = new Map<string, SortedQueue<PtsUpdate>>();

export async function init(invokeReq: typeof invokeRequest) {
  invoke = invokeReq;

  await loadRemoteState();
  isInited = true;

  scheduleGetDifference();
}

export function applyState(state: State) {
  localDb.commonBoxState.seq = state.seq;
  localDb.commonBoxState.date = state.date;
  localDb.commonBoxState.pts = state.pts;
  localDb.commonBoxState.qts = state.qts;
}

export function processUpdate(update: Update, isFromDifference?: boolean, shouldOnlySave?: boolean) {
  if (update instanceof UpdateConnectionState) {
    if (update.state === UpdateConnectionState.connected && isInited) {
      scheduleGetDifference();
    }

    updater(update);
    return;
  }

  if (update instanceof UpdateServerTimeOffset) {
    updater(update);
    return;
  }

  if (localDb.commonBoxState.seq === undefined) {
    // Drop updates received before first sync
    return;
  }

  if (update instanceof GramJs.Updates || update instanceof GramJs.UpdatesCombined) {
    if (isFromDifference) {
      (update as SeqUpdate)._isFromDifference = true;
    }

    saveSeqUpdate(update, shouldOnlySave);
    return;
  }

  if ('pts' in update) {
    if (update instanceof GramJs.UpdateChannelTooLong) {
      scheduleChannelDifference(getUpdateChannelId(update), 'gapRecovery', 0);
      return;
    }
    if (isFromDifference) {
      (update as PtsUpdate)._isFromDifference = true;
    }
    savePtsUpdate(update, shouldOnlySave);
    return;
  }

  updater(update);
}

export function updateChannelState(channelId: string, pts: number) {
  const channel = localDb.chats[channelId];
  if (!(channel instanceof GramJs.Channel)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(`[UpdateManager] Channel ${channelId} not found in localDb`);
    }
    return;
  }

  const currentState = localDb.channelPtsById[channelId];

  if (currentState && currentState < pts) {
    scheduleGetChannelDifference(channelId);
    return;
  }

  localDb.channelPtsById[channelId] = pts;
}

function applyUpdate(updateObject: SeqUpdate | PtsUpdate) {
  if ('seq' in updateObject && updateObject.seq) {
    localDb.commonBoxState.seq = updateObject.seq;
    localDb.commonBoxState.date = updateObject.date;
  }

  if ('qts' in updateObject) {
    localDb.commonBoxState.qts = updateObject.qts;
  }

  if ('pts' in updateObject) {
    const channelId = getUpdateChannelId(updateObject);
    if (channelId !== COMMON_BOX_QUEUE_ID) {
      localDb.channelPtsById[channelId] = updateObject.pts;
    } else {
      localDb.commonBoxState.pts = updateObject.pts;
    }
  }

  if (updateObject instanceof GramJs.UpdatesCombined || updateObject instanceof GramJs.Updates) {
    processAndUpdateEntities(updateObject);
    const entities = (updateObject.users as Entity[]).concat(updateObject.chats);

    updateObject.updates.forEach((update) => {
      if (entities) {
        (update as any)._entities = entities;
      }

      processUpdate(update);
    });
  } else {
    updater(updateObject);
  }
}

function saveSeqUpdate(update: GramJs.Updates | GramJs.UpdatesCombined, shouldOnlySave?: boolean) {
  SEQ_QUEUE.add(update);

  if (!shouldOnlySave) popSeqQueue();
}

function savePtsUpdate(update: PtsUpdate, shouldOnlySave?: boolean) {
  const channelId = getUpdateChannelId(update);

  const ptsQueue = PTS_QUEUE.get(channelId) || new SortedQueue<PtsUpdate>(ptsComparator);
  ptsQueue.add(update);

  PTS_QUEUE.set(channelId, ptsQueue);

  if (!shouldOnlySave) popPtsQueue(channelId);
}

function popSeqQueue() {
  if (!SEQ_QUEUE.size) return;

  const update = SEQ_QUEUE.pop()!;
  const localSeq = localDb.commonBoxState.seq;
  const seqStart = 'seqStart' in update ? update.seqStart : update.seq;

  if (seqStart === 0 || (update._isFromDifference && seqStart >= localSeq + 1)) {
    applyUpdate(update);
  } else if (seqStart === localSeq + 1) {
    clearTimeout(seqTimeout);
    seqTimeout = undefined;

    applyUpdate(update);
  } else if (seqStart > localSeq + 1) {
    SEQ_QUEUE.add(update); // Return update to queue
    scheduleGetDifference();
    return; // Prevent endless loop
  }

  popSeqQueue();
}

function popPtsQueue(channelId: string) {
  const ptsQueue = PTS_QUEUE.get(channelId);
  if (!ptsQueue?.size) return;

  const update = ptsQueue.pop()!;
  const localPts = channelId === COMMON_BOX_QUEUE_ID ? localDb.commonBoxState.pts : localDb.channelPtsById[channelId];
  const pts = update.pts;
  const ptsCount = getPtsCount(update);

  // Sometimes server sends updates for channels that are opened in other clients. We ignore them
  if (localPts === undefined) {
    if (DEBUG) {
      // Uncomment to debug missing updates

      // console.error('[UpdateManager] Got pts update without local state', channelId);
    }
    return;
  }

  if (update._isFromDifference && pts >= localPts + ptsCount) {
    applyUpdate(update);
  } else if (pts === localPts + ptsCount) {
    clearScheduledChannelDifference(channelId, 'gapRecovery');
    scheduleShortpollFromNow(channelId);

    applyUpdate(update);
  } else if (pts > localPts + ptsCount) {
    ptsQueue.add(update); // Return update to queue
    if (channelId === COMMON_BOX_QUEUE_ID) {
      scheduleGetDifference();
    } else {
      scheduleGetChannelDifference(channelId);
    }
    return; // Prevent endless loop
  }

  popPtsQueue(channelId);
}

export function scheduleGetChannelDifference(channelId: string) {
  scheduleChannelDifference(channelId, 'gapRecovery', UPDATE_WAIT_TIMEOUT);
}

export function requestChannelDifference(channelId: string) {
  scheduleChannelDifference(channelId, 'gapRecovery', 0);
}

export function setOpenedChannelIds(channelIds: string[]) {
  const nextOpenedChannelIds = new Set(channelIds);

  OPENED_CHANNEL_IDS.forEach((channelId) => {
    if (nextOpenedChannelIds.has(channelId)) {
      return;
    }

    getOrCreateChannelScheduler(channelId).isShortpollEligible = false;
    clearScheduledChannelDifference(channelId, 'shortpoll');
  });

  channelIds.forEach((channelId) => {
    const scheduler = getOrCreateChannelScheduler(channelId);
    const wasOpened = OPENED_CHANNEL_IDS.has(channelId);

    scheduler.isShortpollEligible = true;

    if (!wasOpened) {
      if (scheduler.shortpollTimeoutMs !== undefined) {
        restartShortpollFromNow(channelId);
      } else {
        scheduleChannelDifference(channelId, 'shortpoll', INITIAL_SHORTPOLL_TIMEOUT_MS);
      }
    }
  });

  OPENED_CHANNEL_IDS.clear();
  channelIds.forEach((channelId) => {
    OPENED_CHANNEL_IDS.add(channelId);
  });
}

function getOrCreateChannelScheduler(channelId: string) {
  const current = CHANNEL_SCHEDULERS.get(channelId);
  if (current) {
    return current;
  }

  const scheduler: ChannelScheduler = {
    isInFlight: false,
  };
  CHANNEL_SCHEDULERS.set(channelId, scheduler);
  return scheduler;
}

function scheduleChannelDifference(channelId: string, reason: ChannelDifferenceReason, timeoutMs: number) {
  const scheduler = getOrCreateChannelScheduler(channelId);
  const deadline = Date.now() + timeoutMs;
  if (scheduler.deadline !== undefined && scheduler.deadline <= deadline) {
    return;
  }

  clearScheduledChannelDifference(channelId);

  scheduler.reason = reason;
  scheduler.deadline = deadline;
  scheduler.timeout = setTimeout(() => {
    scheduler.timeout = undefined;
    scheduler.deadline = undefined;
    if (scheduler.isInFlight) {
      scheduleChannelDifference(channelId, reason, UPDATE_WAIT_TIMEOUT);
      return;
    }

    void runChannelDifference(channelId, reason);
  }, timeoutMs);
}

function clearScheduledChannelDifference(channelId: string, reason?: ChannelDifferenceReason) {
  const scheduler = CHANNEL_SCHEDULERS.get(channelId);
  if (!scheduler?.timeout || (reason && scheduler.reason !== reason)) {
    return;
  }

  clearTimeout(scheduler.timeout);
  scheduler.timeout = undefined;
  scheduler.deadline = undefined;
  scheduler.reason = undefined;
}

function scheduleShortpollFromNow(channelId: string) {
  const scheduler = CHANNEL_SCHEDULERS.get(channelId);
  if (!scheduler?.isShortpollEligible || scheduler.shortpollTimeoutMs === undefined) {
    return;
  }

  scheduleChannelDifference(channelId, 'shortpoll', scheduler.shortpollTimeoutMs);
}

function restartShortpollFromNow(channelId: string) {
  const scheduler = CHANNEL_SCHEDULERS.get(channelId);
  if (!scheduler?.isShortpollEligible || scheduler.shortpollTimeoutMs === undefined || scheduler.isInFlight) {
    return;
  }

  if (scheduler.reason === 'shortpoll') {
    clearScheduledChannelDifference(channelId);
  }

  scheduleChannelDifference(channelId, 'shortpoll', scheduler.shortpollTimeoutMs);
}

function scheduleGetDifference() {
  if (seqTimeout) return;

  seqTimeout = setTimeout(async () => {
    await getDifference();
    seqTimeout = undefined;
  }, UPDATE_WAIT_TIMEOUT);
}

function getUpdateChannelId(update: Update) {
  if ('channelId' in update && 'pts' in update) {
    return buildApiPeerId(update.channelId, 'channel');
  }

  if (update instanceof GramJs.UpdateNewChannelMessage || update instanceof GramJs.UpdateEditChannelMessage) {
    const peer = update.message.peerId as GramJs.PeerChannel;
    return buildApiPeerId(peer.channelId, 'channel');
  }

  return COMMON_BOX_QUEUE_ID;
}

export async function getDifference() {
  if (!isInited) {
    throw new Error('UpdatesManager not initialized');
  }

  if (!localDb.commonBoxState?.date) {
    forceSync();
    return;
  }

  sendApiUpdate({
    '@type': 'updateFetchingDifference',
    isFetching: true,
  });

  const response = await invoke(new GramJs.updates.GetDifference({
    pts: localDb.commonBoxState.pts,
    date: localDb.commonBoxState.date,
    qts: localDb.commonBoxState.qts,
  }));

  if (!response || response instanceof GramJs.updates.DifferenceTooLong) {
    forceSync();
    return;
  }

  if (response instanceof GramJs.updates.DifferenceEmpty) {
    localDb.commonBoxState.seq = response.seq;
    localDb.commonBoxState.date = response.date;
    sendApiUpdate({
      '@type': 'updateFetchingDifference',
      isFetching: false,
    });
    return;
  }

  processDifference(response);

  const newState = response instanceof GramJs.updates.DifferenceSlice ? response.intermediateState : response.state;
  applyState(newState);

  if (response instanceof GramJs.updates.DifferenceSlice) {
    getDifference();
    return;
  }

  sendApiUpdate({
    '@type': 'updateFetchingDifference',
    isFetching: false,
  });
}

async function runChannelDifference(channelId: string, reason: ChannelDifferenceReason) {
  const scheduler = getOrCreateChannelScheduler(channelId);
  if (scheduler.isInFlight) {
    return;
  }

  scheduler.isInFlight = true;
  scheduler.reason = reason;

  try {
    await requestChannelDifferenceInternal(channelId, reason);
  } finally {
    scheduler.isInFlight = false;
  }
}

async function requestChannelDifferenceInternal(channelId: string, reason: ChannelDifferenceReason): Promise<void> {
  const channel = localDb.chats[channelId];
  if (
    !channel
    || !(channel instanceof GramJs.Channel)
    || !channel.accessHash
    || localDb.channelPtsById[channelId] === undefined
  ) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[UpdateManager] Channel for difference not found', channelId, channel);
    }
    return;
  }

  const limit = reason === 'shortpoll' ? SHORTPOLL_CHANNEL_DIFFERENCE_LIMIT : CATCH_UP_CHANNEL_DIFFERENCE_LIMIT;
  let response: GramJs.updates.TypeChannelDifference;

  try {
    const result = await invoke(new GramJs.updates.GetChannelDifference({
      channel: buildInputChannel(channelId, channel.accessHash.toString()),
      pts: localDb.channelPtsById[channelId],
      filter: new GramJs.ChannelMessagesFilterEmpty(),
      limit,
    }), {
      shouldThrow: true,
    });
    if (!result) {
      return;
    }

    response = result;
  } catch (err) {
    handleChannelDifferenceError(channelId, reason, err);
    return;
  }

  if (response instanceof GramJs.updates.ChannelDifferenceTooLong) {
    forceSync();
    return;
  }

  localDb.channelPtsById[channelId] = response.pts;
  updateChannelShortpollTimeout(channelId, response);

  if (response instanceof GramJs.updates.ChannelDifferenceEmpty) {
    if (response.final) {
      scheduleShortpollIfEligible(channelId);
    }

    popPtsQueue(channelId); // Continue processing updates in queue
    return;
  }

  processDifference(response, channelId);

  if (!response.final) {
    await requestChannelDifferenceInternal(channelId, 'gapRecovery');
    return;
  }

  scheduleShortpollIfEligible(channelId);
}

function updateChannelShortpollTimeout(channelId: string, response: GramJs.updates.TypeChannelDifference) {
  const scheduler = getOrCreateChannelScheduler(channelId);
  scheduler.shortpollTimeoutMs = ('timeout' in response && response.timeout)
    ? response.timeout * 1000
    : SHORTPOLL_DEFAULT_TIMEOUT_MS;
}

function scheduleShortpollIfEligible(channelId: string) {
  const scheduler = getOrCreateChannelScheduler(channelId);
  if (!scheduler.isShortpollEligible) {
    return;
  }

  scheduleShortpollFromNow(channelId);
}

function handleChannelDifferenceError(channelId: string, reason: ChannelDifferenceReason, err: unknown) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.warn('[UpdatesManager] Failed to get ChannelDifference', channelId, err);
  }

  const scheduler = getOrCreateChannelScheduler(channelId);
  const errorMessage = err instanceof RPCError ? err.errorMessage : undefined;

  if (errorMessage && TERMINAL_CHANNEL_DIFFERENCE_ERRORS.has(errorMessage)) {
    scheduler.isShortpollEligible = false;
    clearScheduledChannelDifference(channelId);
    return;
  }

  scheduleChannelDifference(channelId, reason, CHANNEL_DIFFERENCE_RETRY_TIMEOUT_MS);
}

function forceSync() {
  reset();

  sendApiUpdate({
    '@type': 'requestSync',
  });

  loadRemoteState();
}

export function reset() {
  PTS_QUEUE.clear();
  SEQ_QUEUE.clear();

  clearTimeout(seqTimeout);
  seqTimeout = undefined;

  CHANNEL_SCHEDULERS.forEach(({ timeout }) => {
    if (!timeout) {
      return;
    }

    clearTimeout(timeout);
  });
  CHANNEL_SCHEDULERS.clear();
  OPENED_CHANNEL_IDS.clear();

  localDb.commonBoxState = {};

  Object.keys(localDb.channelPtsById).forEach((channelId) => {
    localDb.channelPtsById[channelId] = 0;
  });

  isInited = false;
}

export function processAffectedHistory(
  chat: ApiChat, affected: GramJs.messages.AffectedMessages | GramJs.messages.AffectedHistory,
) {
  const isChannel = chat.type === 'chatTypeChannel' || chat.type === 'chatTypeSuperGroup';
  const channeId = isChannel ? buildMtpPeerId(chat.id, 'channel') : undefined;
  const update = buildLocalUpdatePts(affected.pts, affected.ptsCount, channeId);

  processUpdate(update);
}

async function loadRemoteState() {
  const remoteState = await invoke(new GramJs.updates.GetState());
  if (!remoteState) return;

  applyState(remoteState);

  isInited = true;
}

function processDifference(
  difference: GramJs.updates.Difference | GramJs.updates.DifferenceSlice | GramJs.updates.ChannelDifference,
  channelId?: string,
) {
  difference.newMessages.forEach((message) => {
    updater(new GramJs.UpdateNewMessage({
      message,
      pts: 0,
      ptsCount: 0,
    }));
  });

  processAndUpdateEntities(difference);

  // Ignore `pts`/`seq` holes when applying updates from difference
  // BUT, if we got an `UpdateChannelTooLong`, make sure to process other updates after receiving `ChannelDifference`
  const channelTooLongIds = new Set<string>();

  difference.otherUpdates.forEach((update) => {
    const updateChannelId = getUpdateChannelId(update);

    if (update instanceof GramJs.UpdateChannelTooLong) {
      channelTooLongIds.add(getUpdateChannelId(update));
    }

    const shouldApplyImmediately = !channelTooLongIds.has(updateChannelId);
    processUpdate(update, shouldApplyImmediately, !shouldApplyImmediately);
  });

  // Continue processing updates in queues
  if (channelId) {
    popPtsQueue(channelId);
  } else {
    popSeqQueue();
  }
}

function getPtsCount(update: PtsUpdate) {
  return 'ptsCount' in update ? update.ptsCount : 0;
}

function seqComparator(a: SeqUpdate, b: SeqUpdate) {
  const seqA = 'seqStart' in a ? a.seqStart : a.seq;
  const seqB = 'seqStart' in b ? b.seqStart : b.seq;

  return seqA - seqB;
}

function ptsComparator(a: PtsUpdate, b: PtsUpdate) {
  const diff = a.pts - b.pts;
  if (diff !== 0) {
    return diff;
  }

  return getPtsCount(b) - getPtsCount(a);
}
