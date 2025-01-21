import type { StarGiftCategory } from '../../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  appendStarsSubscriptions,
  appendStarsTransactions,
  updateStarsBalance,
  updateStarsSubscriptionLoading,
} from '../../reducers';
import {
  selectPeer,
  selectUser,
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

  const starGiftsById = buildCollectionByKey(result, 'id');

  const starGiftCategoriesByName: Record<StarGiftCategory, string[]> = {
    all: [],
    stock: [],
    limited: [],
  };

  const allStarGiftIds = Object.keys(starGiftsById);
  const allStarGifts = Object.values(starGiftsById);

  const limitedStarGiftIds = allStarGifts.map((gift) => (gift.isLimited ? gift.id : undefined))
    .filter(Boolean) as string[];

  const stockedStarGiftIds = allStarGifts.map((gift) => (
    gift.availabilityRemains || !gift.availabilityTotal ? gift.id : undefined
  )).filter(Boolean) as string[];

  starGiftCategoriesByName.all = allStarGiftIds;
  starGiftCategoriesByName.limited = limitedStarGiftIds;
  starGiftCategoriesByName.stock = stockedStarGiftIds;

  allStarGifts.forEach((gift) => {
    const starsCategory = gift.stars;
    if (!starGiftCategoriesByName[starsCategory]) {
      starGiftCategoriesByName[starsCategory] = [];
    }
    starGiftCategoriesByName[starsCategory].push(gift.id);
  });

  global = getGlobal();
  global = {
    ...global,
    starGiftsById,
    starGiftCategoriesByName,
  };
  setGlobal(global);
});

addActionHandler('loadUserGifts', async (global, actions, payload): Promise<void> => {
  const { userId, shouldRefresh } = payload;

  const user = selectUser(global, userId);
  if (!user) return;

  const currentGifts = global.users.giftsById[userId];
  const localNextOffset = currentGifts?.nextOffset;

  if (!shouldRefresh && currentGifts && !localNextOffset) return; // Already loaded all

  const result = await callApi('fetchUserStarGifts', {
    user,
    offset: !shouldRefresh ? localNextOffset : '',
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  const newGifts = currentGifts && !shouldRefresh ? currentGifts.gifts.concat(result.gifts) : result.gifts;

  global = {
    ...global,
    users: {
      ...global.users,
      giftsById: {
        ...global.users.giftsById,
        [userId]: {
          gifts: newGifts,
          nextOffset: result.nextOffset,
        },
      },
    },
  };
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
  const { userId, messageId, shouldUnsave } = payload;

  const user = selectUser(global, userId);
  if (!user) return;

  const result = await callApi('saveStarGift', {
    user,
    messageId,
    shouldUnsave,
  });

  if (!result) {
    return;
  }

  actions.loadUserGifts({ userId: global.currentUserId!, shouldRefresh: true });
});

addActionHandler('convertGiftToStars', async (global, actions, payload): Promise<void> => {
  const { userId, messageId, tabId = getCurrentTabId() } = payload;

  const user = selectUser(global, userId);
  if (!user) return;

  const result = await callApi('convertStarGift', {
    user,
    messageId,
  });

  if (!result) {
    return;
  }

  actions.loadUserGifts({ userId: global.currentUserId!, shouldRefresh: true });
  actions.openStarsBalanceModal({ tabId });
});
