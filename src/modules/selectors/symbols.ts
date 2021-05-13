import { GlobalState } from '../../global/types';
import { ApiSticker } from '../../api/types';

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

export function selectStickersForEmoji(global: GlobalState, emoji: string) {
  const stickerSets = Object.values(global.stickers.setsById);
  let stickersForEmoji: ApiSticker[] = [];
  stickerSets.forEach(({ packs }) => {
    if (!packs) {
      return;
    }
    const stickers = packs[emoji];
    if (stickers) {
      stickersForEmoji = stickersForEmoji.concat(stickers);
    }
  });
  return stickersForEmoji;
}

export function selectAnimatedEmoji(global: GlobalState, emoji: string) {
  const { animatedEmojis } = global;
  if (!animatedEmojis || !animatedEmojis.stickers) {
    return undefined;
  }

  // Some emojis (❤️ for example) with a service symbol 'VARIATION SELECTOR-16' are not recognized as animated
  const cleanedEmoji = emoji.replace('\ufe0f', '');

  return animatedEmojis.stickers.find((sticker) => sticker.emoji === emoji || sticker.emoji === cleanedEmoji);
}
