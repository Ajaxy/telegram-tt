import type {
  ApiSavedStarGift,
  ApiStarGiftAuctionState,
  ApiStarGiftAuctionUserState,
  ApiTypeStarGiftAuctionState,
} from '../../api/types';
import type { GlobalState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { omit } from '../../util/iteratees';
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

export function updateGiftAuction<T extends GlobalState>(
  global: T,
  auctionState: ApiStarGiftAuctionState,
): T {
  const giftId = auctionState.gift.id;
  const currentAuction = global.giftAuctionByGiftId?.[giftId];

  if (!currentAuction) return global;

  const serverVersion = getAuctionStateVersion(auctionState.state);
  const clientVersion = getAuctionStateVersion(currentAuction.state);

  if (serverVersion >= clientVersion) {
    return {
      ...global,
      giftAuctionByGiftId: {
        ...global.giftAuctionByGiftId,
        [giftId]: auctionState,
      },
    };
  }

  return global;
}

export function updateGiftAuctionState<T extends GlobalState>(
  global: T,
  giftId: string,
  state: ApiTypeStarGiftAuctionState,
): T {
  const giftAuction = global.giftAuctionByGiftId?.[giftId];

  if (!giftAuction) {
    return global;
  }

  const serverVersion = getAuctionStateVersion(state);
  const clientVersion = getAuctionStateVersion(giftAuction.state);

  if (serverVersion > clientVersion) {
    return {
      ...global,
      giftAuctionByGiftId: {
        ...global.giftAuctionByGiftId,
        [giftId]: {
          ...giftAuction,
          state,
        },
      },
    };
  }

  return global;
}

export function updateGiftAuctionUserState<T extends GlobalState>(
  global: T,
  giftId: string,
  userState: ApiStarGiftAuctionUserState,
): T {
  const giftAuction = global.giftAuctionByGiftId?.[giftId];

  if (!giftAuction) {
    return global;
  }

  return {
    ...global,
    giftAuctionByGiftId: {
      ...global.giftAuctionByGiftId,
      [giftId]: {
        ...giftAuction,
        userState,
      },
    },
  };
}

export function replaceGiftAuction<T extends GlobalState>(
  global: T,
  auctionState: ApiStarGiftAuctionState,
): T {
  const giftId = auctionState.gift.id;
  return {
    ...global,
    giftAuctionByGiftId: {
      ...global.giftAuctionByGiftId,
      [giftId]: auctionState,
    },
  };
}

export function removeGiftAuction<T extends GlobalState>(
  global: T,
  giftId: string,
): T {
  if (!global.giftAuctionByGiftId?.[giftId]) {
    return global;
  }

  const rest = omit(global.giftAuctionByGiftId, [giftId]);

  return {
    ...global,
    giftAuctionByGiftId: Object.keys(rest).length ? rest : undefined,
  };
}
