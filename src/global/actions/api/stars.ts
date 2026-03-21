import type {
  ApiInputSavedStarGift,
  ApiRequestInputSavedStarGift,
  ApiSavedStarGift,
  ApiStarGiftAttribute,
  ApiStarGiftUnique,
} from '../../../api/types';
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
import { preloadGiftAttributeStickers } from '../../../components/common/helpers/gifts';
import { RESALE_GIFTS_LIMIT } from '../../../limits';
import { areInputSavedGiftsEqual, getRequestInputSavedStarGift } from '../../helpers/payments';
import { addActionHandler, getGlobal, getPromiseActions, setGlobal } from '../../index';
import {
  appendStarsSubscriptions,
  appendStarsTransactions,
  replaceGiftAuction,
  replacePeerSavedGifts,
  updateChats,
  updatePeerStarGiftCollections,
  updateStarsBalance,
  updateStarsSubscriptionLoading,
  updateUsers,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectActiveGiftsCollectionId,
  selectChat,
  selectChatMessage,
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

  const [, preview] = await Promise.all([
    getPromiseActions().loadGiftAuction({ giftId: gift.id }),
    callApi('fetchStarGiftUpgradePreview', { giftId: gift.id }),
  ]);

  global = getGlobal();
  global = updateTabState(global, {
    giftAuctionModal: {
      auctionGiftId: gift.id,
      sampleAttributes: preview?.sampleAttributes,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadGiftAuction', async (global, _actions, payload): Promise<void> => {
  const { giftId } = payload;

  const currentAuction = global.giftAuctionByGiftId?.[giftId];
  const currentVersion = currentAuction?.state.type === 'active' ? currentAuction.state.version : 0;

  const auctionState = await callApi('fetchStarGiftAuctionState', {
    giftId,
    version: currentVersion,
  });
  if (!auctionState) return;

  global = getGlobal();
  global = replaceGiftAuction(global, auctionState);

  setGlobal(global);
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

addActionHandler('acceptStarGiftOffer', async (global, actions, payload): Promise<void> => {
  const { messageId } = payload;

  const result = await callApi('resolveStarGiftOffer', {
    offerMsgId: messageId,
  });

  if (!result) {
    return;
  }

  actions.loadStarStatus();
  if (global.currentUserId) {
    actions.reloadPeerSavedGifts({ peerId: global.currentUserId });
  }
});

addActionHandler('declineStarGiftOffer', async (global, actions, payload): Promise<void> => {
  const { messageId } = payload;

  await callApi('resolveStarGiftOffer', {
    offerMsgId: messageId,
    shouldDecline: true,
  });
});

addActionHandler('loadActiveGiftAuctions', async (global, actions, payload): Promise<void> => {
  const result = await callApi('fetchStarGiftActiveAuctions');

  if (!result) return;

  global = getGlobal();
  result.auctions.forEach((auction) => {
    global = replaceGiftAuction(global, auction);
  });
  global = {
    ...global,
    activeGiftAuctionIds: result.auctions.map((auction) => auction.gift.id),
  };
  setGlobal(global);
});

addActionHandler('openGiftInfoModalFromMessage', async (global, actions, payload): Promise<void> => {
  const {
    chatId, messageId, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  await getPromiseActions().loadMessage({ chatId, messageId });

  global = getGlobal();
  const message = selectChatMessage(global, chatId, messageId);

  if (!message || !message.content.action) return;

  const action = message.content.action;
  if (action.type !== 'starGift' && action.type !== 'starGiftUnique') return;

  const starGift = action.type === 'starGift' ? action : undefined;
  const uniqueGift = action.type === 'starGiftUnique' ? action : undefined;
  const giftMsgId = starGift?.giftMsgId;

  const giftReceiverId = action.peerId || (message.isOutgoing ? message.chatId : global.currentUserId!);

  const inputGift: ApiInputSavedStarGift = (() => {
    if (giftMsgId) {
      return { type: 'user', messageId: giftMsgId };
    }
    if (action.savedId) {
      return { type: 'chat', chatId, savedId: action.savedId };
    }
    return { type: 'user', messageId };
  })();

  const fromId = action.fromId || (message.isOutgoing ? global.currentUserId! : message.chatId);

  const gift: ApiSavedStarGift = {
    date: message.date,
    gift: action.gift,
    message: starGift?.message,
    starsToConvert: starGift?.starsToConvert,
    isNameHidden: starGift?.isNameHidden,
    isUnsaved: !action.isSaved,
    fromId,
    messageId: message.id,
    isConverted: starGift?.isConverted,
    upgradeMsgId: starGift?.upgradeMsgId,
    canUpgrade: starGift?.canUpgrade,
    alreadyPaidUpgradeStars: starGift?.alreadyPaidUpgradeStars,
    inputGift,
    canExportAt: uniqueGift?.canExportAt,
    savedId: action.savedId,
    transferStars: uniqueGift?.transferStars,
    dropOriginalDetailsStars: uniqueGift?.dropOriginalDetailsStars,
    prepaidUpgradeHash: starGift?.prepaidUpgradeHash,
    canCraftAt: uniqueGift?.canCraftAt,
  };

  actions.openGiftInfoModal({ peerId: giftReceiverId, gift, tabId });
});

addActionHandler('openGiftInfoValueModal', async (global, actions, payload): Promise<void> => {
  const { gift, tabId = getCurrentTabId() } = payload;

  const result = await callApi('fetchUniqueStarGiftValueInfo', { slug: gift.slug });
  if (!result) return;

  global = getGlobal();
  global = updateTabState(global, {
    giftInfoValueModal: {
      valueInfo: result,
      gift,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openGiftCraftModal', async (global, _actions, payload): Promise<void> => {
  const { gift, tabId = getCurrentTabId() } = payload;

  const uniqueGift = gift?.gift.type === 'starGiftUnique' ? gift.gift : undefined;
  const regularGiftId = uniqueGift?.regularGiftId;

  let previewAttributes: ApiStarGiftAttribute[] | undefined;

  if (regularGiftId) {
    const result = await callApi('fetchStarGiftUpgradeAttributes', { giftId: regularGiftId });
    if (result) {
      const craftableModels = result.attributes.filter(
        (attr) => attr.type === 'model' && attr.rarity.type !== 'regular',
      );
      preloadGiftAttributeStickers(craftableModels);
      previewAttributes = craftableModels;
    }
  }

  global = getGlobal();
  global = updateTabState(global, {
    giftCraftModal: {
      regularGiftId,
      regularGiftTitle: uniqueGift?.title,
      gift1: gift,
      marketFilter: { sortType: 'byPrice' },
      marketUpdateIteration: 0,
      previewAttributes,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openGiftCraftSelectModal', async (global, actions, payload): Promise<void> => {
  const { slotIndex, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);
  const craftModal = tabState.giftCraftModal;
  if (!craftModal?.regularGiftId) return;

  const shouldLoadMyGifts = !craftModal.myCraftableGifts || craftModal.shouldRefreshMyCraftableGifts;
  const shouldLoadMarketGifts = !craftModal.marketCraftableGifts;

  if (!shouldLoadMyGifts && !shouldLoadMarketGifts) {
    global = updateTabState(global, {
      giftCraftSelectModal: { slotIndex },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    giftCraftSelectModal: { slotIndex, isLoading: true },
  }, tabId);
  setGlobal(global);

  const [myGiftsResult, marketGiftsResult] = await Promise.all([
    shouldLoadMyGifts
      ? callApi('fetchCraftStarGifts', { giftId: craftModal.regularGiftId, peerId: global.currentUserId! })
      : undefined,
    shouldLoadMarketGifts
      ? callApi('fetchResaleGifts', {
        giftId: craftModal.regularGiftId,
        filter: craftModal.marketFilter,
        forCraft: true,
      })
      : undefined,
  ]);

  global = getGlobal();
  const currentCraftModal = selectTabState(global, tabId).giftCraftModal;
  const currentSelectModal = selectTabState(global, tabId).giftCraftSelectModal;
  if (!currentCraftModal || !currentSelectModal) return;

  // Filter to only unique gifts
  const savedGifts = myGiftsResult?.gifts.filter((g) => g.gift.type === 'starGiftUnique');
  const marketGifts = marketGiftsResult?.gifts.filter(
    (g): g is ApiStarGiftUnique => g.type === 'starGiftUnique',
  );

  const didLoadMyGifts = shouldLoadMyGifts && myGiftsResult;
  const didLoadMarketGifts = shouldLoadMarketGifts && marketGiftsResult;

  global = updateTabState(global, {
    giftCraftModal: {
      ...currentCraftModal,
      myCraftableGifts: didLoadMyGifts ? savedGifts : currentCraftModal.myCraftableGifts,
      myCraftableGiftsNextOffset: didLoadMyGifts
        ? myGiftsResult.nextOffset : currentCraftModal.myCraftableGiftsNextOffset,
      shouldRefreshMyCraftableGifts: shouldLoadMyGifts ? !myGiftsResult :
        currentCraftModal.shouldRefreshMyCraftableGifts,
      marketCraftableGifts: didLoadMarketGifts ? marketGifts : currentCraftModal.marketCraftableGifts,
      marketCraftableGiftsNextOffset: didLoadMarketGifts
        ? marketGiftsResult.nextOffset : currentCraftModal.marketCraftableGiftsNextOffset,
      marketCraftableGiftsCount: didLoadMarketGifts
        ? marketGiftsResult.count : currentCraftModal.marketCraftableGiftsCount,
      marketAttributes: didLoadMarketGifts ? marketGiftsResult.attributes : currentCraftModal.marketAttributes,
      marketCounters: didLoadMarketGifts ? marketGiftsResult.counters : currentCraftModal.marketCounters,
      marketAttributesHash: didLoadMarketGifts
        ? marketGiftsResult.attributesHash : currentCraftModal.marketAttributesHash,
    },
    giftCraftSelectModal: {
      ...currentSelectModal,
      isLoading: false,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadMoreCraftableGifts', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  const craftModal = tabState.giftCraftModal;
  if (!craftModal?.myCraftableGiftsNextOffset) return;

  const gift1Unique = craftModal.gift1?.gift.type === 'starGiftUnique' ? craftModal.gift1.gift : undefined;
  if (!gift1Unique?.regularGiftId) return;

  const result = await callApi('fetchCraftStarGifts', {
    giftId: gift1Unique.regularGiftId,
    peerId: global.currentUserId!,
    offset: craftModal.myCraftableGiftsNextOffset,
  });

  if (!result) return;

  global = getGlobal();
  const currentCraftModal = selectTabState(global, tabId).giftCraftModal;
  if (!currentCraftModal) return;

  // Filter to only unique gifts
  const newSavedGifts = result.gifts.filter((g) => g.gift.type === 'starGiftUnique');

  global = updateTabState(global, {
    giftCraftModal: {
      ...currentCraftModal,
      myCraftableGifts: [...(currentCraftModal.myCraftableGifts || []), ...newSavedGifts],
      myCraftableGiftsNextOffset: result.nextOffset,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadMoreMarketCraftableGifts', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  const craftModal = tabState.giftCraftModal;
  if (!craftModal?.regularGiftId) return;

  if (craftModal.isMarketLoading) return;
  if (craftModal.marketCraftableGifts && !craftModal.marketCraftableGiftsNextOffset) return;

  global = updateTabState(global, {
    giftCraftModal: {
      ...craftModal,
      isMarketLoading: true,
    },
  }, tabId);
  setGlobal(global);

  const result = await callApi('fetchResaleGifts', {
    giftId: craftModal.regularGiftId,
    offset: craftModal.marketCraftableGiftsNextOffset,
    filter: craftModal.marketFilter,
    forCraft: true,
  });

  global = getGlobal();
  const currentCraftModal = selectTabState(global, tabId).giftCraftModal;
  if (!currentCraftModal) return;

  if (!result) {
    global = updateTabState(global, {
      giftCraftModal: { ...currentCraftModal, isMarketLoading: false },
    }, tabId);
    setGlobal(global);
    return;
  }

  const newGifts = result.gifts.filter((g): g is ApiStarGiftUnique => g.type === 'starGiftUnique');

  global = updateTabState(global, {
    giftCraftModal: {
      ...currentCraftModal,
      marketCraftableGifts: [...(currentCraftModal.marketCraftableGifts || []), ...newGifts],
      marketCraftableGiftsNextOffset: result.nextOffset,
      isMarketLoading: false,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('updateCraftGiftsFilter', async (global, actions, payload): Promise<void> => {
  const { filter, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);
  const modal = tabState.giftCraftModal;
  if (!modal?.regularGiftId) return;

  global = updateTabState(global, {
    giftCraftModal: {
      ...modal,
      marketFilter: filter,
      isMarketLoading: true,
    },
  }, tabId);
  setGlobal(global);

  const result = await callApi('fetchResaleGifts', {
    giftId: modal.regularGiftId,
    filter,
    forCraft: true,
  });

  global = getGlobal();
  const currentModal = selectTabState(global, tabId).giftCraftModal;
  if (!currentModal) return;

  if (!result) {
    global = updateTabState(global, {
      giftCraftModal: { ...currentModal, isMarketLoading: false },
    }, tabId);
    setGlobal(global);
    return;
  }

  const newGifts = result.gifts.filter((g): g is ApiStarGiftUnique => g.type === 'starGiftUnique');

  global = updateTabState(global, {
    giftCraftModal: {
      ...currentModal,
      marketCraftableGifts: newGifts,
      marketCraftableGiftsNextOffset: result.nextOffset,
      marketCraftableGiftsCount: result.count,
      marketCounters: result.counters,
      marketUpdateIteration: currentModal.marketUpdateIteration + 1,
      isMarketLoading: false,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('craftStarGift', async (global, _actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  const modal = tabState.giftCraftModal;

  if (!modal?.regularGiftId) return;

  const savedGifts = [modal.gift1, modal.gift2, modal.gift3, modal.gift4].filter(
    (g): g is ApiSavedStarGift => Boolean(g),
  );
  if (savedGifts.length === 0) return;

  const inputSavedGifts = savedGifts
    .map((g) => g.inputGift && getRequestInputSavedStarGift(global, g.inputGift))
    .filter((g): g is ApiRequestInputSavedStarGift => Boolean(g));

  if (inputSavedGifts.length === 0) return;

  const result = await callApi('craftStarGift', { inputSavedGifts });

  if (result?.error) {
    global = getGlobal();
    const currentModal = selectTabState(global, tabId).giftCraftModal;
    if (!currentModal) return;

    global = updateTabState(global, {
      giftCraftModal: {
        ...currentModal,
        craftResult: { success: false, isError: true },
      },
    }, tabId);
    setGlobal(global);
  }
});

addActionHandler('openAboutStarGiftModal', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};

  const result = await callApi('fetchPremiumPromo');

  let videoId: string | undefined;
  let videoThumbnail;

  if (result?.promo) {
    const giftsIndex = result.promo.videoSections.indexOf('gifts');
    if (giftsIndex !== -1 && giftsIndex < result.promo.videos.length) {
      const video = result.promo.videos[giftsIndex];
      videoId = video.id;
      videoThumbnail = video.thumbnail;
    }
  }

  global = getGlobal();
  global = updateTabState(global, {
    aboutStarGiftModal: { videoId, videoThumbnail },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openGiftPreviewModal', async (global, _actions, payload): Promise<void> => {
  const { originGift, shouldShowCraftableOnStart, tabId = getCurrentTabId() } = payload;

  const giftId = originGift.type === 'starGiftUnique' ? originGift.regularGiftId : originGift.id;
  const result = await callApi('fetchStarGiftUpgradeAttributes', { giftId });
  if (!result) return;

  global = getGlobal();
  global = updateTabState(global, {
    giftPreviewModal: {
      originGift,
      attributes: result.attributes,
      shouldShowCraftableOnStart,
    },
  }, tabId);
  setGlobal(global);
});
