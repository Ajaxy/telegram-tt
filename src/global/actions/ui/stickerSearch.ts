import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';

addActionHandler('setStickerSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;

  return updateTabState(global, {
    stickerSearch: {
      query,
      resultIds: undefined,
    },
  }, tabId);
});

addActionHandler('setGifSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;

  return updateTabState(global, {
    gifSearch: {
      query,
      offset: undefined,
      // offsetId: undefined,
      results: undefined,
    },
  }, tabId);
});
