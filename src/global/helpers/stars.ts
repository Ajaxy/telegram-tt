import type { ApiSavedStarGift } from '../../api/types';

export function getSavedGiftKey(gift: ApiSavedStarGift, withoutTag?: boolean) {
  return [
    gift.date,
    gift.fromId,
    gift.gift.id,
    gift.gift.type === 'starGiftUnique' ? gift.gift.number : undefined,
    !withoutTag ? gift.localTag : undefined,
  ].filter(Boolean).join('-');
}
