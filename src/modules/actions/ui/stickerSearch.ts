import { addReducer } from '../../../lib/teact/teactn';

addReducer('setStickerSearchQuery', (global, actions, payload) => {
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

addReducer('setGifSearchQuery', (global, actions, payload) => {
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
