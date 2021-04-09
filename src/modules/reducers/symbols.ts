import { GlobalState } from '../../global/types';
import { ApiSticker, ApiStickerSet, ApiVideo } from '../../api/types';
import { buildCollectionByKey, unique } from '../../util/iteratees';
import { selectStickersForEmoji } from '../selectors';

export function updateStickerSets(
  global: GlobalState,
  category: 'added' | 'featured' | 'search',
  hash: number,
  sets: ApiStickerSet[],
  resultIds?: string[],
): GlobalState {
  const updatedSets = sets.map((stickerSet) => {
    const existing = global.stickers.setsById[stickerSet.id];
    if (!existing) {
      return stickerSet;
    }

    return {
      ...existing,
      ...stickerSet,
    };
  });

  return {
    ...global,
    stickers: {
      ...global.stickers,
      setsById: {
        ...global.stickers.setsById,
        ...buildCollectionByKey(updatedSets, 'id'),
      },
      [category]: {
        ...global.stickers[category],
        hash,
        ...(
          category === 'search'
            ? { resultIds }
            : { setIds: sets.map(({ id }) => id) }
        ),
      },
    },
  };
}

export function updateStickerSet(
  global: GlobalState, stickerSetId: string, update: Partial<ApiStickerSet>,
): GlobalState {
  const currentStickerSet = global.stickers.setsById[stickerSetId] || {};

  return {
    ...global,
    stickers: {
      ...global.stickers,
      setsById: {
        ...global.stickers.setsById,
        [stickerSetId]: {
          ...currentStickerSet,
          ...update,
        },
      },
    },
  };
}

export function updateGifSearch(
  global: GlobalState, isNew: boolean, results: ApiVideo[], nextOffset?: string,
): GlobalState {
  const { results: currentResults } = global.gifs.search;

  let newResults!: ApiVideo[];
  if (isNew || !currentResults) {
    newResults = results;
  } else {
    const currentIds = new Set(currentResults.map((gif) => gif.id));
    newResults = [
      ...currentResults,
      ...results.filter((gif) => !currentIds.has(gif.id)),
    ];
  }

  return {
    ...global,
    gifs: {
      ...global.gifs,
      search: {
        ...global.gifs.search,
        offset: nextOffset,
        results: newResults,
      },
    },
  };
}

export function replaceAnimatedEmojis(global: GlobalState, stickerSet: ApiStickerSet): GlobalState {
  return {
    ...global,
    animatedEmojis: stickerSet,
  };
}

export function updateStickersForEmoji(
  global: GlobalState, emoji: string, remoteStickers?: ApiSticker[], hash?: number,
): GlobalState {
  const localStickers = selectStickersForEmoji(global, emoji);
  const allStickers = [...localStickers, ...(remoteStickers || [])];
  const uniqueIds = unique(allStickers.map(({ id }) => id));
  const byId = buildCollectionByKey(allStickers, 'id');
  const stickers = uniqueIds.map((id) => byId[id]);

  return {
    ...global,
    stickers: {
      ...global.stickers,
      forEmoji: {
        emoji,
        stickers,
        hash,
      },
    },
  };
}

export function rebuildStickersForEmoji(global: GlobalState): GlobalState {
  const { emoji, stickers, hash } = global.stickers.forEmoji || {};
  if (!emoji) {
    return global;
  }

  return updateStickersForEmoji(global, emoji, stickers, hash);
}
