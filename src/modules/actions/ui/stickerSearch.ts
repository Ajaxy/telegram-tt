import { addReducer } from '../../../lib/teact/teactn';
import { HistoryWrapper } from '../../../util/history';
import { RightColumnContent } from '../../../types';

addReducer('setStickerSearchQuery', (global, actions, payload) => {
  const { query, noPushState } = payload!;
  const previousQuery = global.stickers.search.query;

  if (!noPushState && previousQuery !== query) {
    if (query !== undefined && previousQuery === undefined) {
      HistoryWrapper.pushState({
        type: 'right',
        contentKey: RightColumnContent.StickerSearch,
      });
    } else {
      HistoryWrapper.back();
    }
  }

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
  const { query, noPushState } = payload!;
  const previousQuery = global.gifs.search.query;

  if (!noPushState && previousQuery !== query) {
    if (query !== undefined) {
      HistoryWrapper.pushState({
        type: 'right',
        contentKey: RightColumnContent.GifSearch,
      });
    } else {
      HistoryWrapper.back();
    }
  }

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
