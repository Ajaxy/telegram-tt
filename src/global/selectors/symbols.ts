import type { ApiSticker, ApiStickerSet, ApiStickerSetInfo } from '../../api/types';
import type { GlobalState, TabArgs } from '../types';

import { RESTRICTED_EMOJI_SET_ID, TON_CURRENCY_CODE } from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { convertCurrencyFromBaseUnit } from '../../util/formatCurrency';
import { selectTabState } from './tabs';
import { selectIsCurrentUserPremium } from './users';

// Duration in days
const MONTH = 30;
const QUARTER_YEAR = MONTH * 3;
const HALF_YEAR = MONTH * 6;
const YEAR = MONTH * 12;
const TWO_YEARS = MONTH * 24;

const DURATION_DELTA = 5;

// https://github.com/DrKLO/Telegram/blob/c319639e9a4dff2f22da6762dcebd12d49f5afa1/TMessagesProj/src/main/java/org/telegram/ui/Components/Premium/boosts/cells/msg/GiveawayMessageCell.java#L59
const DURATION_EMOTICON: Record<number, string> = {
  [MONTH]: `${1}\u{FE0F}\u20E3`, // 1 month
  [QUARTER_YEAR]: `${2}\u{FE0F}\u20E3`, // 3 months
  [HALF_YEAR]: `${3}\u{FE0F}\u20E3`, // 6 months
  [YEAR]: `${4}\u{FE0F}\u20E3`, // 12 months
  [TWO_YEARS]: `${5}\u{FE0F}\u20E3`, // 24 months
};

const STAR_EMOTICON: Record<number, string> = {
  1000: `${2}\u{FE0F}\u20E3`,
  2500: `${3}\u{FE0F}\u20E3`,
  5000: `${4}\u{FE0F}\u20E3`,
};

const TON_EMOTICON: Record<number, string> = {
  1: `${1}\u{FE0F}\u20E3`,
  10: `${2}\u{FE0F}\u20E3`,
  50: `${3}\u{FE0F}\u20E3`,
};

export function selectIsStickerFavorite<T extends GlobalState>(global: T, sticker: ApiSticker) {
  const { stickers } = global.stickers.favorite;
  return stickers && stickers.some(({ id }) => id === sticker.id);
}

export function selectCurrentStickerSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).stickerSearch;
}

export function selectCurrentGifSearch<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).gifSearch;
}

export function selectStickerSet<T extends GlobalState>(global: T, id: string | ApiStickerSetInfo) {
  if (typeof id === 'string') {
    return global.stickers.setsById[id];
  }

  if ('id' in id) {
    return global.stickers.setsById[id.id];
  }

  if ('isMissing' in id) return undefined;

  return Object.values(global.stickers.setsById).find(({ shortName }) => (
    shortName.toLowerCase() === id.shortName.toLowerCase()
  ));
}

export function selectStickersForEmoji<T extends GlobalState>(global: T, emoji: string) {
  const addedSets = global.stickers.added.setIds;
  let stickersForEmoji: ApiSticker[] = [];
  // Favorites
  global.stickers.favorite.stickers.forEach((sticker) => {
    if (sticker.emoji === emoji) stickersForEmoji.push(sticker);
  });

  // Added sets
  addedSets?.forEach((id) => {
    const packs = global.stickers.setsById[id].packs;
    if (!packs) {
      return;
    }

    stickersForEmoji = stickersForEmoji.concat(packs[emoji] || [], packs[cleanEmoji(emoji)] || []);
  });
  return stickersForEmoji;
}

export function selectCustomEmojiForEmoji<T extends GlobalState>(global: T, emoji: string) {
  const isCurrentUserPremium = selectIsCurrentUserPremium(global);
  const addedCustomSets = global.customEmojis.added.setIds;
  let customEmojiForEmoji: ApiSticker[] = [];

  // Added sets
  addedCustomSets?.forEach((id) => {
    const packs = global.stickers.setsById[id].packs;
    if (!packs) {
      return;
    }

    customEmojiForEmoji = customEmojiForEmoji.concat(packs[emoji] || [], packs[cleanEmoji(emoji)] || []);
  });
  return isCurrentUserPremium ? customEmojiForEmoji : customEmojiForEmoji.filter(({ isFree }) => isFree);
}

// Slow, not to be used in `withGlobal`
export function selectCustomEmojiForEmojis<T extends GlobalState>(global: T, emojis: string[]) {
  const isCurrentUserPremium = selectIsCurrentUserPremium(global);
  const addedCustomSets = global.customEmojis.added.setIds;
  let customEmojiForEmoji: ApiSticker[] = [];

  // Added sets
  addedCustomSets?.forEach((id) => {
    const packs = global.stickers.setsById[id].packs;
    if (!packs) {
      return;
    }
    const customEmojis = Object.entries(packs).filter(([emoji]) => (
      emojis.includes(emoji) || emojis.includes(cleanEmoji(emoji))
    )).flatMap(([, stickers]) => stickers);
    customEmojiForEmoji = customEmojiForEmoji.concat(customEmojis);
  });
  return isCurrentUserPremium ? customEmojiForEmoji : customEmojiForEmoji.filter(({ isFree }) => isFree);
}

