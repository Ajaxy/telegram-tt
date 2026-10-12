import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from './tabs';

export function selectMusicPicker<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).musicPicker;
}

export function selectMusicSearchAudio<T extends GlobalState>(global: T, audioId: string) {
  return global.musicSearch.audiosById[audioId];
}
