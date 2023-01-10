import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';

import type { ApiStickerSetInfo, ApiSticker } from '../../../api/types';
import type { LangCode } from '../../../types';
import { callApi } from '../../../api/gramjs';
import { onTickEnd, pause, throttle } from '../../../util/schedulers';
import {
  updateStickerSets,
  updateStickerSet,
  replaceAnimatedEmojis,
  updateGifSearch,
  updateStickersForEmoji,
  rebuildStickersForEmoji,
  updateCustomEmojiForEmoji,
  updateCustomEmojiSets,
} from '../../reducers';
import searchWords from '../../../util/searchWords';
import { selectIsCurrentUserPremium, selectStickerSet } from '../../selectors';
import { getTranslation } from '../../../util/langProvider';
import { selectCurrentLimit, selectPremiumLimit } from '../../selectors/limits';
import * as langProvider from '../../../util/langProvider';
import { buildCollectionByKey } from '../../../util/iteratees';

const ADDED_SETS_THROTTLE = 200;
const ADDED_SETS_THROTTLE_CHUNK = 10;

const searchThrottled = throttle((cb) => cb(), 500, false);

addActionHandler('loadStickerSets', async (global, actions) => {
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

addActionHandler('loadAddedStickers', async (global, actions) => {
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
    });

    if (i % ADDED_SETS_THROTTLE_CHUNK === 0 && i > 0) {
      await pause(ADDED_SETS_THROTTLE);
    }
  }
});

addActionHandler('loadRecentStickers', (global) => {
  const { hash } = global.stickers.recent || {};
  void loadRecentStickers(hash);
});

addActionHandler('loadFavoriteStickers', (global) => {
  const { hash } = global.stickers.favorite || {};
  void loadFavoriteStickers(hash);
});

addActionHandler('loadPremiumStickers', async (global) => {
  const { hash } = global.stickers.premium || {};

  const result = await callApi('fetchStickersForEmoji', { emoji: '⭐️⭐️', hash });
  if (!result) {
    return;
  }

  global = getGlobal();

  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      premium: {
        hash: result.hash,
        stickers: result.stickers,
      },
    },
  });
});

addActionHandler('loadPremiumSetStickers', async (global) => {
  const { hash } = global.stickers.premium || {};

  const result = await callApi('fetchStickersForEmoji', { emoji: '📂⭐️', hash });
  if (!result) {
    return;
  }

  global = getGlobal();

  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      premiumSet: {
        hash: result.hash,
        stickers: result.stickers,
      },
    },
  });
});

addActionHandler('loadGreetingStickers', async (global) => {
  const { hash } = global.stickers.greeting || {};

  const greeting = await callApi('fetchStickersForEmoji', { emoji: '👋⭐️', hash });
  if (!greeting) {
    return;
  }

  global = getGlobal();

  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      greeting: {
        hash: greeting.hash,
        stickers: greeting.stickers.filter((sticker) => sticker.emoji === '👋'),
      },
    },
  });
});

addActionHandler('loadFeaturedStickers', async (global) => {
  const { hash } = global.stickers.featured || {};
  const featuredStickers = await callApi('fetchFeaturedStickers', { hash });
  if (!featuredStickers) {
    return;
  }

  global = getGlobal();

  setGlobal(updateStickerSets(
    global,
    'featured',
    featuredStickers.hash,
    featuredStickers.sets,
  ));
});

addActionHandler('loadPremiumGifts', async () => {
  const stickerSet = await callApi('fetchPremiumGifts');
  if (!stickerSet) {
    return;
  }

  const { set, stickers } = stickerSet;

  setGlobal({
    ...getGlobal(),
    premiumGifts: { ...set, stickers },
  });
});

addActionHandler('loadDefaultTopicIcons', async (global) => {
  const stickerSet = await callApi('fetchDefaultTopicIcons');
  if (!stickerSet) {
    return;
  }
  global = getGlobal();

  const { set, stickers } = stickerSet;

  const fullSet = { ...set, stickers };

  global = updateStickerSet(global, fullSet.id, fullSet);
  setGlobal({
    ...global,
    defaultTopicIconsId: fullSet.id,
  });
});

addActionHandler('loadStickers', (global, actions, payload) => {
  const { stickerSetInfo } = payload;
  const cachedSet = selectStickerSet(global, stickerSetInfo);
  if (cachedSet && cachedSet.count === cachedSet?.stickers?.length) return; // Already fully loaded
  void loadStickers(stickerSetInfo);
});

