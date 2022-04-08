import React, {
  FC, useEffect, memo, useCallback,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { LangCode } from '../../types';
import { ApiMessage, ApiUpdateAuthorizationStateType, ApiUpdateConnectionStateType } from '../../api/types';
import { GlobalState } from '../../global/types';

import '../../global/actions/all';
import {
  BASE_EMOJI_KEYWORD_LANG, DEBUG, INACTIVE_MARKER, PAGE_TITLE,
} from '../../config';
import {
  selectChatMessage,
  selectIsForwardModalOpen,
  selectIsMediaViewerOpen,
  selectIsRightColumnShown,
  selectIsServiceChatReady,
} from '../../global/selectors';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import buildClassName from '../../util/buildClassName';
import { fastRaf } from '../../util/schedulers';
import { waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import { processDeepLink } from '../../util/deeplink';
import stopEvent from '../../util/stopEvent';
import windowSize from '../../util/windowSize';
import { getAllNotificationsCount } from '../../util/folderManager';
import useShowTransition from '../../hooks/useShowTransition';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useBeforeUnload from '../../hooks/useBeforeUnload';
import useOnChange from '../../hooks/useOnChange';
import usePreventPinchZoomGesture from '../../hooks/usePreventPinchZoomGesture';
import { LOCATION_HASH } from '../../hooks/useHistoryBack';

import StickerSetModal from '../common/StickerSetModal.async';
import UnreadCount from '../common/UnreadCounter';
import LeftColumn from '../left/LeftColumn';
import MiddleColumn from '../middle/MiddleColumn';
import RightColumn from '../right/RightColumn';
import MediaViewer from '../mediaViewer/MediaViewer.async';
import AudioPlayer from '../middle/AudioPlayer';
import DownloadManager from './DownloadManager';
import GameModal from './GameModal';
import Notifications from './Notifications.async';
import Dialogs from './Dialogs.async';
import ForwardPicker from './ForwardPicker.async';
import SafeLinkModal from './SafeLinkModal.async';
import HistoryCalendar from './HistoryCalendar.async';
import GroupCall from '../calls/group/GroupCall.async';
import ActiveCallHeader from '../calls/ActiveCallHeader.async';
import CallFallbackConfirm from '../calls/CallFallbackConfirm.async';
import NewContactModal from './NewContactModal.async';

import './Main.scss';

type StateProps = {
  connectionState?: ApiUpdateConnectionStateType;
  authState?: ApiUpdateAuthorizationStateType;
  lastSyncTime?: number;
  isLeftColumnShown: boolean;
  isRightColumnShown: boolean;
  isMediaViewerOpen: boolean;
  isForwardModalOpen: boolean;
  hasNotifications: boolean;
  hasDialogs: boolean;
  audioMessage?: ApiMessage;
  safeLinkModalUrl?: string;
  isHistoryCalendarOpen: boolean;
  shouldSkipHistoryAnimations?: boolean;
  openedStickerSetShortName?: string;
  activeGroupCallId?: string;
  isServiceChatReady?: boolean;
  animationLevel: number;
  language?: LangCode;
  wasTimeFormatSetManually?: boolean;
  isCallFallbackConfirmOpen: boolean;
  addedSetIds?: string[];
  newContactUserId?: string;
  newContactByPhoneNumber?: boolean;
  openedGame?: GlobalState['openedGame'];
  gameTitle?: string;
};

const NOTIFICATION_INTERVAL = 1000;

let notificationInterval: number | undefined;

// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_isLogged = false;

const Main: FC<StateProps> = ({
  connectionState,
  authState,
  lastSyncTime,
  isLeftColumnShown,
  isRightColumnShown,
  isMediaViewerOpen,
  isForwardModalOpen,
  hasNotifications,
  hasDialogs,
  audioMessage,
  activeGroupCallId,
  safeLinkModalUrl,
  isHistoryCalendarOpen,
  shouldSkipHistoryAnimations,
  openedStickerSetShortName,
  isServiceChatReady,
  animationLevel,
  language,
  wasTimeFormatSetManually,
  isCallFallbackConfirmOpen,
  addedSetIds,
  newContactUserId,
  newContactByPhoneNumber,
  openedGame,
  gameTitle,
}) => {
  const {
    sync,
    loadAnimatedEmojis,
    loadNotificationSettings,
    loadNotificationExceptions,
    updateIsOnline,
    loadTopInlineBots,
    loadEmojiKeywords,
    loadCountryList,
    loadAvailableReactions,
    loadStickerSets,
    loadAddedStickers,
    loadFavoriteStickers,
    ensureTimeFormat,
    openStickerSetShortName,
    checkVersionNotification,
    loadAppConfig,
  } = getActions();

  if (DEBUG && !DEBUG_isLogged) {
    DEBUG_isLogged = true;
    // eslint-disable-next-line no-console
    console.log('>>> RENDER MAIN');
  }

  useEffect(() => {
    if (connectionState === 'connectionStateReady' && authState === 'authorizationStateReady') {
      sync();
    }
  }, [connectionState, authState, sync]);

  // Initial API calls
  useEffect(() => {
    if (lastSyncTime) {
      updateIsOnline(true);
      loadAppConfig();
      loadAvailableReactions();
      loadAnimatedEmojis();
      loadNotificationSettings();
      loadNotificationExceptions();
      loadTopInlineBots();
      loadEmojiKeywords({ language: BASE_EMOJI_KEYWORD_LANG });
    }
  }, [
    lastSyncTime, loadAnimatedEmojis, loadEmojiKeywords, loadNotificationExceptions, loadNotificationSettings,
    loadTopInlineBots, updateIsOnline, loadAvailableReactions, loadAppConfig,
  ]);

  // Language-based API calls
  useEffect(() => {
    if (lastSyncTime) {
      if (language !== BASE_EMOJI_KEYWORD_LANG) {
        loadEmojiKeywords({ language });
      }

      loadCountryList({ langCode: language });
    }
  }, [language, lastSyncTime, loadCountryList, loadEmojiKeywords]);

  // Sticker sets
  useEffect(() => {
    if (lastSyncTime) {
      if (!addedSetIds) {
        loadStickerSets();
        loadFavoriteStickers();
      } else {
        loadAddedStickers();
      }
    }
  }, [lastSyncTime, addedSetIds, loadStickerSets, loadFavoriteStickers, loadAddedStickers]);

  // Check version when service chat is ready
  useEffect(() => {
    if (lastSyncTime && isServiceChatReady) {
      checkVersionNotification();
    }
  }, [lastSyncTime, isServiceChatReady, checkVersionNotification]);

  // Ensure time format
  useEffect(() => {
    if (lastSyncTime && !wasTimeFormatSetManually) {
      ensureTimeFormat();
    }
  }, [lastSyncTime, wasTimeFormatSetManually, ensureTimeFormat]);

  // Parse deep link
  useEffect(() => {
    if (lastSyncTime && LOCATION_HASH.startsWith('#?tgaddr=')) {
      processDeepLink(decodeURIComponent(LOCATION_HASH.substr('#?tgaddr='.length)));
    }
  }, [lastSyncTime]);

  // Prevent refresh by accidentally rotating device when listening to a voice chat
  useEffect(() => {
    if (!activeGroupCallId) {
      return undefined;
    }

    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, [activeGroupCallId]);

  const {
    transitionClassNames: middleColumnTransitionClassNames,
  } = useShowTransition(!isLeftColumnShown, undefined, true, undefined, shouldSkipHistoryAnimations);

  const {
    transitionClassNames: rightColumnTransitionClassNames,
  } = useShowTransition(isRightColumnShown, undefined, true, undefined, shouldSkipHistoryAnimations);

  const className = buildClassName(
    middleColumnTransitionClassNames.replace(/([\w-]+)/g, 'middle-column-$1'),
    rightColumnTransitionClassNames.replace(/([\w-]+)/g, 'right-column-$1'),
    shouldSkipHistoryAnimations && 'history-animation-disabled',
  );

  // Dispatch heavy transition event when opening middle column
  useOnChange(([prevIsLeftColumnShown]) => {
    if (prevIsLeftColumnShown === undefined || animationLevel === 0) {
      return;
    }

    const dispatchHeavyAnimationEnd = dispatchHeavyAnimationEvent();

    waitForTransitionEnd(document.getElementById('MiddleColumn')!, dispatchHeavyAnimationEnd);
  }, [isLeftColumnShown]);

  // Dispatch heavy transition event and add body class when opening right column
  useOnChange(([prevIsRightColumnShown]) => {
    if (prevIsRightColumnShown === undefined || animationLevel === 0) {
      return;
    }

    fastRaf(() => {
      document.body.classList.add('animating-right-column');
    });

    const dispatchHeavyAnimationEnd = dispatchHeavyAnimationEvent();

    waitForTransitionEnd(document.getElementById('RightColumn')!, () => {
      dispatchHeavyAnimationEnd();

      fastRaf(() => {
        document.body.classList.remove('animating-right-column');
      });
    });
  }, [isRightColumnShown]);

  const handleBlur = useCallback(() => {
    updateIsOnline(false);

    const initialUnread = getAllNotificationsCount();
    let index = 0;

    clearInterval(notificationInterval);
    notificationInterval = window.setInterval(() => {
      if (document.title.includes(INACTIVE_MARKER)) {
        updateIcon(false);
        return;
      }

      if (index % 2 === 0) {
        const newUnread = getAllNotificationsCount() - initialUnread;
        if (newUnread > 0) {
          updatePageTitle(`${newUnread} notification${newUnread > 1 ? 's' : ''}`);
          updateIcon(true);
        }
      } else {
        updatePageTitle(PAGE_TITLE);
        updateIcon(false);
      }

      index++;
    }, NOTIFICATION_INTERVAL);
  }, [updateIsOnline]);

  const handleFocus = useCallback(() => {
    updateIsOnline(true);

    clearInterval(notificationInterval);
    notificationInterval = undefined;

    if (!document.title.includes(INACTIVE_MARKER)) {
      updatePageTitle(PAGE_TITLE);
    }

    updateIcon(false);
  }, [updateIsOnline]);

  const handleStickerSetModalClose = useCallback(() => {
    openStickerSetShortName({ stickerSetShortName: undefined });
  }, [openStickerSetShortName]);

  // Online status and browser tab indicators
  useBackgroundMode(handleBlur, handleFocus);
  useBeforeUnload(handleBlur);

  usePreventPinchZoomGesture(isMediaViewerOpen);

  return (
    <div id="Main" className={className} onDrop={stopEvent} onDragOver={stopEvent}>
      <LeftColumn />
      <MiddleColumn />
      <RightColumn />
      <MediaViewer isOpen={isMediaViewerOpen} />
      <ForwardPicker isOpen={isForwardModalOpen} />
      <Notifications isOpen={hasNotifications} />
      <Dialogs isOpen={hasDialogs} />
      {audioMessage && <AudioPlayer key={audioMessage.id} message={audioMessage} noUi />}
      <SafeLinkModal url={safeLinkModalUrl} />
      <HistoryCalendar isOpen={isHistoryCalendarOpen} />
      <StickerSetModal
        isOpen={Boolean(openedStickerSetShortName)}
        onClose={handleStickerSetModalClose}
        stickerSetShortName={openedStickerSetShortName}
      />
      {activeGroupCallId && (
        <>
          <GroupCall groupCallId={activeGroupCallId} />
          <ActiveCallHeader groupCallId={activeGroupCallId} />
        </>
      )}
      <NewContactModal
        isOpen={Boolean(newContactUserId || newContactByPhoneNumber)}
        userId={newContactUserId}
        isByPhoneNumber={newContactByPhoneNumber}
      />
      <GameModal openedGame={openedGame} gameTitle={gameTitle} />
      <DownloadManager />
      <CallFallbackConfirm isOpen={isCallFallbackConfirmOpen} />
      <UnreadCount isForAppBadge />
    </div>
  );
};

function updateIcon(asUnread: boolean) {
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="alternate icon"]')
    .forEach((link) => {
      if (asUnread) {
        if (!link.href.includes('favicon-unread')) {
          link.href = link.href.replace('favicon', 'favicon-unread');
        }
      } else {
        link.href = link.href.replace('favicon-unread', 'favicon');
      }
    });
}

// For some reason setting `document.title` to the same value
// causes increment of Chrome Dev Tools > Performance Monitor > DOM Nodes counter
function updatePageTitle(nextTitle: string) {
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
}

export default memo(withGlobal(
  (global): StateProps => {
    const { settings: { byKey: { animationLevel, language, wasTimeFormatSetManually } } } = global;
    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;
    const openedGame = global.openedGame;
    const gameMessage = openedGame && selectChatMessage(global, openedGame.chatId, openedGame.messageId);
    const gameTitle = gameMessage?.content.game?.title;

    return {
      connectionState: global.connectionState,
      authState: global.authState,
      lastSyncTime: global.lastSyncTime,
      isLeftColumnShown: global.isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global),
      isMediaViewerOpen: selectIsMediaViewerOpen(global),
      isForwardModalOpen: selectIsForwardModalOpen(global),
      hasNotifications: Boolean(global.notifications.length),
      hasDialogs: Boolean(global.dialogs.length),
      audioMessage,
      safeLinkModalUrl: global.safeLinkModalUrl,
      isHistoryCalendarOpen: Boolean(global.historyCalendarSelectedAt),
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
      openedStickerSetShortName: global.openedStickerSetShortName,
      isServiceChatReady: selectIsServiceChatReady(global),
      activeGroupCallId: global.groupCalls.activeGroupCallId,
      animationLevel,
      language,
      wasTimeFormatSetManually,
      isCallFallbackConfirmOpen: Boolean(global.groupCalls.isFallbackConfirmOpen),
      addedSetIds: global.stickers.added.setIds,
      newContactUserId: global.newContact?.userId,
      newContactByPhoneNumber: global.newContact?.isByPhoneNumber,
      openedGame,
      gameTitle,
    };
  },
)(Main));
