import type { ApiSavedStarGift } from '../../../api/types';
import type { StarGiftCategory } from '../../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import { areInputSavedGiftsEqual, getRequestInputSavedStarGift } from '../../helpers/payments';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  appendStarsSubscriptions,
  appendStarsTransactions,
  replacePeerSavedGifts,
  updateStarsBalance,
  updateStarsSubscriptionLoading,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectPeer,
} from '../../selectors';

addActionHandler('loadStarStatus', async (global): Promise<void> => {
  const currentStatus = global.stars;
  const needsTopupOptions = !currentStatus?.topupOptions;

  const [status, topupOptions] = await Promise.all([
    callApi('fetchStarsStatus'),
    needsTopupOptions ? callApi('fetchStarsTopupOptions') : undefined,
  ]);

  if (!status || (needsTopupOptions && !topupOptions)) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    stars: {
      ...currentStatus,
      balance: status.balance,
      topupOptions: topupOptions || currentStatus!.topupOptions,
      history: {
        all: undefined,
        inbound: undefined,
        outbound: undefined,
      },
      subscriptions: undefined,
    },
  };

  if (status.history) {
    global = appendStarsTransactions(global, 'all', status.history, status.nextHistoryOffset);
  }

  if (status.subscriptions) {
    global = appendStarsSubscriptions(global, status.subscriptions, status.nextSubscriptionOffset);
  }

  setGlobal(global);
});