addActionHandler('loadAnimatedEmojis', async (global) => {
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

addActionHandler('loadGenericEmojiEffects', async (global) => {
  const stickerSet = await callApi('fetchGenericEmojiEffects');
  if (!stickerSet) {
    return;
  }
  global = getGlobal();

  const { set, stickers } = stickerSet;

  setGlobal({
    ...global,
    genericEmojiEffects: { ...set, stickers },
  });
});

addActionHandler('loadSavedGifs', (global) => {
  const { hash } = global.gifs.saved;
  void loadSavedGifs(hash);
});

addActionHandler('saveGif', async (global, actions, payload) => {
  const { gif, shouldUnsave } = payload!;
  const length = global.gifs.saved.gifs?.length;

  const limit = selectCurrentLimit(global, 'savedGifs');
  const premiumLimit = selectPremiumLimit(global, 'savedGifs');
  const isPremium = selectIsCurrentUserPremium(global);

  if (!shouldUnsave && length && length >= limit) {
    actions.showNotification({
      title: langProvider.getTranslation('LimitReachedFavoriteGifs', limit.toString()),
      message: isPremium ? langProvider.getTranslation('LimitReachedFavoriteGifsSubtitlePremium')
        : langProvider.getTranslation('LimitReachedFavoriteGifsSubtitle',
          premiumLimit.toString()),
      ...(!isPremium && { action: actions.openPremiumModal }),
      className: 'bold-link',
    });
  }

  const result = await callApi('saveGif', { gif, shouldUnsave });
  if (!result) {
    return;
  }

  global = getGlobal();
  const gifs = global.gifs.saved.gifs?.filter(({ id }) => id !== gif.id) || [];
  const newGifs = shouldUnsave ? gifs : [gif, ...gifs];

  setGlobal({
    ...global,
    gifs: {
      ...global.gifs,
      saved: {
        ...global.gifs.saved,
        gifs: newGifs,
      },
    },
  });
});

addActionHandler('faveSticker', (global, actions, payload) => {
  const { sticker } = payload!;
  const current = global.stickers.favorite.stickers.length;
  const limit = selectCurrentLimit(global, 'stickersFaved');
  const premiumLimit = selectPremiumLimit(global, 'stickersFaved');
  const isPremium = selectIsCurrentUserPremium(global);

  if (current >= limit) {
    actions.showNotification({
      title: langProvider.getTranslation('LimitReachedFavoriteStickers', limit.toString()),
      message: isPremium ? langProvider.getTranslation('LimitReachedFavoriteStickersSubtitlePremium')
        : langProvider.getTranslation('LimitReachedFavoriteStickersSubtitle',
          premiumLimit.toString()),
      ...(!isPremium && { action: actions.openPremiumModal }),
      className: 'bold-link',
    });
  }

  if (sticker) {
    void callApi('faveSticker', { sticker });
  }
});

addActionHandler('unfaveSticker', (global, actions, payload) => {
  const { sticker } = payload!;

  if (sticker) {
    void unfaveSticker(sticker);
  }
});

addActionHandler('removeRecentSticker', async (global, action, payload) => {
  const { sticker } = payload!;

  const result = await callApi('removeRecentSticker', { sticker });

  if (!result) return;

  loadRecentStickers();
});

addActionHandler('clearRecentStickers', async (global) => {
  const result = await callApi('clearRecentStickers');

  if (!result) return;

  global = getGlobal();
  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      recent: {
        stickers: [],
      },
    },
  });
});

addActionHandler('toggleStickerSet', (global, actions, payload) => {
  const { stickerSetId } = payload!;
  const stickerSet = selectStickerSet(global, stickerSetId);
  if (!stickerSet) {
    return;
  }

  const { accessHash, installedDate } = stickerSet;

  void callApi(!installedDate ? 'installStickerSet' : 'uninstallStickerSet', { stickerSetId, accessHash });
});

addActionHandler('loadEmojiKeywords', async (global, actions, payload: { language: LangCode }) => {
  const { language } = payload;

  let currentEmojiKeywords = global.emojiKeywords[language];
  if (currentEmojiKeywords?.isLoading) {
    return;
  }

  setGlobal({
    ...global,
    emojiKeywords: {
      ...global.emojiKeywords,
      [language]: {
        ...currentEmojiKeywords,
        isLoading: true,
      },
    },
  });

  const emojiKeywords = await callApi('fetchEmojiKeywords', {
    language,
    fromVersion: currentEmojiKeywords ? currentEmojiKeywords.version : 0,
  });

  global = getGlobal();
  currentEmojiKeywords = global.emojiKeywords[language];

  if (!emojiKeywords) {
    setGlobal({
      ...global,
      emojiKeywords: {
        ...global.emojiKeywords,
        [language]: {
          ...currentEmojiKeywords,
          isLoading: false,
        },
      },
    });

    return;
  }

  setGlobal({
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
  });
});

async function loadRecentStickers(hash?: string) {
  const recentStickers = await callApi('fetchRecentStickers', { hash });
  if (!recentStickers) {
    return;
  }

  const global = getGlobal();

  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      recent: recentStickers,
    },
  });
}

