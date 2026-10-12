import type { ApiAudio } from '../../api/types';
import type { GlobalState, TabArgs, TabState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../util/iteratees';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function updateMusicPicker<T extends GlobalState>(
  global: T,
  update: Partial<NonNullable<TabState['musicPicker']>>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const musicPicker = selectTabState(global, tabId).musicPicker;
  if (!musicPicker) return global;

  return updateTabState(global, {
    musicPicker: {
      ...musicPicker,
      ...update,
    },
  }, tabId);
}

export function addMusicSearchAudios<T extends GlobalState>(global: T, audios: ApiAudio[]): T {
  if (!audios.length) return global;

  return {
    ...global,
    musicSearch: {
      ...global.musicSearch,
      audiosById: {
        ...global.musicSearch.audiosById,
        ...buildCollectionByKey(audios, 'id'),
      },
    },
  };
}
