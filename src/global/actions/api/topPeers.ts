import type { ApiTopPeerCategory } from '../../../api/types';
import type { ActionReturnType, GlobalState } from '../../types';

import { unique } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { selectPeer } from '../../selectors';

const TOP_PEERS_CACHE_TTL = 24 * 60 * 60; // 24 hours

addActionHandler('loadTopPeers', async (global, actions, payload): Promise<void> => {
  const { category, force } = payload;
  const current = global.topPeerCategories[category];
  const now = getServerTime();

  if (!force && current?.lastRequestedAt && now - current.lastRequestedAt < TOP_PEERS_CACHE_TTL) {
    return;
  }

  const result = await callApi('fetchTopPeers', { category });
  if (!result) {
    return;
  }

  global = getGlobal();
  const nextNow = getServerTime();
  const nextCurrent = global.topPeerCategories[category];

  if (result.type === 'unchanged') {
    global = updateTopPeerCategory(global, category, {
      ...nextCurrent,
      peerIds: nextCurrent?.peerIds || [],
      ratingsByPeerId: nextCurrent?.ratingsByPeerId || {},
      lastRequestedAt: nextNow,
    });
    setGlobal(global);
    return;
  }

  if (result.type === 'disabled') {
    global = updateTopPeerCategory(global, category, {
      peerIds: [],
      ratingsByPeerId: {},
      lastRequestedAt: nextNow,
      isDisabled: true,
    });
    setGlobal(global);
    return;
  }

  const ratingsByPeerId = result.topPeers.reduce((acc, { peerId, rating }) => {
    acc[peerId] = rating;
    return acc;
  }, {} as Record<string, number>);
  const peerIds = result.topPeers.map(({ peerId }) => peerId);

  global = updateTopPeerCategory(global, category, {
    peerIds,
    ratingsByPeerId,
    lastRequestedAt: nextNow,
    isDisabled: undefined,
  });
  setGlobal(global);
});

addActionHandler('removeTopPeer', async (global, actions, payload): Promise<void> => {
  const { category, peerId } = payload;
  const current = global.topPeerCategories[category];
  if (!current) {
    return;
  }

  const peerIds = current.peerIds.filter((id) => id !== peerId);
  const { [peerId]: removedRating, ...ratingsByPeerId } = current.ratingsByPeerId;

  global = updateTopPeerCategory(global, category, {
    ...current,
    peerIds,
    ratingsByPeerId,
  });
  setGlobal(global);

  const peer = selectPeer(global, peerId);
  if (peer) {
    await callApi('resetTopPeerRating', { category, peer });
  }
});

addActionHandler('bumpTopPeerRating', (global, actions, payload): ActionReturnType => {
  const { category, peerId, date } = payload;
  const current = global.topPeerCategories[category];
  const ratingEDecay = global.config?.ratingEDecay;
  if (!ratingEDecay || current?.isDisabled) {
    return;
  }

  const ratingDate = date || getServerTime();
  const basePeerIds = current?.peerIds || [];
  const peerIds = unique([...basePeerIds, peerId]);
  const ratingsByPeerId = { ...current?.ratingsByPeerId };
  const normalizeRate = current?.lastRequestedAt || ratingDate;

  ratingsByPeerId[peerId] = (ratingsByPeerId[peerId] || 0) + Math.exp((ratingDate - normalizeRate) / ratingEDecay);
  peerIds.sort((firstId, secondId) => (ratingsByPeerId[secondId] || 0) - (ratingsByPeerId[firstId] || 0));

  return updateTopPeerCategory(global, category, {
    peerIds,
    ratingsByPeerId,
    lastRequestedAt: normalizeRate,
    isDisabled: undefined,
  });
});

function updateTopPeerCategory<T extends GlobalState>(
  global: T,
  category: ApiTopPeerCategory,
  categoryState: NonNullable<GlobalState['topPeerCategories'][ApiTopPeerCategory]>,
): T {
  return {
    ...global,
    topPeerCategories: {
      ...global.topPeerCategories,
      [category]: categoryState,
    },
  };
}
