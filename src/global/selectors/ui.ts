import type { GlobalState, TabArgs } from '../types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getSystemTheme } from '../../util/environment';
import {
  selectCurrentMessageList, selectIsCreateTopicPanelOpen, selectIsEditTopicPanelOpen, selectIsPollResultsOpen,
} from './messages';
import { selectCurrentTextSearch } from './localSearch';
import { selectCurrentStickerSearch, selectCurrentGifSearch } from './symbols';
import { selectIsStatisticsShown, selectIsMessageStatisticsShown } from './statistics';
import { selectCurrentManagement } from './management';
import { selectTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';

export function selectIsMediaViewerOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { mediaViewer } = selectTabState(global, tabId);
  return Boolean(mediaViewer.mediaId || mediaViewer.avatarOwnerId);
}

export function selectRightColumnContentKey<T extends GlobalState>(
  global: T,
  isMobile?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectIsEditTopicPanelOpen(global, tabId) ? (
    RightColumnContent.EditTopic
  ) : selectIsCreateTopicPanelOpen(global, tabId) ? (
    RightColumnContent.CreateTopic
  ) : selectIsPollResultsOpen(global, tabId) ? (
    RightColumnContent.PollResults
  ) : !isMobile && selectCurrentTextSearch(global, tabId) ? (
    RightColumnContent.Search
  ) : selectCurrentManagement(global, tabId) ? (
    RightColumnContent.Management
  ) : selectIsMessageStatisticsShown(global, tabId) ? (
    RightColumnContent.MessageStatistics
  ) : selectIsStatisticsShown(global, tabId) ? (
    RightColumnContent.Statistics
  ) : selectCurrentStickerSearch(global, tabId).query !== undefined ? (
    RightColumnContent.StickerSearch
  ) : selectCurrentGifSearch(global, tabId).query !== undefined ? (
    RightColumnContent.GifSearch
  ) : selectTabState(global, tabId).newChatMembersProgress !== NewChatMembersProgress.Closed ? (
    RightColumnContent.AddingMembers
  ) : selectTabState(global, tabId).isChatInfoShown && selectCurrentMessageList(global, tabId) ? (
    RightColumnContent.ChatInfo
  ) : undefined;
}

export function selectIsRightColumnShown<T extends GlobalState>(
  global: T,
  isMobile?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectRightColumnContentKey(global, isMobile, tabId) !== undefined;
}

export function selectTheme<T extends GlobalState>(global: T) {
  const { theme, shouldUseSystemTheme } = global.settings.byKey;

  return shouldUseSystemTheme ? getSystemTheme() : theme;
}

export function selectIsForumPanelOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  return Boolean(tabState.forumPanelChatId) && (
    tabState.globalSearch.query === undefined || tabState.globalSearch.isClosing
  );
}