export function selectIsSetPremium(stickerSet: Pick<ApiStickerSet, 'stickers' | 'isEmoji'>) {
  return stickerSet.isEmoji && stickerSet.stickers?.some((sticker) => !sticker.isFree);
}

function cleanEmoji(emoji: string) {
  // Some emojis (❤️ for example) with a service symbol 'VARIATION SELECTOR-16' are not recognized as animated
  return emoji.replace('\ufe0f', '');
}

export function selectAnimatedEmoji<T extends GlobalState>(global: T, emoji: string) {
  const { animatedEmojis } = global;
  if (!animatedEmojis || !animatedEmojis.stickers) {
    return undefined;
  }

  const cleanedEmoji = cleanEmoji(emoji);

  return animatedEmojis.stickers.find((sticker) => sticker.emoji === emoji || sticker.emoji === cleanedEmoji);
}

export function selectRestrictedEmoji<T extends GlobalState>(global: T, emoji: string) {
  const { restrictedEmoji } = global;
  if (!restrictedEmoji || !restrictedEmoji.stickers) {
    return undefined;
  }

  const cleanedEmoji = cleanEmoji(emoji);

  return restrictedEmoji.stickers.find((sticker) => {
    if (!sticker.emoji) return undefined;
    const cleanedStickerEmoji = cleanEmoji(sticker.emoji);
    return cleanedStickerEmoji === cleanedEmoji;
  });
}

export function selectAnimatedEmojiEffect<T extends GlobalState>(global: T, emoji: string) {
  const { animatedEmojiEffects } = global;
  if (!animatedEmojiEffects || !animatedEmojiEffects.stickers) {
    return undefined;
  }

  const cleanedEmoji = cleanEmoji(emoji);

  return animatedEmojiEffects.stickers.find((sticker) => sticker.emoji === emoji || sticker.emoji === cleanedEmoji);
}

export function selectAnimatedEmojiSound<T extends GlobalState>(global: T, emoji: string) {
  return global?.appConfig.emojiSounds[cleanEmoji(emoji)];
}

export function selectIsAlwaysHighPriorityEmoji<T extends GlobalState>(
  global: T, stickerSet: ApiStickerSetInfo | ApiStickerSet,
) {
  if (!('id' in stickerSet)) return false;
  return stickerSet.id === global.appConfig.defaultEmojiStatusesStickerSetId
    || stickerSet.id === RESTRICTED_EMOJI_SET_ID;
}

function findDurationEmoji(days: number): string {
  if (days <= MONTH) {
    return DURATION_EMOTICON[MONTH];
  }
  if (days <= QUARTER_YEAR) {
    return DURATION_EMOTICON[QUARTER_YEAR];
  }
  if (days <= HALF_YEAR + DURATION_DELTA) {
    return DURATION_EMOTICON[HALF_YEAR];
  }
  if (days <= YEAR + DURATION_DELTA) {
    return DURATION_EMOTICON[YEAR];
  }

  return DURATION_EMOTICON[TWO_YEARS];
}

export function selectGiftStickerForDuration<T extends GlobalState>(global: T, days = 30) {
  const stickers = global.premiumGifts?.stickers;
  if (!stickers) return undefined;

  const emoji = findDurationEmoji(days);

  return stickers.find((sticker) => sticker.emoji === emoji) || stickers[0];
}

export function selectGiftStickerForStars<T extends GlobalState>(global: T, starCount?: number) {
  const stickers = global.premiumGifts?.stickers;

  if (!stickers || !starCount) return undefined;

  let emoji;
  if (starCount <= 1000) {
    emoji = STAR_EMOTICON[1000];
  } else if (starCount < 2500) {
    emoji = STAR_EMOTICON[2500];
  } else {
    emoji = STAR_EMOTICON[5000];
  }

  return stickers.find((sticker) => sticker.emoji === emoji) || stickers[0];
}

export function selectGiftStickerForTon<T extends GlobalState>(global: T, amount?: number) {
  const stickers = global.tonGifts?.stickers;
  if (!stickers || !amount) return undefined;
  const convertedAmount = convertCurrencyFromBaseUnit(amount, TON_CURRENCY_CODE);

  let emoji;
  if (convertedAmount < 10) {
    emoji = TON_EMOTICON[1];
  } else if (convertedAmount < 50) {
    emoji = TON_EMOTICON[10];
  } else {
    emoji = TON_EMOTICON[50];
  }

  return stickers.find((sticker) => sticker.emoji === emoji) || stickers[0];
}

export function selectCustomEmoji<T extends GlobalState>(global: T, documentId: string) {
  return global.customEmojis.byId[documentId];
}
