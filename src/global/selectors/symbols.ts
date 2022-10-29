import type { GlobalState } from '../types';
import type { ApiStickerSetInfo, ApiSticker, ApiStickerSet } from '../../api/types';

import { RESTRICTED_EMOJI_SET_ID } from '../../config';
import { selectIsCurrentUserPremium } from './users';

export function selectIsStickerFavorite(global: GlobalState, sticker: ApiSticker) {
  const { stickers } = global.stickers.favorite;
  return stickers && stickers.some(({ id }) => id === sticker.id);
}

export function selectCurrentStickerSearch(global: GlobalState) {
  return global.stickers.search;
}

export function selectCurrentGifSearch(global: GlobalState) {
  return global.gifs.search;
}

export function selectStickerSet(global: GlobalState, id: string | ApiStickerSetInfo) {
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

export function selectStickersForEmoji(global: GlobalState, emoji: string) {
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

export function selectCustomEmojiForEmoji(global: GlobalState, emoji: string) {
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
export function selectCustomEmojiForEmojis(global: GlobalState, emojis: string[]) {
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

export function selectAnimatedEmoji(global: GlobalState, emoji: string) {
  const { animatedEmojis } = global;
  if (!animatedEmojis || !animatedEmojis.stickers) {
    return undefined;
  }

  const cleanedEmoji = cleanEmoji(emoji);

  return animatedEmojis.stickers.find((sticker) => sticker.emoji === emoji || sticker.emoji === cleanedEmoji);
}

export function selectAnimatedEmojiEffect(global: GlobalState, emoji: string) {
  const { animatedEmojiEffects } = global;
  if (!animatedEmojiEffects || !animatedEmojiEffects.stickers) {
    return undefined;
  }

  const cleanedEmoji = cleanEmoji(emoji);

  return animatedEmojiEffects.stickers.find((sticker) => sticker.emoji === emoji || sticker.emoji === cleanedEmoji);
}

export function selectAnimatedEmojiSound(global: GlobalState, emoji: string) {
  return global?.appConfig?.emojiSounds[cleanEmoji(emoji)];
}

export function selectLocalAnimatedEmoji(global: GlobalState, emoji: string) {
  const cleanedEmoji = cleanEmoji(emoji);

  return cleanedEmoji === '🍑' ? 'Peach' : (cleanedEmoji === '🍆' ? 'Eggplant' : undefined);
}

export function selectLocalAnimatedEmojiEffect(emoji: string) {
  return emoji === 'Eggplant' ? 'Cumshot' : undefined;
}

export function selectLocalAnimatedEmojiEffectByName(name: string) {
  return name === 'Cumshot' ? '🍆' : undefined;
}

export function selectIsDefaultEmojiStatusPack(global: GlobalState, pack: ApiStickerSetInfo) {
  return 'id' in pack && pack.id === global.appConfig?.defaultEmojiStatusesStickerSetId;
}

export function selectIsAlwaysHighPriorityEmoji(global: GlobalState, pack: ApiStickerSetInfo) {
  return selectIsDefaultEmojiStatusPack(global, pack) || ('id' in pack && pack.id === RESTRICTED_EMOJI_SET_ID);
}
