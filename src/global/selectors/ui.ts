import type { ApiMessage, ApiPeer, ApiSponsoredMessage } from '../../api/types';
import type { CustomPeer, PerformanceTypeKey, ThemeKey } from '../../types';
import type { GlobalState, TabArgs } from '../types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { IS_SNAP_EFFECT_SUPPORTED } from '../../util/browser/windowEnvironment';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { getMessageVideo, getWebPageVideo } from '../helpers/messageMedia';
import { selectCurrentManagement } from './management';
import { selectWebPageFromMessage } from './messages';
import { selectSharedSettings } from './sharedState';
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
  ) : tabState.chatInfo.isOpen && tabState.messageLists.length ? (
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
  return selectSharedSettings(global).theme;
}

export function selectThemeValues<T extends GlobalState>(global: T, themeKey: ThemeKey) {
  return global.settings.themes[themeKey];
}

export function selectActionMessageBg<T extends GlobalState>(global: T) {
  const theme = selectTheme(global);
  return global.settings.themes[theme]?.patternColor;
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
  return selectSharedSettings(global).performance;
}

export function selectPerformanceSettingsValue<T extends GlobalState>(
  global: T,
  key: PerformanceTypeKey,
) {
  return selectPerformanceSettings(global)[key];
}

export function selectCanAutoPlayMedia<T extends GlobalState>(global: T, message: ApiMessage | ApiSponsoredMessage) {
  const webPage = selectWebPageFromMessage(global, message);
  const video = getMessageVideo(message) || getWebPageVideo(webPage);
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

export function selectCanAnimateRightColumn<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'rightColumnAnimations');
}

export function selectCanAnimateSnapEffect<T extends GlobalState>(global: T) {
  return IS_SNAP_EFFECT_SUPPORTED && selectPerformanceSettingsValue(global, 'snapEffect');
}

export function selectIsContextMenuTranslucent<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'contextMenuBlur');
}

export function selectIsSynced<T extends GlobalState>(global: T) {
  return global.isSynced;
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

export function selectLeftColumnContentKey<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).leftColumn.contentKey;
}

export function selectSettingsScreen<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).leftColumn.settingsScreen;
}

export function selectPeerProfileColor<T extends GlobalState>(global: T, peer: ApiPeer | CustomPeer) {
  const isCustomPeer = 'isCustomPeer' in peer;
  const peerColorId = isCustomPeer ? peer.peerColorId : undefined;
  const profileColor = !isCustomPeer ? peer.profileColor : undefined;
  if (profileColor?.type === 'collectible') return undefined;

  const key = profileColor?.color ?? peerColorId;
  if (key === undefined) return undefined;
  return global.peerColors?.profile?.[key];
}
