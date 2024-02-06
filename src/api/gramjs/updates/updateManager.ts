import { Api as GramJs } from '../../../lib/gramjs';
import { UpdateConnectionState, UpdateServerTimeOffset } from '../../../lib/gramjs/network';

import type { ApiChat } from '../../types';
import type { invokeRequest } from '../methods/client';
import type { Update } from './updater';

import { DEBUG } from '../../../config';
import SortedQueue from '../../../util/SortedQueue';
import { buildApiPeerId } from '../apiBuilders/peers';
import { buildInputEntity, buildMtpPeerId } from '../gramjsBuilders';
import { addEntitiesToLocalDb } from '../helpers';
import localDb from '../localDb';
import { dispatchUserAndChatUpdates, sendUpdate, updater } from './updater';

import { buildLocalUpdatePts, type UpdatePts } from './UpdatePts';

export type State = {
  seq: number;
  date: number;
  pts: number;
  qts: number;
};
type SeqUpdate = (GramJs.Updates | GramJs.UpdatesCombined) & { _isFromDifference?: true };
type PtsUpdate = ((GramJs.TypeUpdate & { pts: number }) | UpdatePts) & { _isFromDifference?: true };

const COMMON_BOX_QUEUE_ID = '0';
const CHANNEL_DIFFERENCE_LIMIT = 1000;
const UPDATE_WAIT_TIMEOUT = 500;

let invoke: typeof invokeRequest;
let isInited = false;

let seqTimeout: ReturnType<typeof setTimeout> | undefined;
const PTS_TIMEOUTS = new Map<string, ReturnType<typeof setTimeout>>();

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
      // eslint-disable-next-line no-underscore-dangle
      (update as SeqUpdate)._isFromDifference = true;
    }

    saveSeqUpdate(update, shouldOnlySave);
    return;
  }

  if ('pts' in update) {
    if (update instanceof GramJs.UpdateChannelTooLong) {
      getChannelDifference(getUpdateChannelId(update));
      return;
    }
    if (isFromDifference) {
      // eslint-disable-next-line no-underscore-dangle
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
    const entities = updateObject.users.concat(updateObject.chats);

    updateObject.updates.forEach((update) => {
      if (entities) {
        // eslint-disable-next-line no-underscore-dangle
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

  // eslint-disable-next-line no-underscore-dangle
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
      // eslint-disable-next-line no-console
      // console.error('[UpdateManager] Got pts update without local state', channelId);
    }
    return;
  }

  // eslint-disable-next-line no-underscore-dangle
  if (update._isFromDifference && pts >= localPts + ptsCount) {
    applyUpdate(update);
  } else if (pts === localPts + ptsCount) {
    clearTimeout(PTS_TIMEOUTS.get(channelId));
    PTS_TIMEOUTS.delete(channelId);

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
  if (PTS_TIMEOUTS.has(channelId)) return;

  const timeout = setTimeout(async () => {
    await getChannelDifference(channelId);
    PTS_TIMEOUTS.delete(channelId);
  }, UPDATE_WAIT_TIMEOUT);
  PTS_TIMEOUTS.set(channelId, timeout);
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

  sendUpdate({
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
    sendUpdate({
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

  sendUpdate({
    '@type': 'updateFetchingDifference',
    isFetching: false,
  });
}

async function getChannelDifference(channelId: string) {
  const channel = localDb.chats[channelId];
  if (!channel || !(channel instanceof GramJs.Channel) || !channel.accessHash || !localDb.channelPtsById[channelId]) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[UpdateManager] Channel for difference not found', channelId, channel);
    }
    return;
  }

  const response = await invoke(new GramJs.updates.GetChannelDifference({
    channel: buildInputEntity(channelId, channel.accessHash.toString()) as GramJs.InputChannel,
    pts: localDb.channelPtsById[channelId],
    filter: new GramJs.ChannelMessagesFilterEmpty(),
    limit: CHANNEL_DIFFERENCE_LIMIT,
  }));

  if (!response) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[UpdatesManager] Failed to get ChannelDifference', channelId, channel);
    }
    return;
  }

  if (response instanceof GramJs.updates.ChannelDifferenceTooLong) {
    forceSync();
    return;
  }

  localDb.channelPtsById[channelId] = response.pts;

  if (response instanceof GramJs.updates.ChannelDifferenceEmpty) {
    popPtsQueue(channelId); // Continue processing updates in queue
    return;
  }

  processDifference(response, channelId);

  if (!response.final) {
    getChannelDifference(channelId);
  }
}

function forceSync() {
  reset();

  sendUpdate({
    '@type': 'requestSync',
  });

  loadRemoteState();
}

export function reset() {
  PTS_QUEUE.clear();
  SEQ_QUEUE.clear();

  clearTimeout(seqTimeout);
  seqTimeout = undefined;

  PTS_TIMEOUTS.forEach((timeout) => {
    clearTimeout(timeout);
  });
  PTS_TIMEOUTS.clear();

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

  addEntitiesToLocalDb(difference.users);
  addEntitiesToLocalDb(difference.chats);

  dispatchUserAndChatUpdates(difference.users);
  dispatchUserAndChatUpdates(difference.chats);

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
