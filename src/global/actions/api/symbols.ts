import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler,
  getGlobal, setGlobal,
} from '../../index';

import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import type {
  ApiError, ApiSticker, ApiStickerSet, ApiStickerSetInfo,
} from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import { pause, throttle } from '../../../util/schedulers';
import {
  updateStickerSets,
  updateStickerSet,
  replaceAnimatedEmojis,
  updateGifSearch,
  updateStickersForEmoji,
  rebuildStickersForEmoji,
  updateCustomEmojiForEmoji,
  updateCustomEmojiSets,
  updateRecentStatusCustomEmojis,
  updateStickerSearch,
} from '../../reducers';
import searchWords from '../../../util/searchWords';
import { selectTabState, selectIsCurrentUserPremium, selectStickerSet } from '../../selectors';
import { translate } from '../../../util/langProvider';
import { selectCurrentLimit, selectPremiumLimit } from '../../selectors/limits';
import * as langProvider from '../../../util/langProvider';
import { buildCollectionByKey } from '../../../util/iteratees';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

const ADDED_SETS_THROTTLE = 200;
const ADDED_SETS_THROTTLE_CHUNK = 10;

const searchThrottled = throttle((cb) => cb(), 500, false);

addActionHandler('loadStickerSets', async (global, actions): Promise<void> => {
  const [addedStickers, addedCustomEmojis] = await Promise.all([
    callApi('fetchStickerSets', { hash: global.stickers.added.hash }),
    callApi('fetchCustomEmojiSets', { hash: global.customEmojis.added.hash }),
  ]);
  if (!addedCustomEmojis || !addedStickers) {
    return;
  }

  global = getGlobal();

  global = updateStickerSets(
    global,
    'added',
    addedStickers.hash,
    addedStickers.sets,
  );

  global = updateCustomEmojiSets(
    global,
    addedCustomEmojis.hash,
    addedCustomEmojis.sets,
  );

  setGlobal(global);

  actions.loadCustomEmojis({
    ids: global.recentCustomEmojis,
  });
});

addActionHandler('loadAddedStickers', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const {
    added: {
      setIds: addedSetIds = [],
    },
    setsById: cached,
  } = global.stickers;
  const {
    added: {
      setIds: customEmojiSetIds = [],
    },
  } = global.customEmojis;
  const setIdsToLoad = [...addedSetIds, ...customEmojiSetIds];
  if (!setIdsToLoad.length) {
    return;
  }

  for (let i = 0; i < setIdsToLoad.length; i++) {
    const id = setIdsToLoad[i];
    if (cached[id]?.stickers) {
      continue; // Already loaded
    }
    actions.loadStickers({
      stickerSetInfo: { id, accessHash: cached[id].accessHash },
      tabId,
    });

    if (i % ADDED_SETS_THROTTLE_CHUNK === 0 && i > 0) {
      await pause(ADDED_SETS_THROTTLE);
    }
  }
});

addActionHandler('loadRecentStickers', (global): ActionReturnType => {
  const { hash } = global.stickers.recent || {};
  void loadRecentStickers(global, hash);
});

addActionHandler('loadFavoriteStickers', async (global): Promise<void> => {
  const { hash } = global.stickers.favorite || {};

  const favoriteStickers = await callApi('fetchFavoriteStickers', { hash });
  if (!favoriteStickers) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    stickers: {
      ...global.stickers,
      favorite: favoriteStickers,
    },
  };
  setGlobal(global);
});