addActionHandler('loadStarsTransactions', async (global, actions, payload): Promise<void> => {
  const { type } = payload;

  const history = global.stars?.history[type];
  const offset = history?.nextOffset;
  if (history && !offset) return; // Already loaded all

  const result = await callApi('fetchStarsTransactions', {
    isInbound: type === 'inbound' || undefined,
    isOutbound: type === 'outbound' || undefined,
    offset: offset || '',
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  global = updateStarsBalance(global, result.balance);
  if (result.history) {
    global = appendStarsTransactions(global, type, result.history, result.nextOffset);
  }
  setGlobal(global);
});

addActionHandler('loadStarGifts', async (global): Promise<void> => {
  const result = await callApi('fetchStarGifts');

  if (!result) {
    return;
  }

  const byId = buildCollectionByKey(result, 'id');

  const idsByCategoryName: Record<StarGiftCategory, string[]> = {
    all: [],
    stock: [],
    limited: [],
  };

  const allStarGiftIds = Object.keys(byId);
  const allStarGifts = Object.values(byId);

  const limitedStarGiftIds = allStarGifts.map((gift) => (gift.isLimited ? gift.id : undefined))
    .filter(Boolean) as string[];

  const stockedStarGiftIds = allStarGifts.map((gift) => (
    gift.availabilityRemains || !gift.availabilityTotal ? gift.id : undefined
  )).filter(Boolean) as string[];

  idsByCategoryName.all = allStarGiftIds;
  idsByCategoryName.limited = limitedStarGiftIds;
  idsByCategoryName.stock = stockedStarGiftIds;

  allStarGifts.forEach((gift) => {
    const starsCategory = gift.stars;
    if (!idsByCategoryName[starsCategory]) {
      idsByCategoryName[starsCategory] = [];
    }
    idsByCategoryName[starsCategory].push(gift.id);
  });

  global = getGlobal();
  global = {
    ...global,
    starGifts: {
      byId,
      idsByCategory: idsByCategoryName,
    },
  };
  setGlobal(global);
});

addActionHandler('loadPeerSavedGifts', async (global, actions, payload): Promise<void> => {
  const { peerId, shouldRefresh } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const currentGifts = global.peers.giftsById[peerId];
  const localNextOffset = currentGifts?.nextOffset;

  if (!shouldRefresh && currentGifts && !localNextOffset) return; // Already loaded all

  const result = await callApi('fetchSavedStarGifts', {
    peer,
    offset: !shouldRefresh ? localNextOffset : '',
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  const newGifts = currentGifts && !shouldRefresh ? currentGifts.gifts.concat(result.gifts) : result.gifts;

  global = replacePeerSavedGifts(global, peerId, newGifts, result.nextOffset);
  setGlobal(global);
});

addActionHandler('loadStarsSubscriptions', async (global): Promise<void> => {
  const subscriptions = global.stars?.subscriptions;
  const offset = subscriptions?.nextOffset;
  if (subscriptions && !offset) return; // Already loaded all

  global = updateStarsSubscriptionLoading(global, true);
  setGlobal(global);

  const result = await callApi('fetchStarsSubscriptions', {
    offset: offset || '',
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  global = updateStarsBalance(global, result.balance);
  global = appendStarsSubscriptions(global, result.subscriptions, result.nextOffset);
  setGlobal(global);
});

addActionHandler('changeStarsSubscription', async (global, actions, payload): Promise<void> => {
  const { peerId, id, isCancelled } = payload;

  const peer = peerId ? selectPeer(global, peerId) : undefined;

  if (peerId && !peer) return;

  await callApi('changeStarsSubscription', {
    peer,
    subscriptionId: id,
    isCancelled,
  });

  actions.loadStarStatus();
});

addActionHandler('fulfillStarsSubscription', async (global, actions, payload): Promise<void> => {
  const { peerId, id } = payload;

  const peer = peerId ? selectPeer(global, peerId) : undefined;

  if (peerId && !peer) return;

  await callApi('fulfillStarsSubscription', {
    peer,
    subscriptionId: id,
  });

  actions.loadStarStatus();
});

addActionHandler('changeGiftVisibility', async (global, actions, payload): Promise<void> => {
  const { gift, shouldUnsave } = payload;

  const peerId = gift.type === 'user' ? global.currentUserId! : gift.chatId;

  const requestInputGift = getRequestInputSavedStarGift(global, gift);
  if (!requestInputGift) return;

  const oldGifts = global.peers.giftsById[peerId];
  if (oldGifts?.gifts?.length) {
    const newGifts = oldGifts.gifts.map((g) => {
      if (g.inputGift && areInputSavedGiftsEqual(g.inputGift, gift)) {
        return {
          ...g,
          isUnsaved: shouldUnsave,
        } satisfies ApiSavedStarGift;
      }
      return g;
    });
    global = replacePeerSavedGifts(global, peerId, newGifts, oldGifts.nextOffset);
    setGlobal(global);
  }

  const result = await callApi('saveStarGift', {
    inputGift: requestInputGift,
    shouldUnsave,
  });
  global = getGlobal();

  if (!result) {
    global = replacePeerSavedGifts(global, peerId, oldGifts.gifts, oldGifts.nextOffset);
    setGlobal(global);
    return;
  }

  // Reload gift list to avoid issues with pagination
  actions.loadPeerSavedGifts({ peerId, shouldRefresh: true });
});

addActionHandler('convertGiftToStars', async (global, actions, payload): Promise<void> => {
  const { gift, tabId = getCurrentTabId() } = payload;

  const requestInputGift = getRequestInputSavedStarGift(global, gift);
  if (!requestInputGift) return;

  const result = await callApi('convertStarGift', {
    inputSavedGift: requestInputGift,
  });

  if (!result) {
    return;
  }

  actions.loadPeerSavedGifts({ peerId: global.currentUserId!, shouldRefresh: true });
  actions.openStarsBalanceModal({ tabId });
});

addActionHandler('openGiftUpgradeModal', async (global, actions, payload): Promise<void> => {
  const {
    giftId, gift, peerId, tabId = getCurrentTabId(),
  } = payload;

  const samples = await callApi('fetchStarGiftUpgradePreview', {
    giftId,
  });

  if (!samples) return;

  global = getGlobal();

  global = updateTabState(global, {
    giftUpgradeModal: {
      recipientId: peerId,
      gift,
      sampleAttributes: samples,
    },
  }, tabId);

  setGlobal(global);
});
