import type { ApiSavedStarGift, ApiStarGiftUnique } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import {
  DEFAULT_RESALE_GIFTS_FILTER_OPTIONS,
  STARS_CURRENCY_CODE,
  TON_CURRENCY_CODE,
} from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByCallback, buildCollectionByKey } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { RESALE_GIFTS_LIMIT } from '../../../limits';
import { areInputSavedGiftsEqual, getRequestInputSavedStarGift } from '../../helpers/payments';
import { addActionHandler, getGlobal, getPromiseActions, setGlobal } from '../../index';
import {
  appendStarsSubscriptions,
  appendStarsTransactions,
  replacePeerSavedGifts,
  updateActiveGiftAuction,
  updateChats,
  updatePeerStarGiftCollections,
  updateStarsBalance,
  updateStarsSubscriptionLoading,
  updateUsers,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectActiveGiftsCollectionId,
  selectGiftProfileFilter,
  selectPeer,
  selectPeerCollectionSavedGifts,
  selectPeerSavedGifts,
  selectTabState,
} from '../../selectors';

addActionHandler('loadStarStatus', async (global): Promise<void> => {
  const currentStarsStatus = global.stars;
  const needsTopupOptions = !currentStarsStatus?.topupOptions;

  const [starsStatus, tonStatus, topupOptions] = await Promise.all([
    callApi('fetchStarsStatus'),
    callApi('fetchStarsStatus', { isTon: true }),
    needsTopupOptions ? callApi('fetchStarsTopupOptions') : undefined,
  ]);

  if (!(starsStatus || tonStatus) || (needsTopupOptions && !topupOptions)) {
    return;
  }

  global = getGlobal();

  if (starsStatus && starsStatus.balance.currency === STARS_CURRENCY_CODE) {
    global = {
      ...global,
      stars: {
        ...currentStarsStatus,
        balance: starsStatus.balance,
        topupOptions: topupOptions || currentStarsStatus!.topupOptions,
        history: {
          all: undefined,
          inbound: undefined,
          outbound: undefined,
        },
        subscriptions: undefined,
      },
    };

    if (starsStatus.history) {
      global = appendStarsTransactions(global, 'all', starsStatus.history, starsStatus.nextHistoryOffset);
    }

    if (starsStatus.subscriptions) {
      global = appendStarsSubscriptions(global, starsStatus.subscriptions, starsStatus.nextSubscriptionOffset);
    }
  }

  if (tonStatus?.balance.currency === TON_CURRENCY_CODE) {
    global = {
      ...global,
      ton: {
        ...tonStatus,
        balance: tonStatus.balance,
        history: {
          all: undefined,
          inbound: undefined,
          outbound: undefined,
        },
      },
    };

    global = updateStarsBalance(global, tonStatus.balance);

    if (tonStatus.history) {
      global = appendStarsTransactions(global, 'all', tonStatus.history, tonStatus.nextHistoryOffset, true);
    }
  }

  setGlobal(global);
});

