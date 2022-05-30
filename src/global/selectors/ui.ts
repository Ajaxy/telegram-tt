import type { GlobalState } from '../types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getSystemTheme, IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { selectCurrentMessageList, selectIsPollResultsOpen } from './messages';
import { selectCurrentTextSearch } from './localSearch';
import { selectCurrentStickerSearch, selectCurrentGifSearch } from './symbols';
import { selectIsStatisticsShown, selectIsMessageStatisticsShown } from './statistics';
import { selectCurrentManagement } from './management';

export function selectIsMediaViewerOpen(global: GlobalState) {
  const { mediaViewer } = global;
  return Boolean(mediaViewer.messageId || mediaViewer.avatarOwnerId);
}

export function selectRightColumnContentKey(global: GlobalState) {
  return selectIsPollResultsOpen(global) ? (
    RightColumnContent.PollResults
  ) : !IS_SINGLE_COLUMN_LAYOUT && selectCurrentTextSearch(global) ? (
    RightColumnContent.Search
  ) : selectCurrentManagement(global) ? (
    RightColumnContent.Management
  ) : selectIsMessageStatisticsShown(global) ? (
    RightColumnContent.MessageStatistics
  ) : selectIsStatisticsShown(global) ? (
    RightColumnContent.Statistics
  ) : selectCurrentStickerSearch(global).query !== undefined ? (
    RightColumnContent.StickerSearch
  ) : selectCurrentGifSearch(global).query !== undefined ? (
    RightColumnContent.GifSearch
  ) : global.newChatMembersProgress !== NewChatMembersProgress.Closed ? (
    RightColumnContent.AddingMembers
  ) : global.isChatInfoShown && selectCurrentMessageList(global) ? (
    RightColumnContent.ChatInfo
  ) : undefined;
}

export function selectIsRightColumnShown(global: GlobalState) {
  return selectRightColumnContentKey(global) !== undefined;
}

export function selectTheme(global: GlobalState) {
  const { theme, shouldUseSystemTheme } = global.settings.byKey;

  return shouldUseSystemTheme ? getSystemTheme() : theme;
}
