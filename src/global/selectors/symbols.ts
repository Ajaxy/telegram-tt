import type { GlobalState } from '../types';
import type { ApiSticker } from '../../api/types';

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

export function selectStickerSet(global: GlobalState, id: string) {
  return global.stickers.setsById[id];
}

export function selectStickerSetByShortName(global: GlobalState, shortName: string) {
  return Object.values(global.stickers.setsById).find((l) => l.shortName.toLowerCase() === shortName.toLowerCase());
}

export function selectStickersForEmoji(global: GlobalState, emoji: string) {
  const stickerSets = Object.values(global.stickers.setsById);
  let stickersForEmoji: ApiSticker[] = [];
  // Favorites
  global.stickers.favorite.stickers.forEach((sticker) => {
    if (sticker.emoji === emoji) stickersForEmoji.push(sticker);
  });

  // Added sets
  stickerSets.forEach(({ packs }) => {
    if (!packs) {
      return;
    }

    stickersForEmoji = stickersForEmoji.concat(packs[emoji] || [], packs[cleanEmoji(emoji)] || []);
  });
  return stickersForEmoji;
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