addActionHandler('loadStarsTransactions', async (global, actions, payload): Promise<void> => {
  const { type, isTon } = payload;

  const history = isTon ? global.ton?.history[type] : global.stars?.history[type];
  const offset = history?.nextOffset;
  if (history && !offset) return; // Already loaded all

  const result = await callApi('fetchStarsTransactions', {
    isInbound: type === 'inbound',
    isOutbound: type === 'outbound',
    offset: offset || '',
    isTon,
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  global = updateStarsBalance(global, result.balance);
  if (result.history) {
    global = appendStarsTransactions(global, type, result.history, result.nextOffset, isTon);
  }
  setGlobal(global);
});

addActionHandler('loadStarGifts', async (global): Promise<void> => {
  const result = await callApi('fetchStarGifts');

  if (!result) {
    return;
  }

  global = getGlobal();

  const byId = buildCollectionByKey(result.gifts, 'id');

  const allStarGiftIds = Object.keys(byId);
  const allStarGifts = Object.values(byId);

  const collectibleStarGiftIds = allStarGifts.map((gift) => (
    (gift.availabilityResale || (gift.isLimited && !gift.isSoldOut)) ? gift.id : undefined))
    .filter(Boolean);

  global = {
    ...global,
    starGifts: {
      byId,
      idsByCategory: {
        all: allStarGiftIds,
        collectible: collectibleStarGiftIds,
        myUnique: [],
      },
    },
  };
  setGlobal(global);
});

addActionHandler('loadMyUniqueGifts', async (global, actions, payload): Promise<void> => {
  const { shouldRefresh } = payload || {};
  const currentUserId = global.currentUserId;
  if (!currentUserId) return;

  const currentMyUniqueGifts = global.myUniqueGifts;
  const localNextOffset = currentMyUniqueGifts?.nextOffset;

  if (currentMyUniqueGifts && !localNextOffset && !shouldRefresh) return;

  const peer = selectPeer(global, currentUserId);
  if (!peer) return;

  const result = await callApi('fetchSavedStarGifts', {
    peer,
    offset: !shouldRefresh ? localNextOffset : undefined,
    filter: {
      sortType: 'byDate',
      shouldIncludeUnique: true,
      shouldIncludeUnlimited: false,
      shouldIncludeUpgradable: false,
      shouldIncludeLimited: false,
      shouldIncludeDisplayed: true,
      shouldIncludeHidden: true,
    },
  });

  if (!result) return;

  global = getGlobal();

  const gifts = result.gifts;

  const byId = buildCollectionByCallback(gifts, (savedGift) => (
    [savedGift.gift.id, savedGift]
  ));

  const ids = gifts.map((gift) => gift.gift.id);

  global = {
    ...global,
    myUniqueGifts: {
      byId: {
        ...!shouldRefresh && (global.myUniqueGifts?.byId || {}),
        ...byId,
      },
      ids: [
        ...!shouldRefresh ? (global.myUniqueGifts?.ids || []) : [],
        ...ids,
      ],
      nextOffset: result.nextOffset,
    },
  };

  setGlobal(global);
});

addActionHandler('updateResaleGiftsFilter', (global, actions, payload): ActionReturnType => {
  const {
    filter, tabId = getCurrentTabId(),
  } = payload;

  const tabState = selectTabState(global, tabId);
  global = updateTabState(global, {
    resaleGifts: {
      ...tabState.resaleGifts,
      filter,
    },
  }, tabId);
  if (tabState.resaleGifts.giftId) {
    actions.loadResaleGifts({ giftId: tabState.resaleGifts.giftId, shouldRefresh: true, tabId });
  }

  setGlobal(global);
});

addActionHandler('loadResaleGifts', async (global, actions, payload): Promise<void> => {
  const {
    giftId, shouldRefresh, tabId = getCurrentTabId(),
  } = payload;

  let tabState = selectTabState(global, tabId);
  if (tabState.resaleGifts.isLoading || (tabState.resaleGifts.isAllLoaded && !shouldRefresh)) return;

  global = updateTabState(global, {
    resaleGifts: {
      ...tabState.resaleGifts,
      isLoading: true,
      ...(shouldRefresh && {
        count: 0,
        nextOffset: undefined,
        isAllLoaded: false,
      }),
    },
  }, tabId);
  setGlobal(global);

  global = getGlobal();
  tabState = selectTabState(global, tabId);
  const nextOffset = tabState.resaleGifts.nextOffset;
  const attributesHash = tabState.resaleGifts.attributesHash;
  const filter = tabState.resaleGifts.filter;

  const result = await callApi('fetchResaleGifts', {
    giftId,
    offset: nextOffset,
    limit: RESALE_GIFTS_LIMIT,
    attributesHash,
    filter,
  });

  if (!result) {
    return;
  };

  const {
    chats,
    users,
  } = result;

  global = getGlobal();
  tabState = selectTabState(global, tabId);

  const currentGifts = tabState.resaleGifts.gifts;
  const newGifts = !shouldRefresh ? currentGifts.concat(result.gifts) : result.gifts;
  const currentUpdateIteration = tabState.resaleGifts.updateIteration;
  const shouldUpdateIteration = tabState.resaleGifts.giftId !== giftId || shouldRefresh;
  const updateIteration = shouldUpdateIteration ? currentUpdateIteration + 1 : currentUpdateIteration;
  global = updateTabState(global, {
    resaleGifts: {
      ...tabState.resaleGifts,
      giftId,
      count: result.count || tabState.resaleGifts.count,
      gifts: newGifts,
      attributes: result.attributes || tabState.resaleGifts.attributes,
      counters: result.counters || tabState.resaleGifts.counters,
      attributesHash: result.attributesHash,
      nextOffset: result.nextOffset,
      isLoading: false,
      isAllLoaded: !result.nextOffset,
      updateIteration,
    },
  }, tabId);

  global = updateUsers(global, buildCollectionByKey(users, 'id'));
  global = updateChats(global, buildCollectionByKey(chats, 'id'));

  setGlobal(global);
});

addActionHandler('resetResaleGifts', (global, actions, payload): ActionReturnType => {
  const {
    tabId = getCurrentTabId(),
  } = payload || {};

  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    resaleGifts: {
      updateIteration: tabState.resaleGifts.updateIteration + 1,
      filter: DEFAULT_RESALE_GIFTS_FILTER_OPTIONS,
      count: 0,
      gifts: [],
    },
  }, tabId);
});

