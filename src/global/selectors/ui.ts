import type { ApiMessage, ApiPeer, ApiSponsoredMessage, ApiWallpaper } from '../../api/types';
import type { CustomPeer, IThemeSettings, PerformanceTypeKey, ThemeKey } from '../../types';
import type { GlobalState, TabArgs } from '../types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import memoized from '../../util/memoized';
import { buildThemePalette } from '../../util/theme';
import {
  buildThemeSettingsFromWallpaper, getActionMessageBg, getChatThemeEntry, getThemeWallpaper,
} from '../../util/wallpaper';
import { selectTabBrowserState } from '../helpers/browser';
import { getMessageVideo, getWebPageVideo } from '../helpers/messageMedia';
import { selectPeerFullInfo } from './chats';
import { selectCurrentManagement } from './management';
import { selectWebPageFromMessage } from './messages';
import { selectSharedSettings } from './sharedState';
import { selectIsStatisticsShown } from './statistics';
import { selectTabState } from './tabs';

const getActionMessageBgMemo = memoized(getActionMessageBg);
const WALLPAPER_SETTINGS = new WeakMap<ApiWallpaper, IThemeSettings>();
const GLOBAL_WALLPAPER_SETTINGS = new WeakMap<IThemeSettings, IThemeSettings>();

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
      pageMedia,
      isSponsoredMessage,
    },
  } = selectTabState(global, tabId);
  return Boolean(pageMedia || standaloneMedia || (chatId && (isAvatarView || messageId || isSponsoredMessage)));
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
  return selectSharedSettings(global).themes[themeKey];
}

export function selectActionMessageBg<T extends GlobalState>(
  global: T,
  chatId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return getActionMessageBgMemo(
    selectTheme(global),
    selectChatThemePalette(global, chatId, tabId),
    selectChatWallpaperSettings(global, chatId, tabId),
  );
}

export function selectChatThemeSettings<T extends GlobalState>(
  global: T,
  chatId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const theme = selectTheme(global);
  if (chatId && chatId !== global.currentUserId && chatId !== selectTabState(global, tabId).globalThemePreviewChatId) {
    const peerTheme = selectPeerFullInfo(global, chatId)?.peerTheme;
    const settings = peerTheme?.type === 'gift' ? peerTheme.settings
      : peerTheme && global.settings.chatThemes?.find((entry) => entry.emoticon === peerTheme.emoticon)?.settings;
    const peerSettings = settings && getChatThemeEntry(settings, theme === 'dark');
    if (peerSettings) return peerSettings;
  }
  return selectThemeValues(global, theme)?.serverThemeSettings;
}

export function selectChatThemePalette<T extends GlobalState>(
  global: T,
  chatId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return buildThemePalette(selectTheme(global), selectChatThemeSettings(global, chatId, tabId));
}

export function selectPeerWallpaper<T extends GlobalState>(
  global: T,
  chatId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (!chatId || chatId === global.currentUserId || chatId === selectTabState(global, tabId).globalThemePreviewChatId) {
    return undefined;
  }
  return selectPeerFullInfo(global, chatId)?.wallpaper;
}

export function selectChatWallpaper<T extends GlobalState>(
  global: T,
  chatId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (chatId && chatId !== global.currentUserId && chatId !== selectTabState(global, tabId).globalThemePreviewChatId) {
    const fullInfo = selectPeerFullInfo(global, chatId);
    const peerWallpaper = selectPeerWallpaper(global, chatId, tabId);
    if (peerWallpaper) return peerWallpaper;
    const peerTheme = fullInfo?.peerTheme;
    const settings = peerTheme?.type === 'gift' ? peerTheme.settings
      : peerTheme && global.settings.chatThemes?.find((entry) => entry.emoticon === peerTheme.emoticon)?.settings;
    const wallpaper = settings && getChatThemeEntry(settings, selectTheme(global) === 'dark')?.wallpaper;
    if (wallpaper) return wallpaper;
  }
  return getThemeWallpaper(selectThemeValues(global, selectTheme(global)));
}

export function selectChatWallpaperSettings<T extends GlobalState>(
  global: T,
  chatId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const globalSettings = selectThemeValues(global, selectTheme(global));
  const wallpaper = selectChatWallpaper(global, chatId, tabId);
  if (!wallpaper) return globalSettings;
  if (globalSettings && wallpaper === selectChatWallpaper(global, undefined, tabId)) {
    const cached = GLOBAL_WALLPAPER_SETTINGS.get(globalSettings);
    if (cached) return cached;
    const settings = {
      ...buildThemeSettingsFromWallpaper(wallpaper),
      patternIntensityFactor: globalSettings.patternIntensityFactor,
      isBlurred: globalSettings.isBlurred ?? wallpaper.settings?.isBlurred,
    };
    GLOBAL_WALLPAPER_SETTINGS.set(globalSettings, settings);
    return settings;
  }
  const cached = WALLPAPER_SETTINGS.get(wallpaper);
  if (cached) return cached;
  const settings = buildThemeSettingsFromWallpaper(wallpaper);
  WALLPAPER_SETTINGS.set(wallpaper, settings);
  return settings;
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

export function selectCommunityPanelId<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).communityPanelId;
}

export function selectIsChatListPanelOpen<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectIsForumPanelOpen(global, tabId) || Boolean(selectCommunityPanelId(global, tabId));
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

export function selectIsContextMenuTranslucent<T extends GlobalState>(global: T) {
  return selectPerformanceSettingsValue(global, 'contextMenuBlur');
}

export function selectIsSynced<T extends GlobalState>(global: T) {
  return global.isSynced;
}

export function selectWebApp<T extends GlobalState>(
  global: T, key: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tab = selectTabBrowserState(selectTabState(global, tabId)).openedTabs[key];
  return tab?.type === 'webApp' ? tab.webApp : undefined;
}

export function selectActiveWebApp<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const { activeTabKey } = selectTabBrowserState(selectTabState(global, tabId));
  if (!activeTabKey) return undefined;

  return selectWebApp(global, activeTabKey, tabId);
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

export function selectTabSelectedAuctionGiftId<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  const selectedGift = tabState.giftModal?.selectedGift;

  const giftModalAuctionGiftId = selectedGift && 'id' in selectedGift &&
    selectedGift.type === 'starGift' && selectedGift.isAuction ? selectedGift.id : undefined;

  return tabState.giftAuctionModal?.auctionGiftId
    || tabState.giftAuctionBidModal?.auctionGiftId
    || tabState.giftAuctionInfoModal?.auctionGiftId
    || giftModalAuctionGiftId;
}

export function selectTabSelectedGiftAuction<T extends GlobalState>(
  global: T, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const giftId = selectTabSelectedAuctionGiftId(global, tabId);
  return giftId ? global.giftAuctionByGiftId?.[giftId] : undefined;
}

export function selectHasAnySelectedAuction<T extends GlobalState>(global: T, giftId: string) {
  return Object.keys(global.byTabId).some((tabId) => {
    return selectTabSelectedAuctionGiftId(global, Number(tabId)) === giftId;
  });
}

export function selectShouldRemoveGiftAuction<T extends GlobalState>(global: T, giftId: string) {
  return !selectHasAnySelectedAuction(global, giftId);
}
