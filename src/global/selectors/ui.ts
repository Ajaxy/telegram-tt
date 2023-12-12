import type { ApiMessage } from '../../api/types';
import type { PerformanceTypeKey } from '../../types';
import type { GlobalState, TabArgs } from '../types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { getMessageVideo, getMessageWebPageVideo } from '../helpers';
import { selectCurrentTextSearch } from './localSearch';
import { selectCurrentManagement } from './management';
import { selectIsStatisticsShown } from './statistics';
import { selectTabState } from './tabs';

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
  const tabState = selectTabState(global, tabId);

  return tabState.editTopicPanel ? (
    RightColumnContent.EditTopic
  ) : tabState.createTopicPanel ? (
    RightColumnContent.CreateTopic
  ) : tabState.pollResults.messageId ? (
    RightColumnContent.PollResults
  ) : !isMobile && selectCurrentTextSearch(global, tabId) ? (
    RightColumnContent.Search
  ) : selectCurrentManagement(global, tabId) ? (
    RightColumnContent.Management
  ) : tabState.isStatisticsShown && tabState.statistics.currentMessageId ? (
    RightColumnContent.MessageStatistics
  ) : tabState.isStatisticsShown && tabState.statistics.currentStoryId ? (
    RightColumnContent.StoryStatistics
  ) : selectIsStatisticsShown(global, tabId) ? (
    RightColumnContent.Statistics
  ) : tabState.boostStatistics ? (
    RightColumnContent.BoostStatistics
  ) : tabState.stickerSearch.query !== undefined ? (
    RightColumnContent.StickerSearch
  ) : tabState.gifSearch.query !== undefined ? (
    RightColumnContent.GifSearch
  ) : tabState.newChatMembersProgress !== NewChatMembersProgress.Closed ? (
    RightColumnContent.AddingMembers
  ) : tabState.isChatInfoShown && tabState.messageLists.length ? (
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
  const { theme } = global.settings.byKey;

  return theme;
}

export function selectIsForumPanelOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  return Boolean(tabState.forumPanelChatId) && (
    tabState.globalSearch.query === undefined || Boolean(tabState.globalSearch.isClosing)
  );
}

export function selectIsForumPanelClosed<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return !selectIsForumPanelOpen(global, tabId);
}

export function selectIsReactionPickerOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { reactionPicker } = selectTabState(global, tabId);
  return Boolean(reactionPicker?.position);
}

export function selectPerformanceSettings<T extends GlobalState>(global: T) {
  return global.settings.performance;
}

export function selectPerformanceSettingsValue<T extends GlobalState>(
  global: T,
  key: PerformanceTypeKey,
) {
  return global.settings.performance[key];
}

export function selectCanAutoPlayMedia<T extends GlobalState>(global: T, message: ApiMessage) {
  const video = getMessageVideo(message) || getMessageWebPageVideo(message);
  if (!video) {
    return undefined;
  }

  const canAutoPlayVideos = selectPerformanceSettingsValue(global, 'autoplayVideos');
  const canAutoPlayGifs = selectPerformanceSettingsValue(global, 'autoplayGifs');

  const asGif = video.isGif || video.isRound;

  return (canAutoPlayVideos && !asGif) || (canAutoPlayGifs && asGif);
}

export function selectShouldLoopStickers<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'loopAnimatedStickers');
}

export function selectCanPlayAnimatedEmojis<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'animatedEmoji');
}

export function selectCanAnimateInterface<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'pageTransitions');
}

export function selectIsContextMenuTranslucent<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'contextMenuBlur');
}
