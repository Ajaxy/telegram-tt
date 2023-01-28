import type {
  GlobalState, TabState, TabArgs,
} from '../types';
import { getCurrentTabId } from '../../util/establishMultitabRole';

export function selectTabState<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
): TabState {
  return global.byTabId[tabId];
}
