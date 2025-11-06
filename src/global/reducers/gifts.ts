import type { ApiSavedStarGift } from '../../api/types';
import type { GlobalState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
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