addActionHandler('loadPeerSavedGifts', async (global, actions, payload): Promise<void> => {
  const {
    peerId, shouldRefresh, tabId = getCurrentTabId(),
  } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) return;

  global = getGlobal();

  const fetchingCollectionId = selectActiveGiftsCollectionId(global, peerId, tabId);
  const currentGifts = selectPeerCollectionSavedGifts(global, peerId, fetchingCollectionId, tabId);
  const localNextOffset = currentGifts?.nextOffset;

  if (!shouldRefresh && currentGifts && !localNextOffset) return; // Already loaded all

  const fetchingFilter = selectGiftProfileFilter(global, peerId, tabId);

  const result = await callApi('fetchSavedStarGifts', {
    peer,
    offset: !shouldRefresh ? localNextOffset : '',
    filter: fetchingFilter,
    collectionId: fetchingCollectionId === 'all' ? undefined : fetchingCollectionId,
  });

  global = getGlobal();
  const currentFilter = selectGiftProfileFilter(global, peerId, tabId);
  const currentCollectionId = selectActiveGiftsCollectionId(global, peerId, tabId);

  if (!result || currentCollectionId !== fetchingCollectionId || currentFilter !== fetchingFilter) {
    return;
  }

  const newGifts = currentGifts && !shouldRefresh ? currentGifts.gifts.concat(result.gifts) : result.gifts;

  global = replacePeerSavedGifts(global, peerId, newGifts, result.nextOffset, tabId);
  setGlobal(global);
});

