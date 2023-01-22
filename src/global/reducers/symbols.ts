import type { GlobalState } from '../types';
import type { ApiSticker, ApiStickerSet, ApiVideo } from '../../api/types';
import { buildCollectionByKey, unique } from '../../util/iteratees';
import { selectCustomEmojiForEmoji, selectStickersForEmoji } from '../selectors';

export function updateStickerSets(
  global: GlobalState,
  category: 'added' | 'featured' | 'search',
  hash: string,
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

  const regularSetIds = sets.map((set) => set.id);

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
            : {
              setIds: [
                ...(global.stickers[category].setIds || []),
                ...regularSetIds,
              ],
            }
        ),
      },
    },
  };
}

export function updateCustomEmojiSets(
  global: GlobalState,
  hash: string,
  sets: ApiStickerSet[],
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

  const customEmojis = sets.map((set) => set.stickers).flat().filter(Boolean);
  const addedSetIds = sets.map((set) => set.id);

  return {
    ...global,
    stickers: {
      ...global.stickers,
      setsById: {
        ...global.stickers.setsById,
        ...buildCollectionByKey(updatedSets, 'id'),
      },
    },
    customEmojis: {
      ...global.customEmojis,
      added: {
        ...global.customEmojis.added,
        hash,
        setIds: [
          ...(global.customEmojis.added.setIds || []),
          ...addedSetIds,
        ],
      },
      byId: {
        ...global.customEmojis.byId,
        ...buildCollectionByKey(customEmojis, 'id'),
      },
    },
  };
}

export function updateStickerSet(
  global: GlobalState, stickerSetId: string, update: Partial<ApiStickerSet>,
): GlobalState {
  const currentStickerSet = global.stickers.setsById[stickerSetId] || {};
  const isCustomEmoji = update.isEmoji || currentStickerSet.isEmoji;
  const addedSets = (isCustomEmoji ? global.customEmojis.added.setIds : global.stickers.added.setIds) || [];
  let setIds: string[] = addedSets;
  if (update.installedDate && !update.isArchived && addedSets && !addedSets.includes(stickerSetId)) {
    setIds = [stickerSetId, ...setIds];
  }

  if (!update.installedDate && addedSets?.includes(stickerSetId)) {
    setIds = setIds.filter((id) => id !== stickerSetId);
  }

  const customEmojiById = isCustomEmoji && update.stickers && buildCollectionByKey(update.stickers, 'id');

  return {
    ...global,
    stickers: {
      ...global.stickers,
      added: {
        ...global.stickers.added,
        ...(!isCustomEmoji && { setIds }),
      },
      setsById: {
        ...global.stickers.setsById,
        [stickerSetId]: {
          ...currentStickerSet,
          ...update,
        },
      },
    },
    customEmojis: {
      ...global.customEmojis,
      byId: {
        ...global.customEmojis.byId,
        ...customEmojiById,
      },
      added: {
        ...global.customEmojis.added,
        ...(isCustomEmoji && { setIds }),
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
  global: GlobalState, emoji: string, remoteStickers?: ApiSticker[], hash?: string,
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

export function updateCustomEmojiForEmoji(
  global: GlobalState, emoji: string,
): GlobalState {
  const localStickers = selectCustomEmojiForEmoji(global, emoji);
  const uniqueIds = unique(localStickers.map(({ id }) => id));
  const byId = buildCollectionByKey(localStickers, 'id');
  const stickers = uniqueIds.map((id) => byId[id]);

  return {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      forEmoji: {
        emoji,
        stickers,
      },
    },
  };
}

export function rebuildStickersForEmoji(global: GlobalState): GlobalState {
  if (global.stickers.forEmoji) {
    const { emoji, stickers, hash } = global.stickers.forEmoji;
    if (!emoji) {
      return global;
    }

    return updateStickersForEmoji(global, emoji, stickers, hash);
  }

  if (global.customEmojis.forEmoji) {
    const { emoji } = global.customEmojis.forEmoji;
    if (!emoji) {
      return global;
    }

    return updateCustomEmojiForEmoji(global, emoji);
  }

  return global;
}
