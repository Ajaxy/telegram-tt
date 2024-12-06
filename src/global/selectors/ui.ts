import type { ApiMessage, ApiSponsoredMessage } from '../../api/types';
import type { PerformanceTypeKey } from '../../types';
import type { GlobalState, TabArgs } from '../types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { IS_SNAP_EFFECT_SUPPORTED } from '../../util/windowEnvironment';
import { getMessageVideo, getMessageWebPageVideo } from '../helpers/messageMedia';
import { selectCurrentManagement } from './management';
import { selectIsStatisticsShown } from './statistics';
import { selectTabState } from './tabs';

export function selectIsMediaViewerOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const {
    mediaViewer: {
      chatId,
      messageId,
      isAvatarView,
      standaloneMedia,
      isSponsoredMessage,
    },
  } = selectTabState(global, tabId);
  return Boolean(standaloneMedia || (chatId && (isAvatarView || messageId || isSponsoredMessage)));
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
  ) : tabState.monetizationStatistics ? (
    RightColumnContent.MonetizationStatistics
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

export function selectCanAutoPlayMedia<T extends GlobalState>(global: T, message: ApiMessage | ApiSponsoredMessage) {
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

export function selectIsSynced<T extends GlobalState>(global: T) {
  return global.isSynced;
}

export function selectCanAnimateSnapEffect<T extends GlobalState>(global: T) {
  return IS_SNAP_EFFECT_SUPPORTED && selectPerformanceSettingsValue(global, 'snapEffect');
}

export function selectWebApp<T extends GlobalState>(
  global: T, key: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).webApps.openedWebApps[key];
}

export function selectActiveWebApp<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const activeWebAppKey = selectTabState(global, tabId).webApps.activeWebAppKey;
  if (!activeWebAppKey) return undefined;

  return selectWebApp(global, activeWebAppKey, tabId);
}
