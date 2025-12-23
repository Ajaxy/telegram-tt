import type {
  ApiSavedStarGift,
  ApiStarGiftAuctionState,
  ApiStarGiftAuctionUserState,
  ApiTypeStarGiftAuctionState,
} from '../../api/types';
import type { GlobalState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function removeGiftInfoOriginalDetails<T extends GlobalState>(
  global: T,
  tabId: number = getCurrentTabId(),
): T {
  const tabState = global.byTabId[tabId];
  const { giftInfoModal } = tabState;
  if (!giftInfoModal) {
    return global;
  }

  const typeGift = giftInfoModal.gift;
  const isSavedGift = typeGift && 'gift' in typeGift;

  if (!isSavedGift) {
    return global;
  }

  const savedGift = typeGift;
  const innerGift = savedGift.gift;

  if (innerGift.type !== 'starGiftUnique') {
    return global;
  }

  const updatedInnerGift = {
    ...innerGift,
    attributes: innerGift.attributes?.filter((attr) => attr.type !== 'originalDetails'),
  };

  const updatedGift: ApiSavedStarGift = {
    ...savedGift,
    dropOriginalDetailsStars: undefined,
    gift: updatedInnerGift,
  };

  return updateTabState(global, {
    giftInfoModal: {
      ...giftInfoModal,
      gift: updatedGift,
    },
  }, tabId);
}

function getAuctionStateVersion(state: ApiTypeStarGiftAuctionState): number {
  return state.type === 'active' ? state.version : 0;
}

export function updateActiveGiftAuction<T extends GlobalState>(
  global: T,
  auctionState: ApiStarGiftAuctionState,
  tabId: number = getCurrentTabId(),
): T {
  const currentAuction = selectTabState(global, tabId).activeGiftAuction;

  const serverVersion = getAuctionStateVersion(auctionState.state);
  const clientVersion = currentAuction ? getAuctionStateVersion(currentAuction.state) : -1;

  if (serverVersion >= clientVersion) {
    return updateTabState(global, {
      activeGiftAuction: auctionState,
    }, tabId);
  }

  return global;
}

export function updateActiveGiftAuctionState<T extends GlobalState>(
  global: T,
  giftId: string,
  state: ApiTypeStarGiftAuctionState,
  tabId: number,
): T {
  const activeAuction = selectTabState(global, tabId).activeGiftAuction;

  if (!activeAuction || activeAuction.gift.id !== giftId) {
    return global;
  }

  const serverVersion = getAuctionStateVersion(state);
  const clientVersion = getAuctionStateVersion(activeAuction.state);

  if (serverVersion > clientVersion) {
    return updateTabState(global, {
      activeGiftAuction: {
        ...activeAuction,
        state,
      },
    }, tabId);
  }

  return global;
}

export function updateActiveGiftAuctionUserState<T extends GlobalState>(
  global: T,
  giftId: string,
  userState: ApiStarGiftAuctionUserState,
  tabId: number,
): T {
  const activeAuction = selectTabState(global, tabId).activeGiftAuction;

  if (!activeAuction || activeAuction.gift.id !== giftId) {
    return global;
  }

  return updateTabState(global, {
    activeGiftAuction: {
      ...activeAuction,
      userState,
    },
  }, tabId);
}