addActionHandler('reloadPeerSavedGifts', (global, actions, payload): ActionReturnType => {
  const {
    peerId,
  } = payload;

  Object.values(global.byTabId).forEach((tabState) => {
    const activeCollectionId = selectActiveGiftsCollectionId(global, peerId, tabState.id);
    if (selectPeerCollectionSavedGifts(global, peerId, activeCollectionId, tabState.id)) {
      actions.loadPeerSavedGifts({ peerId, shouldRefresh: true, tabId: tabState.id });
    }
  });
  if (peerId === global.currentUserId) {
    actions.loadMyUniqueGifts({ shouldRefresh: true });
  }
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

  if (!result || result.balance.currency !== STARS_CURRENCY_CODE) {
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
  const { gift, shouldUnsave, tabId = getCurrentTabId() } = payload;

  const peerId = gift.type === 'user' ? global.currentUserId! : gift.chatId;

  const requestInputGift = getRequestInputSavedStarGift(global, gift);
  if (!requestInputGift) return;

  const activeCollectionId = selectActiveGiftsCollectionId(global, peerId, tabId);
  const oldGifts = selectTabState(global, tabId).savedGifts.collectionsByPeerId[peerId]?.[activeCollectionId];
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
    global = replacePeerSavedGifts(global, peerId, newGifts, oldGifts.nextOffset, tabId);
    setGlobal(global);
  }

  const result = await callApi('saveStarGift', {
    inputGift: requestInputGift,
    shouldUnsave,
  });
  global = getGlobal();

  if (!result) {
    global = replacePeerSavedGifts(global, peerId, oldGifts.gifts, oldGifts.nextOffset, tabId);
    setGlobal(global);
    return;
  }

  actions.reloadPeerSavedGifts({ peerId });
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

  const peerId = gift.type === 'user' ? global.currentUserId! : gift.chatId;
  actions.reloadPeerSavedGifts({ peerId });
  actions.openStarsBalanceModal({ tabId });
});

addActionHandler('openGiftUpgradeModal', async (global, actions, payload): Promise<void> => {
  const {
    giftId, gift, peerId, tabId = getCurrentTabId(),
  } = payload;

  const preview = await callApi('fetchStarGiftUpgradePreview', {
    giftId,
  });

  if (!preview) return;

  const serverTime = getServerTime();
  const filteredPrices = preview.prices.filter((price) => price.date > serverTime);
  const filteredNextPrices = preview.nextPrices.filter((price) => price.date > serverTime);

  const passedPrices = preview.nextPrices.filter((price) => price.date <= serverTime);
  const regularGift = gift?.gift.type === 'starGift' ? gift.gift : undefined;
  const currentUpgradeStars = passedPrices.length
    ? passedPrices[passedPrices.length - 1].upgradeStars
    : regularGift?.upgradeStars;

  const maxPrice = preview.prices[0]?.upgradeStars;
  const minPrice = preview.prices.at(-1)?.upgradeStars;

  global = getGlobal();

  global = updateTabState(global, {
    giftUpgradeModal: {
      recipientId: peerId,
      gift,
      sampleAttributes: preview.sampleAttributes,
      prices: filteredPrices,
      nextPrices: filteredNextPrices,
      currentUpgradeStars,
      minPrice,
      maxPrice,
    },
  }, tabId);

  setGlobal(global);
});

