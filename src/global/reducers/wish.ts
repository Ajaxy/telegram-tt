import type { Wish } from '../../types/wish';
import type { GlobalState } from '../types';

export function updateWish<T extends GlobalState>(global: T, wish: Wish): T {
  return {
    ...global,
    wishes: {
      ...global.wishes,
      byOwnerId: {
        ...global.wishes?.byOwnerId,
        [wish.ownerId]: wish,
      },
    },
  };
}

export function updateWishDemoBalance<T extends GlobalState>(global: T, demoBalanceGram: number): T {
  return {
    ...global,
    wishes: {
      byOwnerId: global.wishes?.byOwnerId ?? {},
      demoBalanceGram,
    },
  };
}
