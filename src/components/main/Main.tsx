import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, memo, useCallback, useState, useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { AnimationLevel, LangCode } from '../../types';
import type {
  ApiChat, ApiMessage, ApiUser,
} from '../../api/types';
import type { ApiLimitTypeWithModal, GlobalState } from '../../global/types';

import '../../global/actions/all';
import {
  BASE_EMOJI_KEYWORD_LANG, DEBUG, INACTIVE_MARKER, PAGE_TITLE,
} from '../../config';
import { IS_ANDROID } from '../../util/environment';
import {
  selectChatMessage,
  selectIsForwardModalOpen,
  selectIsMediaViewerOpen,
  selectIsRightColumnShown,
  selectIsServiceChatReady,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import { processDeepLink } from '../../util/deeplink';
import windowSize from '../../util/windowSize';
import { getAllNotificationsCount } from '../../util/folderManager';
import { fastRaf } from '../../util/schedulers';

import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useBeforeUnload from '../../hooks/useBeforeUnload';
import useOnChange from '../../hooks/useOnChange';
import usePreventPinchZoomGesture from '../../hooks/usePreventPinchZoomGesture';
import useForceUpdate from '../../hooks/useForceUpdate';
import useShowTransition from '../../hooks/useShowTransition';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useInterval from '../../hooks/useInterval';
import { parseInitialLocationHash, parseLocationHash } from '../../util/routing';

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
import ForwardRecipientPicker from './ForwardRecipientPicker.async';
import SafeLinkModal from './SafeLinkModal.async';
import HistoryCalendar from './HistoryCalendar.async';
import GroupCall from '../calls/group/GroupCall.async';
import ActiveCallHeader from '../calls/ActiveCallHeader.async';
import PhoneCall from '../calls/phone/PhoneCall.async';
import MessageListHistoryHandler from '../middle/MessageListHistoryHandler';
import NewContactModal from './NewContactModal.async';
import RatePhoneCallModal from '../calls/phone/RatePhoneCallModal.async';
import WebAppModal from './WebAppModal.async';
import BotTrustModal from './BotTrustModal.async';
import AttachBotInstallModal from './AttachBotInstallModal.async';
import ConfettiContainer from './ConfettiContainer';
import UrlAuthModal from './UrlAuthModal.async';
import PremiumMainModal from './premium/PremiumMainModal.async';
import PaymentModal from '../payment/PaymentModal.async';
import ReceiptModal from '../payment/ReceiptModal.async';
import PremiumLimitReachedModal from './premium/common/PremiumLimitReachedModal.async';
import DeleteFolderDialog from './DeleteFolderDialog.async';
import CustomEmojiSetsModal from '../common/CustomEmojiSetsModal.async';
import DraftRecipientPicker from './DraftRecipientPicker.async';
import AttachBotRecipientPicker from './AttachBotRecipientPicker.async';

import './Main.scss';

type StateProps = {
  chat?: ApiChat;
  lastSyncTime?: number;
  isLeftColumnOpen: boolean;
  isRightColumnOpen: boolean;
  isMediaViewerOpen: boolean;
  isForwardModalOpen: boolean;
  hasNotifications: boolean;
  hasDialogs: boolean;
  audioMessage?: ApiMessage;
  safeLinkModalUrl?: string;
  isHistoryCalendarOpen: boolean;
  shouldSkipHistoryAnimations?: boolean;
  openedStickerSetShortName?: string;
  openedCustomEmojiSetIds?: string[];
  activeGroupCallId?: string;
  isServiceChatReady?: boolean;
  animationLevel: AnimationLevel;
  language?: LangCode;
  wasTimeFormatSetManually?: boolean;
  isPhoneCallActive?: boolean;
  addedSetIds?: string[];
  addedCustomEmojiIds?: string[];
  newContactUserId?: string;
  newContactByPhoneNumber?: boolean;
  openedGame?: GlobalState['openedGame'];
  gameTitle?: string;
  isRatePhoneCallModalOpen?: boolean;
  webApp?: GlobalState['webApp'];
  isPremiumModalOpen?: boolean;
  botTrustRequest?: GlobalState['botTrustRequest'];
  botTrustRequestBot?: ApiUser;
  attachBotToInstall?: ApiUser;
  requestedAttachBotInChat?: GlobalState['requestedAttachBotInChat'];
  requestedDraft?: GlobalState['requestedDraft'];
  currentUser?: ApiUser;
  urlAuth?: GlobalState['urlAuth'];
  limitReached?: ApiLimitTypeWithModal;
  deleteFolderDialogId?: number;
  isPaymentModalOpen?: boolean;
  isReceiptModalOpen?: boolean;
};

const NOTIFICATION_INTERVAL = 1000;
const APP_OUTDATED_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

let notificationInterval: number | undefined;

// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_isLogged = false;

const Main: FC<StateProps> = ({
  lastSyncTime,
  isLeftColumnOpen,
  isRightColumnOpen,
  isMediaViewerOpen,
  isForwardModalOpen,
  hasNotifications,
  hasDialogs,
  audioMessage,
  activeGroupCallId,
  safeLinkModalUrl,
  isHistoryCalendarOpen,
  shouldSkipHistoryAnimations,
  limitReached,
  openedStickerSetShortName,
  openedCustomEmojiSetIds,
  isServiceChatReady,
  animationLevel,
  language,
  wasTimeFormatSetManually,
  addedSetIds,
  addedCustomEmojiIds,
  isPhoneCallActive,
  newContactUserId,
  newContactByPhoneNumber,
  openedGame,
  gameTitle,
  isRatePhoneCallModalOpen,
  botTrustRequest,
  botTrustRequestBot,
  attachBotToInstall,
  requestedAttachBotInChat,
  requestedDraft,
  webApp,
  currentUser,
  urlAuth,
  isPremiumModalOpen,
  isPaymentModalOpen,
  isReceiptModalOpen,
  deleteFolderDialogId,
}) => {
  const {
    loadAnimatedEmojis,
    loadNotificationSettings,
    loadNotificationExceptions,
    updateIsOnline,
    loadTopInlineBots,
    loadEmojiKeywords,
    loadCountryList,
    loadAvailableReactions,
    loadStickerSets,
    loadPremiumGifts,
    loadAddedStickers,
    loadFavoriteStickers,
    ensureTimeFormat,
    closeStickerSetModal,
    closeCustomEmojiSets,
    checkVersionNotification,
    loadAppConfig,
    loadAttachBots,
    loadContactList,
    loadCustomEmojis,
    closePaymentModal,
    clearReceipt,
    checkAppVersion,
    openChat,
  } = getActions();

  if (DEBUG && !DEBUG_isLogged) {
    DEBUG_isLogged = true;
    // eslint-disable-next-line no-console
    console.log('>>> RENDER MAIN');
  }

  useInterval(checkAppVersion, APP_OUTDATED_TIMEOUT_MS, true);

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
      loadAttachBots();
      loadContactList();
      loadPremiumGifts();
      checkAppVersion();
    }
  }, [
    lastSyncTime, loadAnimatedEmojis, loadEmojiKeywords, loadNotificationExceptions, loadNotificationSettings,
    loadTopInlineBots, updateIsOnline, loadAvailableReactions, loadAppConfig, loadAttachBots, loadContactList,
    loadPremiumGifts, checkAppVersion,
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

  // Re-fetch cached saved emoji for `localDb`
  useEffectWithPrevDeps(([prevLastSyncTime]) => {
    if (!prevLastSyncTime && lastSyncTime) {
      loadCustomEmojis({
        ids: Object.keys(getGlobal().customEmojis.byId),
        ignoreCache: true,
      });
    }
  }, [lastSyncTime] as const);

  // Sticker sets
  useEffect(() => {
    if (lastSyncTime) {
      if (!addedSetIds || !addedCustomEmojiIds) {
        loadStickerSets();
        loadFavoriteStickers();
      }

      if (addedSetIds && addedCustomEmojiIds) {
        loadAddedStickers();
      }
    }
  }, [lastSyncTime, addedSetIds, loadStickerSets, loadFavoriteStickers, loadAddedStickers, addedCustomEmojiIds]);

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
    const parsedInitialLocationHash = parseInitialLocationHash();
    if (lastSyncTime && parsedInitialLocationHash?.tgaddr) {
      processDeepLink(decodeURIComponent(parsedInitialLocationHash.tgaddr));
    }
  }, [lastSyncTime]);

  useEffectWithPrevDeps(([prevLastSyncTime]) => {
    const parsedLocationHash = parseLocationHash();
    if (!parsedLocationHash) return;

    if (!prevLastSyncTime && lastSyncTime) {
      openChat({
        id: parsedLocationHash.chatId,
        threadId: parsedLocationHash.threadId,
        type: parsedLocationHash.type,
      });
    }
  }, [lastSyncTime] as const);

  // Prevent refresh by accidentally rotating device when listening to a voice chat
  useEffect(() => {
    if (!activeGroupCallId && !isPhoneCallActive) {
      return undefined;
    }

    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, [activeGroupCallId, isPhoneCallActive]);

  const leftColumnTransition = useShowTransition(
    isLeftColumnOpen, undefined, true, undefined, shouldSkipHistoryAnimations,
  );
  const willAnimateLeftColumnRef = useRef(false);
  const forceUpdate = useForceUpdate();

  // Handle opening middle column
  useOnChange(([prevIsLeftColumnOpen]) => {
    if (prevIsLeftColumnOpen === undefined || animationLevel === 0) {
      return;
    }

    willAnimateLeftColumnRef.current = true;

    if (IS_ANDROID) {
      fastRaf(() => {
        document.body.classList.toggle('android-left-blackout-open', !isLeftColumnOpen);
      });
    }

    const dispatchHeavyAnimationEnd = dispatchHeavyAnimationEvent();

    waitForTransitionEnd(document.getElementById('MiddleColumn')!, () => {
      dispatchHeavyAnimationEnd();
      willAnimateLeftColumnRef.current = false;
      forceUpdate();
    });
  }, [isLeftColumnOpen]);

  const rightColumnTransition = useShowTransition(
    isRightColumnOpen, undefined, true, undefined, shouldSkipHistoryAnimations,
  );
  const willAnimateRightColumnRef = useRef(false);
  const [isNarrowMessageList, setIsNarrowMessageList] = useState(isRightColumnOpen);

  // Handle opening right column
  useOnChange(([prevIsRightColumnOpen]) => {
    if (prevIsRightColumnOpen === undefined) {
      return;
    }

    if (animationLevel === 0) {
      setIsNarrowMessageList(isRightColumnOpen);
      return;
    }

    willAnimateRightColumnRef.current = true;

    const dispatchHeavyAnimationEnd = dispatchHeavyAnimationEvent();

    waitForTransitionEnd(document.getElementById('RightColumn')!, () => {
      dispatchHeavyAnimationEnd();
      willAnimateRightColumnRef.current = false;
      forceUpdate();
      setIsNarrowMessageList(isRightColumnOpen);
    });
  }, [isRightColumnOpen]);

  const className = buildClassName(
    leftColumnTransition.hasShownClass && 'left-column-shown',
    leftColumnTransition.hasOpenClass && 'left-column-open',
    willAnimateLeftColumnRef.current && 'left-column-animating',
    rightColumnTransition.hasShownClass && 'right-column-shown',
    rightColumnTransition.hasOpenClass && 'right-column-open',
    willAnimateRightColumnRef.current && 'right-column-animating',
    isNarrowMessageList && 'narrow-message-list',
    shouldSkipHistoryAnimations && 'history-animation-disabled',
  );

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
    closeStickerSetModal();
  }, [closeStickerSetModal]);

  const handleCustomEmojiSetsModalClose = useCallback(() => {
    closeCustomEmojiSets();
  }, [closeCustomEmojiSets]);

  // Online status and browser tab indicators
  useBackgroundMode(handleBlur, handleFocus);
  useBeforeUnload(handleBlur);
  usePreventPinchZoomGesture(isMediaViewerOpen);

  return (
    <div id="Main" className={className}>
      <LeftColumn />
      <MiddleColumn />
      <RightColumn />
      <MediaViewer isOpen={isMediaViewerOpen} />
      <ForwardRecipientPicker isOpen={isForwardModalOpen} />
      <DraftRecipientPicker requestedDraft={requestedDraft} />
      <Notifications isOpen={hasNotifications} />
      <Dialogs isOpen={hasDialogs} />
      {audioMessage && <AudioPlayer key={audioMessage.id} message={audioMessage} noUi />}
      <SafeLinkModal url={safeLinkModalUrl} />
      <UrlAuthModal urlAuth={urlAuth} currentUser={currentUser} />
      <HistoryCalendar isOpen={isHistoryCalendarOpen} />
      <StickerSetModal
        isOpen={Boolean(openedStickerSetShortName)}
        onClose={handleStickerSetModalClose}
        stickerSetShortName={openedStickerSetShortName}
      />
      <CustomEmojiSetsModal
        customEmojiSetIds={openedCustomEmojiSetIds}
        onClose={handleCustomEmojiSetsModalClose}
      />
      {activeGroupCallId && <GroupCall groupCallId={activeGroupCallId} />}
      <ActiveCallHeader isActive={Boolean(activeGroupCallId || isPhoneCallActive)} />
      <NewContactModal
        isOpen={Boolean(newContactUserId || newContactByPhoneNumber)}
        userId={newContactUserId}
        isByPhoneNumber={newContactByPhoneNumber}
      />
      <GameModal openedGame={openedGame} gameTitle={gameTitle} />
      <WebAppModal webApp={webApp} />
      <DownloadManager />
      <ConfettiContainer />
      <PhoneCall isActive={isPhoneCallActive} />
      <UnreadCount isForAppBadge />
      <RatePhoneCallModal isOpen={isRatePhoneCallModalOpen} />
      <BotTrustModal bot={botTrustRequestBot} type={botTrustRequest?.type} />
      <AttachBotInstallModal bot={attachBotToInstall} />
      <AttachBotRecipientPicker requestedAttachBotInChat={requestedAttachBotInChat} />
      <MessageListHistoryHandler />
      {isPremiumModalOpen && <PremiumMainModal isOpen={isPremiumModalOpen} />}
      <PremiumLimitReachedModal limit={limitReached} />
      <PaymentModal isOpen={isPaymentModalOpen} onClose={closePaymentModal} />
      <ReceiptModal isOpen={isReceiptModalOpen} onClose={clearReceipt} />
      <DeleteFolderDialog deleteFolderDialogId={deleteFolderDialogId} />
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
    const {
      settings: {
        byKey: {
          animationLevel, language, wasTimeFormatSetManually,
        },
      },
      botTrustRequest,
      requestedAttachBotInstall,
      requestedAttachBotInChat,
      requestedDraft,
      urlAuth,
      webApp,
      safeLinkModalUrl,
      lastSyncTime,
      openedStickerSetShortName,
      openedCustomEmojiSetIds,
      shouldSkipHistoryAnimations,
    } = global;
    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;
    const openedGame = global.openedGame;
    const gameMessage = openedGame && selectChatMessage(global, openedGame.chatId, openedGame.messageId);
    const gameTitle = gameMessage?.content.game?.title;
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;

    return {
      lastSyncTime,
      isLeftColumnOpen: global.isLeftColumnShown,
      isRightColumnOpen: selectIsRightColumnShown(global),
      isMediaViewerOpen: selectIsMediaViewerOpen(global),
      isForwardModalOpen: selectIsForwardModalOpen(global),
      hasNotifications: Boolean(global.notifications.length),
      hasDialogs: Boolean(global.dialogs.length),
      audioMessage,
      safeLinkModalUrl,
      isHistoryCalendarOpen: Boolean(global.historyCalendarSelectedAt),
      shouldSkipHistoryAnimations,
      openedStickerSetShortName,
      openedCustomEmojiSetIds,
      isServiceChatReady: selectIsServiceChatReady(global),
      activeGroupCallId: global.groupCalls.activeGroupCallId,
      animationLevel,
      language,
      wasTimeFormatSetManually,
      isPhoneCallActive: Boolean(global.phoneCall),
      addedSetIds: global.stickers.added.setIds,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      newContactUserId: global.newContact?.userId,
      newContactByPhoneNumber: global.newContact?.isByPhoneNumber,
      openedGame,
      gameTitle,
      isRatePhoneCallModalOpen: Boolean(global.ratingPhoneCall),
      botTrustRequest,
      botTrustRequestBot: botTrustRequest && selectUser(global, botTrustRequest.botId),
      attachBotToInstall: requestedAttachBotInstall && selectUser(global, requestedAttachBotInstall.botId),
      requestedAttachBotInChat,
      webApp,
      currentUser,
      urlAuth,
      isPremiumModalOpen: global.premiumModal?.isOpen,
      limitReached: global.limitReachedModal?.limit,
      isPaymentModalOpen: global.payment.isPaymentModalOpen,
      isReceiptModalOpen: Boolean(global.payment.receipt),
      deleteFolderDialogId: global.deleteFolderDialogModal,
      requestedDraft,
    };
  },
)(Main));