addActionHandler('loadPremiumStickers', async (global): Promise<void> => {
  const { hash } = global.stickers.premium || {};

  const result = await callApi('fetchStickersForEmoji', { emoji: '⭐️⭐️', hash });
  if (!result) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    stickers: {
      ...global.stickers,
      premium: {
        hash: result.hash,
        stickers: result.stickers,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('loadPremiumSetStickers', async (global): Promise<void> => {
  const { hash } = global.stickers.premium || {};

  const result = await callApi('fetchStickersForEmoji', { emoji: '📂⭐️', hash });
  if (!result) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    stickers: {
      ...global.stickers,
      premiumSet: {
        hash: result.hash,
        stickers: result.stickers,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('loadGreetingStickers', async (global): Promise<void> => {
  const { hash } = global.stickers.greeting || {};

  const greeting = await callApi('fetchStickersForEmoji', { emoji: '👋⭐️', hash });
  if (!greeting) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    stickers: {
      ...global.stickers,
      greeting: {
        hash: greeting.hash,
        stickers: greeting.stickers.filter((sticker) => sticker.emoji === '👋'),
      },
    },
  };
  setGlobal(global);
});

addActionHandler('loadFeaturedStickers', async (global): Promise<void> => {
  const { hash } = global.stickers.featured || {};
  const featuredStickers = await callApi('fetchFeaturedStickers', { hash });
  if (!featuredStickers) {
    return;
  }

  global = getGlobal();

  global = updateStickerSets(
    global,
    'featured',
    featuredStickers.hash,
    featuredStickers.sets,
  );
  setGlobal(global);
});

addActionHandler('loadPremiumGifts', async (global): Promise<void> => {
  const stickerSet = await callApi('fetchPremiumGifts');
  if (!stickerSet) {
    return;
  }

  const { set, stickers } = stickerSet;

  global = getGlobal();
  global = {
    ...global,
    premiumGifts: { ...set, stickers },
  };
  setGlobal(global);
});

addActionHandler('loadDefaultTopicIcons', async (global): Promise<void> => {
  const stickerSet = await callApi('fetchDefaultTopicIcons');
  if (!stickerSet) {
    return;
  }
  global = getGlobal();

  const { set, stickers } = stickerSet;

  const fullSet = { ...set, stickers };

  global = updateStickerSet(global, fullSet.id, fullSet);
  global = {
    ...global,
    defaultTopicIconsId: fullSet.id,
  };
  setGlobal(global);
});

addActionHandler('loadDefaultStatusIcons', async (global): Promise<void> => {
  const stickerSet = await callApi('fetchDefaultStatusEmojis');
  if (!stickerSet) {
    return;
  }
  global = getGlobal();

  const { set, stickers } = stickerSet;
  const fullSet = { ...set, stickers };

  global = updateStickerSet(global, fullSet.id, fullSet);
  global = { ...global, defaultStatusIconsId: fullSet.id };
  setGlobal(global);
});

addActionHandler('loadStickers', (global, actions, payload): ActionReturnType => {
  const { stickerSetInfo, tabId = getCurrentTabId() } = payload;
  const cachedSet = selectStickerSet(global, stickerSetInfo);
  if (cachedSet && cachedSet.count === cachedSet?.stickers?.length) return; // Already fully loaded
  void loadStickers(global, actions, stickerSetInfo, tabId);
});

addActionHandler('loadAnimatedEmojis', async (global): Promise<void> => {
  const [emojis, effects] = await Promise.all([
    callApi('fetchAnimatedEmojis'),
    callApi('fetchAnimatedEmojiEffects'),
  ]);
  if (!emojis || !effects) {
    return;
  }

  global = getGlobal();

  global = replaceAnimatedEmojis(global, { ...emojis.set, stickers: emojis.stickers });
  global = {
    ...global,
    animatedEmojiEffects: { ...effects.set, stickers: effects.stickers },
  };

  setGlobal(global);
});

addActionHandler('loadGenericEmojiEffects', async (global): Promise<void> => {
  const stickerSet = await callApi('fetchGenericEmojiEffects');
  if (!stickerSet) {
    return;
  }
  global = getGlobal();

  const { set, stickers } = stickerSet;

  global = {
    ...global,
    genericEmojiEffects: { ...set, stickers },
  };
  setGlobal(global);
});

addActionHandler('loadSavedGifs', async (global): Promise<void> => {
  const { hash } = global.gifs.saved;

  const savedGifs = await callApi('fetchSavedGifs', { hash });
  if (!savedGifs) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    gifs: {
      ...global.gifs,
      saved: savedGifs,
    },
  };
  setGlobal(global);
});

addActionHandler('saveGif', async (global, actions, payload): Promise<void> => {
  const {
    gif, shouldUnsave,
    tabId = getCurrentTabId(),
  } = payload!;
  const length = global.gifs.saved.gifs?.length;

  const limit = selectCurrentLimit(global, 'savedGifs');
  const premiumLimit = selectPremiumLimit(global, 'savedGifs');
  const isPremium = selectIsCurrentUserPremium(global);

  if (!shouldUnsave && length && length >= limit) {
    actions.showNotification({
      title: langProvider.translate('LimitReachedFavoriteGifs', limit.toString()),
      message: isPremium ? langProvider.translate('LimitReachedFavoriteGifsSubtitlePremium')
        : langProvider.translate('LimitReachedFavoriteGifsSubtitle',
          premiumLimit.toString()),
      ...(!isPremium && {
        action: {
          action: 'openPremiumModal',
          payload: { tabId },
        },
      }),
      className: 'bold-link',
      tabId,
    });
  }

  const result = await callApi('saveGif', { gif, shouldUnsave });
  if (!result) {
    return;
  }

  global = getGlobal();
  const gifs = global.gifs.saved.gifs?.filter(({ id }) => id !== gif.id) || [];
  const newGifs = shouldUnsave ? gifs : [gif, ...gifs];

  global = {
    ...global,
    gifs: {
      ...global.gifs,
      saved: {
        ...global.gifs.saved,
        gifs: newGifs,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('faveSticker', (global, actions, payload): ActionReturnType => {
  const { sticker, tabId = getCurrentTabId() } = payload!;
  const current = global.stickers.favorite.stickers.length;
  const limit = selectCurrentLimit(global, 'stickersFaved');
  const premiumLimit = selectPremiumLimit(global, 'stickersFaved');
  const isPremium = selectIsCurrentUserPremium(global);

  if (current >= limit) {
    actions.showNotification({
      title: langProvider.translate('LimitReachedFavoriteStickers', limit.toString()),
      message: isPremium ? langProvider.translate('LimitReachedFavoriteStickersSubtitlePremium')
        : langProvider.translate('LimitReachedFavoriteStickersSubtitle',
          premiumLimit.toString()),
      ...(!isPremium && {
        action: {
          action: 'openPremiumModal',
          payload: { tabId },
        },
      }),
      className: 'bold-link',
      tabId,
    });
  }

  if (sticker) {
    void callApi('faveSticker', { sticker });
  }
});

addActionHandler('unfaveSticker', (global, actions, payload): ActionReturnType => {
  const { sticker } = payload!;

  if (sticker) {
    global = getGlobal();

    // Remove sticker preemptively to get instant feedback when user removes sticker
    // from favorites while in Sticker Picker
    global = {
      ...global,
      stickers: {
        ...global.stickers,
        favorite: {
          ...global.stickers.favorite,
          stickers: global.stickers.favorite.stickers.filter(({ id }) => id !== sticker.id),
        },
      },
    };
    setGlobal(global);

    void callApi('faveSticker', { sticker, unfave: true });
  }
});

addActionHandler('removeRecentSticker', async (global, actions, payload): Promise<void> => {
  const { sticker } = payload!;

  const result = await callApi('removeRecentSticker', { sticker });

  if (!result) return;

  global = getGlobal();
  loadRecentStickers(global);
});

addActionHandler('clearRecentStickers', async (global): Promise<void> => {
  const result = await callApi('clearRecentStickers');

  if (!result) return;

  global = getGlobal();
  global = {
    ...global,
    stickers: {
      ...global.stickers,
      recent: {
        stickers: [],
      },
    },
  };
  setGlobal(global);
});

addActionHandler('toggleStickerSet', (global, actions, payload): ActionReturnType => {
  const { stickerSetId } = payload!;
  const stickerSet = selectStickerSet(global, stickerSetId);
  if (!stickerSet) {
    return;
  }

  const { accessHash, installedDate, isArchived } = stickerSet;
  const isInstalled = !isArchived && Boolean(installedDate);

  void callApi(!isInstalled ? 'installStickerSet' : 'uninstallStickerSet', { stickerSetId, accessHash });
});

addActionHandler('loadEmojiKeywords', async (global, actions, payload): Promise<void> => {
  const { language } = payload;

  let currentEmojiKeywords = global.emojiKeywords[language];
  if (currentEmojiKeywords?.isLoading) {
    return;
  }

  global = {
    ...global,
    emojiKeywords: {
      ...global.emojiKeywords,
      [language]: {
        ...currentEmojiKeywords,
        isLoading: true,
      },
    },
  };
  setGlobal(global);

  const emojiKeywords = await callApi('fetchEmojiKeywords', {
    language,
    fromVersion: currentEmojiKeywords ? currentEmojiKeywords.version : 0,
  });

  global = getGlobal();
  currentEmojiKeywords = global.emojiKeywords[language];

  if (!emojiKeywords) {
    global = {
      ...global,
      emojiKeywords: {
        ...global.emojiKeywords,
        [language]: {
          ...currentEmojiKeywords,
          isLoading: false,
        },
      },
    };
    setGlobal(global);

    return;
  }

  global = {
    ...global,
    emojiKeywords: {
      ...global.emojiKeywords,
      [language]: {
        isLoading: false,
        version: emojiKeywords.version,
        keywords: {
          ...(currentEmojiKeywords?.keywords),
          ...emojiKeywords.keywords,
        },
      },
    },
  };
  setGlobal(global);
});

async function loadRecentStickers<T extends GlobalState>(global: T, hash?: string) {
  const recentStickers = await callApi('fetchRecentStickers', { hash });
  if (!recentStickers) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    stickers: {
      ...global.stickers,
      recent: recentStickers,
    },
  };
  setGlobal(global);
}

async function loadStickers<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  stickerSetInfo: ApiStickerSetInfo,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  let stickerSet: { set: ApiStickerSet; stickers: ApiSticker[]; packs: Record<string, ApiSticker[]> } | undefined;
  try {
    stickerSet = await callApi(
      'fetchStickers',
      { stickerSetInfo },
    );
  } catch (error) {
    if ((error as ApiError).message === 'STICKERSET_INVALID') {
      actions.showNotification({
        message: translate('StickerPack.ErrorNotFound'),
        tabId,
      });

      if ('shortName' in stickerSetInfo
        && selectTabState(global, tabId).openedStickerSetShortName === stickerSetInfo.shortName) {
        global = updateTabState(global, {
          openedStickerSetShortName: undefined,
        }, tabId);
        setGlobal(global);
      }
      return;
    }
  }
  global = getGlobal();

  if (!stickerSet) {
    // TODO handle this case when sticker cache is implemented
    return;
  }

  const { set, stickers, packs } = stickerSet;

  global = updateStickerSet(global, set.id, { ...set, stickers, packs });

  const currentEmoji = global.stickers.forEmoji.emoji;
  if (currentEmoji && packs[currentEmoji]) {
    global = rebuildStickersForEmoji(global);
  }

  setGlobal(global);
}

addActionHandler('setStickerSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;

  if (query) {
    void searchThrottled(async () => {
      const result = await callApi('searchStickers', { query });

      if (!result) {
        return;
      }

      global = getGlobal();
      const { setsById, added } = global.stickers;

      const resultIds = result.sets.map(({ id }) => id);

      if (added.setIds) {
        added.setIds.forEach((id) => {
          if (!resultIds.includes(id)) {
            const { title } = setsById[id] || {};
            if (title && searchWords(title, query)) {
              resultIds.unshift(id);
            }
          }
        });
      }

      global = updateStickerSets(
        global,
        'search',
        result.hash,
        result.sets,
      );

      global = updateStickerSearch(global, result.hash, resultIds, tabId);
      setGlobal(global);
    });
  }
});

addActionHandler('setGifSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;

  if (typeof query === 'string') {
    void searchThrottled(() => {
      searchGifs(global, query, global.config?.gifSearchUsername, undefined, tabId);
    });
  }
});

addActionHandler('searchMoreGifs', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { query, offset } = selectTabState(global, tabId).gifSearch;

  if (typeof query === 'string') {
    void searchThrottled(() => {
      searchGifs(global, query, global.config?.gifSearchUsername, offset, tabId);
    });
  }
});

addActionHandler('loadStickersForEmoji', (global, actions, payload): ActionReturnType => {
  const { emoji } = payload;
  const { hash } = global.stickers.forEmoji;

  void searchThrottled(async () => {
    global = getGlobal();
    global = {
      ...global,
      stickers: {
        ...global.stickers,
        forEmoji: {
          ...global.stickers.forEmoji,
          emoji,
        },
      },
    };
    setGlobal(global);

    const result = await callApi('fetchStickersForEmoji', { emoji, hash });

    global = getGlobal();

    if (!result || global.stickers.forEmoji.emoji !== emoji) {
      return;
    }

    global = updateStickersForEmoji(global, emoji, result.stickers, result.hash);

    setGlobal(global);
  });
});

addActionHandler('clearStickersForEmoji', (global): ActionReturnType => {
  return {
    ...global,
    stickers: {
      ...global.stickers,
      forEmoji: {},
    },
  };
});

addActionHandler('loadCustomEmojiForEmoji', (global, actions, payload): ActionReturnType => {
  const { emoji } = payload;

  return updateCustomEmojiForEmoji(global, emoji);
});

addActionHandler('clearCustomEmojiForEmoji', (global): ActionReturnType => {
  return {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      forEmoji: {},
    },
  };
});

addActionHandler('loadFeaturedEmojiStickers', async (global): Promise<void> => {
  const featuredStickers = await callApi('fetchFeaturedEmojiStickers');
  if (!featuredStickers) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      featuredIds: featuredStickers.sets.map(({ id }) => id),
      byId: {
        ...global.customEmojis.byId,
        ...buildCollectionByKey(featuredStickers.sets.flatMap((set) => set.stickers || []), 'id'),
      },
    },
    stickers: {
      ...global.stickers,
      setsById: {
        ...global.stickers.setsById,
        ...buildCollectionByKey(featuredStickers.sets, 'id'),
      },
    },
  };
  setGlobal(global);
});

addActionHandler('openStickerSet', async (global, actions, payload): Promise<void> => {
  const { stickerSetInfo, tabId = getCurrentTabId() } = payload;
  if (!selectStickerSet(global, stickerSetInfo)) {
    await loadStickers(global, actions, stickerSetInfo, tabId);
  }

  global = getGlobal();
  const set = selectStickerSet(global, stickerSetInfo);
  if (!set?.shortName) {
    return;
  }

  global = updateTabState(global, {
    openedStickerSetShortName: set.shortName,
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadRecentEmojiStatuses', async (global): Promise<void> => {
  const result = await callApi('fetchRecentEmojiStatuses');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateRecentStatusCustomEmojis(global, result.hash, result.emojiStatuses!);
  setGlobal(global);
});

async function searchGifs<T extends GlobalState>(global: T, query: string, botUsername?: string, offset?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>) {
  const result = await callApi('searchGifs', { query, offset, username: botUsername });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateGifSearch(global, !offset, result.gifs, result.nextOffset, tabId);
  setGlobal(global);
}
