import { addActionHandler } from '../..';

addActionHandler('setStickerSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  return {
    ...global,
    stickers: {
      ...global.stickers,
      search: {
        query,
        resultIds: undefined,
      },
    },
  };
});

addActionHandler('setGifSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  return {
    ...global,
    gifs: {
      ...global.gifs,
      search: {
        query,
        offsetId: undefined,
        results: undefined,
      },
    },
  };
});