async function loadFavoriteStickers(hash?: string) {
  const favoriteStickers = await callApi('fetchFavoriteStickers', { hash });
  if (!favoriteStickers) {
    return;
  }

  const global = getGlobal();

  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      favorite: favoriteStickers,
    },
  });
}

async function loadStickers(stickerSetInfo: ApiStickerSetInfo) {
  const stickerSet = await callApi(
    'fetchStickers',
    { stickerSetInfo },
  );
  let global = getGlobal();

  if (!stickerSet) {
    onTickEnd(() => {
      getActions().showNotification({
        message: getTranslation('StickerPack.ErrorNotFound'),
      });
    });
    if ('shortName' in stickerSetInfo && global.openedStickerSetShortName === stickerSetInfo.shortName) {
      setGlobal({
        ...global,
        openedStickerSetShortName: undefined,
      });
    }
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

function unfaveSticker(sticker: ApiSticker) {
  const global = getGlobal();

  // Remove sticker preemptively to get instant feedback when user removes sticker
  // from favorites while in Sticker Picker
  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      favorite: {
        ...global.stickers.favorite,
        stickers: global.stickers.favorite.stickers.filter(({ id }) => id !== sticker.id),
      },
    },
  });

  void callApi('faveSticker', { sticker, unfave: true });
}

addActionHandler('setStickerSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  if (query) {
    void searchThrottled(() => {
      searchStickers(query);
    });
  }
});

addActionHandler('setGifSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  if (typeof query === 'string') {
    void searchThrottled(() => {
      searchGifs(query, global.config?.gifSearchUsername);
    });
  }
});

addActionHandler('searchMoreGifs', (global) => {
  const { query, offset } = global.gifs.search;

  if (typeof query === 'string') {
    void searchThrottled(() => {
      searchGifs(query, global.config?.gifSearchUsername, offset);
    });
  }
});

addActionHandler('loadStickersForEmoji', (global, actions, payload) => {
  const { emoji } = payload;
  const { hash } = global.stickers.forEmoji;

  void searchThrottled(() => {
    loadStickersForEmoji(emoji, hash);
  });
});

addActionHandler('clearStickersForEmoji', (global) => {
  return {
    ...global,
    stickers: {
      ...global.stickers,
      forEmoji: {},
    },
  };
});

addActionHandler('loadCustomEmojiForEmoji', (global, actions, payload) => {
  const { emoji } = payload;

  return updateCustomEmojiForEmoji(global, emoji);
});

addActionHandler('clearCustomEmojiForEmoji', (global) => {
  return {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      forEmoji: {},
    },
  };
});

addActionHandler('loadFeaturedEmojiStickers', async (global) => {
  const featuredStickers = await callApi('fetchFeaturedEmojiStickers');
  if (!featuredStickers) {
    return;
  }

  global = getGlobal();
  setGlobal({
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
  });
});

addActionHandler('openStickerSet', async (global, actions, payload) => {
  const { stickerSetInfo } = payload;
  if (!selectStickerSet(global, stickerSetInfo)) {
    await loadStickers(stickerSetInfo);
  }

  global = getGlobal();
  const set = selectStickerSet(global, stickerSetInfo);
  if (!set?.shortName) {
    actions.showNotification({
      message: getTranslation('StickerPack.ErrorNotFound'),
    });
    return;
  }

  setGlobal({
    ...global,
    openedStickerSetShortName: set.shortName,
  });
});

async function searchStickers(query: string, hash?: string) {
  const result = await callApi('searchStickers', { query, hash });

  if (!result) {
    return;
  }

  const global = getGlobal();
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

  setGlobal(updateStickerSets(
    global,
    'search',
    result.hash,
    result.sets,
    resultIds,
  ));
}

async function searchGifs(query: string, botUsername?: string, offset?: string) {
  const result = await callApi('searchGifs', { query, offset, username: botUsername });
  if (!result) {
    return;
  }

  setGlobal(updateGifSearch(getGlobal(), !offset, result.gifs, result.nextOffset));
}

async function loadSavedGifs(hash?: string) {
  const savedGifs = await callApi('fetchSavedGifs', { hash });
  if (!savedGifs) {
    return;
  }

  const global = getGlobal();

  setGlobal({
    ...global,
    gifs: {
      ...global.gifs,
      saved: savedGifs,
    },
  });
}

async function loadStickersForEmoji(emoji: string, hash?: string) {
  let global = getGlobal();
  setGlobal({
    ...global,
    stickers: {
      ...global.stickers,
      forEmoji: {
        ...global.stickers.forEmoji,
        emoji,
      },
    },
  });

  const result = await callApi('fetchStickersForEmoji', { emoji, hash });

  global = getGlobal();

  if (!result || global.stickers.forEmoji.emoji !== emoji) {
    return;
  }

  global = updateStickersForEmoji(global, emoji, result.stickers, result.hash);

  setGlobal(global);
}
