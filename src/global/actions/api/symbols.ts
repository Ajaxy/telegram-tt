import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { ApiSticker } from '../../../api/types';
import { LangCode } from '../../../types';
import { callApi } from '../../../api/gramjs';
import { pause, throttle } from '../../../util/schedulers';
import {
  updateStickerSets,
  updateStickerSet,
  replaceAnimatedEmojis,
  updateGifSearch,
  updateStickersForEmoji,
  rebuildStickersForEmoji,
} from '../../reducers';
import searchWords from '../../../util/searchWords';
import { selectStickerSet } from '../../selectors';

const ADDED_SETS_THROTTLE = 200;
const ADDED_SETS_THROTTLE_CHUNK = 10;

const searchThrottled = throttle((cb) => cb(), 500, false);

addActionHandler('loadStickerSets', (global) => {
  const { hash } = global.stickers.added || {};
  void loadStickerSets(hash);
});

addActionHandler('loadAddedStickers', async (global, actions) => {
  const { setIds: addedSetIds } = global.stickers.added;
  const cached = global.stickers.setsById;
  if (!addedSetIds || !addedSetIds.length) {
    return;
  }

  for (let i = 0; i < addedSetIds.length; i++) {
    const id = addedSetIds[i];
    if (cached[id].stickers) {
      continue; // Already loaded
    }
    actions.loadStickers({ stickerSetId: id });

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

addActionHandler('loadGreetingStickers', async (global) => {
  const { hash } = global.stickers.greeting || {};

  const greeting = await callApi('fetchStickersForEmoji', { emoji: '👋⭐️', hash });
  if (!greeting) {
    return undefined;
  }

  global = getGlobal();

  return {
    ...global,
    stickers: {
      ...global.stickers,
      greeting: {
        hash: greeting.hash,
        stickers: greeting.stickers.filter((sticker) => sticker.emoji === '👋'),
      },
    },
  };
});

addActionHandler('loadFeaturedStickers', (global) => {
  const { hash } = global.stickers.featured || {};
  void loadFeaturedStickers(hash);
});

addActionHandler('loadStickers', (global, actions, payload) => {
  const { stickerSetId, stickerSetShortName } = payload!;
  let { stickerSetAccessHash } = payload!;

  if (!stickerSetAccessHash && !stickerSetShortName) {
    const stickerSet = selectStickerSet(global, stickerSetId);
    if (!stickerSet) {
      return;
    }

    stickerSetAccessHash = stickerSet.accessHash;
  }

  void loadStickers(stickerSetId, stickerSetAccessHash, stickerSetShortName);
});

addActionHandler('loadAnimatedEmojis', () => {
  void loadAnimatedEmojis();
  void loadAnimatedEmojiEffects();
});

addActionHandler('loadSavedGifs', (global) => {
  const { hash } = global.gifs.saved;
  void loadSavedGifs(hash);
});

addActionHandler('faveSticker', (global, actions, payload) => {
  const { sticker } = payload!;

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
    return undefined;
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
    return {
      ...global,
      emojiKeywords: {
        ...global.emojiKeywords,
        [language]: {
          ...currentEmojiKeywords,
          isLoading: false,
        },
      },
    };
  }

  return {
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
});

async function loadStickerSets(hash?: string) {
  const addedStickers = await callApi('fetchStickerSets', { hash });
  if (!addedStickers) {
    return;
  }

  setGlobal(updateStickerSets(
    getGlobal(),
    'added',
    addedStickers.hash,
    addedStickers.sets,
  ));
}

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

async function loadFeaturedStickers(hash?: string) {
  const featuredStickers = await callApi('fetchFeaturedStickers', { hash });
  if (!featuredStickers) {
    return;
  }

  setGlobal(updateStickerSets(
    getGlobal(),
    'featured',
    featuredStickers.hash,
    featuredStickers.sets,
  ));
}

async function loadStickers(stickerSetId: string, accessHash: string, stickerSetShortName?: string) {
  const stickerSet = await callApi(
    'fetchStickers',
    { stickerSetShortName, stickerSetId, accessHash },
  );
  if (!stickerSet) {
    return;
  }

  const { set, stickers, packs } = stickerSet;

  let global = getGlobal();

  global = updateStickerSet(global, set.id, { ...set, stickers, packs });

  const currentEmoji = global.stickers.forEmoji.emoji;
  if (currentEmoji && packs[currentEmoji]) {
    global = rebuildStickersForEmoji(global);
  }

  setGlobal(global);
}

async function loadAnimatedEmojis() {
  const stickerSet = await callApi('fetchAnimatedEmojis');
  if (!stickerSet) {
    return;
  }

  const { set, stickers } = stickerSet;

  setGlobal(replaceAnimatedEmojis(getGlobal(), { ...set, stickers }));
}

async function loadAnimatedEmojiEffects() {
  const stickerSet = await callApi('fetchAnimatedEmojiEffects');
  if (!stickerSet) {
    return;
  }

  const { set, stickers } = stickerSet;

  setGlobal({
    ...getGlobal(),
    animatedEmojiEffects: { ...set, stickers },
  });
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
      searchGifs(query);
    });
  }
});

addActionHandler('searchMoreGifs', (global) => {
  const { query, offset } = global.gifs.search;

  if (typeof query === 'string') {
    void searchThrottled(() => {
      searchGifs(query, offset);
    });
  }
});

addActionHandler('loadStickersForEmoji', (global, actions, payload) => {
  const { emoji } = payload!;
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

addActionHandler('openStickerSetShortName', (global, actions, payload) => {
  const { stickerSetShortName } = payload!;
  return {
    ...global,
    openedStickerSetShortName: stickerSetShortName,
  };
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

async function searchGifs(query: string, offset?: string) {
  const result = await callApi('searchGifs', { query, offset });
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