addActionHandler('shiftGiftUpgradeNextPrice', async (global, _actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  const giftUpgradeModal = tabState?.giftUpgradeModal;
  if (!giftUpgradeModal?.nextPrices?.length) return;

  const currentUpgradeStars = giftUpgradeModal.nextPrices[0].upgradeStars;
  const newNextPrices = giftUpgradeModal.nextPrices.slice(1);

  if (newNextPrices.length) {
    global = updateTabState(global, {
      giftUpgradeModal: {
        ...giftUpgradeModal,
        nextPrices: newNextPrices,
        currentUpgradeStars,
      },
    }, tabId);
    setGlobal(global);

    return;
  }

  const gift = giftUpgradeModal.gift?.gift;
  const giftId = gift?.type === 'starGift' ? gift.id : undefined;
  if (!giftId) return;

  const preview = await callApi('fetchStarGiftUpgradePreview', { giftId });
  if (!preview) return;

  const serverTime = getServerTime();
  const filteredNextPrices = preview.nextPrices.filter((price) => price.date > serverTime);

  global = getGlobal();
  const currentTabState = selectTabState(global, tabId);
  const currentModal = currentTabState?.giftUpgradeModal;
  if (!currentModal) return;

  global = updateTabState(global, {
    giftUpgradeModal: {
      ...currentModal,
      nextPrices: filteredNextPrices,
      currentUpgradeStars,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openGiftAuctionModal', async (global, _actions, payload): Promise<void> => {
  const { gift, tabId = getCurrentTabId() } = payload;

  await getPromiseActions().loadActiveGiftAuction({ giftId: gift.id, tabId });

  global = getGlobal();
  global = updateTabState(global, {
    giftAuctionModal: { isOpen: true },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadActiveGiftAuction', async (global, _actions, payload): Promise<void> => {
  const { giftId, tabId = getCurrentTabId() } = payload;

  const currentAuction = selectTabState(global, tabId).activeGiftAuction;
  const currentVersion = currentAuction?.state.type === 'active' ? currentAuction.state.version : 0;

  const auctionState = await callApi('fetchStarGiftAuctionState', {
    giftId,
    version: currentVersion,
  });
  if (!auctionState) return;

  global = getGlobal();
  global = updateActiveGiftAuction(global, auctionState, tabId);
  setGlobal(global);
});

addActionHandler('clearActiveGiftAuction', (global, _actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    activeGiftAuction: undefined,
  }, tabId);
});

addActionHandler('toggleSavedGiftPinned', async (global, actions, payload): Promise<void> => {
  const { gift, peerId, tabId = getCurrentTabId() } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const savedGifts = selectPeerSavedGifts(global, peerId, tabId);
  if (!savedGifts) return;
  const pinLimit = global.appConfig.savedGiftPinLimit;
  const currentPinnedGifts = savedGifts.gifts.filter((g) => g.isPinned);
  const newPinnedGifts = gift.isPinned
    ? currentPinnedGifts.filter((g) => (g.gift as ApiStarGiftUnique).slug !== (gift.gift as ApiStarGiftUnique).slug)
    : [...currentPinnedGifts, gift];

  const trimmedPinnedGifts = pinLimit ? newPinnedGifts.slice(-pinLimit) : newPinnedGifts;

  const inputSavedGifts = trimmedPinnedGifts.map((g) => getRequestInputSavedStarGift(global, g.inputGift!))
    .filter(Boolean);

  const result = await callApi('toggleSavedGiftPinned', {
    inputSavedGifts,
    peer,
  });

  if (!result) return;

  actions.reloadPeerSavedGifts({ peerId });
});

addActionHandler('updateStarGiftPrice', async (global, actions, payload): Promise<void> => {
  const {
    gift, price,
  } = payload;

  const requestSavedGift = getRequestInputSavedStarGift(global, gift);

  if (!requestSavedGift) {
    return;
  }

  const result = await callApi('updateStarGiftPrice', {
    inputSavedGift: requestSavedGift,
    price,
  });

  if (!result) return;

  actions.reloadPeerSavedGifts({ peerId: global.currentUserId! });
});

addActionHandler('loadStarGiftCollections', async (global, actions, payload): Promise<void> => {
  const {
    peerId,
    hash,
  } = payload;

  const peer = selectPeer(global, peerId);
  if (!peer) return;

  const result = await callApi('fetchStarGiftCollections', {
    peer,
    hash,
  });

  if (!result) return;

  global = getGlobal();

  global = updatePeerStarGiftCollections(global, peerId, result.collections);
  setGlobal(global);
});

addActionHandler('openGiftAuctionAcquiredModal', async (global, actions, payload): Promise<void> => {
  const {
    giftId, giftTitle, giftSticker, tabId = getCurrentTabId(),
  } = payload;

  const result = await callApi('fetchStarGiftAuctionAcquiredGifts', { giftId });

  if (!result) return;

  global = getGlobal();

  global = updateTabState(global, {
    giftAuctionAcquiredModal: {
      giftId,
      giftTitle,
      giftSticker,
      acquiredGifts: result.gifts,
    },
  }, tabId);

  setGlobal(global);
});
