import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, memo, useState, useRef, useLayoutEffect,
} from '../../lib/teact/teact';
import { addExtraClass } from '../../lib/teact/teact-dom';
import { requestNextMutation } from '../../lib/fasterdom/fasterdom';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { LangCode } from '../../types';
import type {
  ApiAttachBot,
  ApiChat,
  ApiChatFolder,
  ApiMessage,
  ApiUser,
} from '../../api/types';
import type { ApiLimitTypeWithModal, TabState } from '../../global/types';
import { ElectronEvent } from '../../types/electron';

import '../../global/actions/all';
import {
  BASE_EMOJI_KEYWORD_LANG, DEBUG, INACTIVE_MARKER, IS_ELECTRON,
} from '../../config';
import { IS_ANDROID } from '../../util/windowEnvironment';
import {
  selectChatMessage,
  selectTabState,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectIsForwardModalOpen,
  selectIsMediaViewerOpen,
  selectIsRightColumnShown,
  selectIsServiceChatReady,
  selectUser,
  selectIsReactionPickerOpen,
  selectPerformanceSettingsValue,
  selectCanAnimateInterface,
  selectChatFolder,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import { processDeepLink } from '../../util/deeplink';
import { parseInitialLocationHash, parseLocationHash } from '../../util/routing';
import { Bundles, loadBundle } from '../../util/moduleLoader';
import updateIcon from '../../util/updateIcon';

import useLastCallback from '../../hooks/useLastCallback';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useBackgroundMode from '../../hooks/useBackgroundMode';
import useBeforeUnload from '../../hooks/useBeforeUnload';
import useSyncEffect from '../../hooks/useSyncEffect';
import usePreventPinchZoomGesture from '../../hooks/usePreventPinchZoomGesture';
import useForceUpdate from '../../hooks/useForceUpdate';
import useShowTransition from '../../hooks/useShowTransition';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useInterval from '../../hooks/useInterval';
import { useFullscreenStatus } from '../../hooks/useFullscreen';
import useAppLayout from '../../hooks/useAppLayout';
import useTimeout from '../../hooks/useTimeout';
import useFlag from '../../hooks/useFlag';

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
import ReactionPicker from '../middle/message/ReactionPicker.async';
import ChatlistModal from '../modals/chatlist/ChatlistModal.async';

import './Main.scss';

export interface OwnProps {
  isMobile?: boolean;
}

type StateProps = {
  isMasterTab?: boolean;
  chat?: ApiChat;
  lastSyncTime?: number;
  isLeftColumnOpen: boolean;
  isMiddleColumnOpen: boolean;
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
  language?: LangCode;
  wasTimeFormatSetManually?: boolean;
  isPhoneCallActive?: boolean;
  addedSetIds?: string[];
  addedCustomEmojiIds?: string[];
  newContactUserId?: string;
  newContactByPhoneNumber?: boolean;
  openedGame?: TabState['openedGame'];
  gameTitle?: string;
  isRatePhoneCallModalOpen?: boolean;
  webApp?: TabState['webApp'];
  isPremiumModalOpen?: boolean;
  botTrustRequest?: TabState['botTrustRequest'];
  botTrustRequestBot?: ApiUser;
  attachBotToInstall?: ApiAttachBot;
  requestedAttachBotInChat?: TabState['requestedAttachBotInChat'];
  requestedDraft?: TabState['requestedDraft'];
  currentUser?: ApiUser;
  urlAuth?: TabState['urlAuth'];
  limitReached?: ApiLimitTypeWithModal;
  deleteFolderDialog?: ApiChatFolder;
  isPaymentModalOpen?: boolean;
  isReceiptModalOpen?: boolean;
  isReactionPickerOpen: boolean;
  isCurrentUserPremium?: boolean;
  chatlistModal?: TabState['chatlistModal'];
  noRightColumnAnimation?: boolean;
  withInterfaceAnimations?: boolean;
};

const APP_OUTDATED_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const CALL_BUNDLE_LOADING_DELAY_MS = 5000; // 5 sec
const REACTION_PICKER_LOADING_DELAY_MS = 7000; // 7 sec

// eslint-disable-next-line @typescript-eslint/naming-convention
let DEBUG_isLogged = false;

const Main: FC<OwnProps & StateProps> = ({
  lastSyncTime,
  isMobile,
  isLeftColumnOpen,
  isMiddleColumnOpen,
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
  withInterfaceAnimations,
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
  isReactionPickerOpen,
  isCurrentUserPremium,
  deleteFolderDialog,
  isMasterTab,
  chatlistModal,
  noRightColumnAnimation,
}) => {
  const {
    initMain,
    loadAnimatedEmojis,
    loadNotificationSettings,
    loadNotificationExceptions,
    updateIsOnline,
    onTabFocusChange,
    loadTopInlineBots,
    loadEmojiKeywords,
    loadCountryList,
    loadAvailableReactions,
    loadStickerSets,
    loadPremiumGifts,
    loadDefaultTopicIcons,
    loadAddedStickers,
    loadFavoriteStickers,
    loadDefaultStatusIcons,
    ensureTimeFormat,
    closeStickerSetModal,
    closeCustomEmojiSets,
    checkVersionNotification,
    loadConfig,
    loadAppConfig,
    loadAttachBots,
    loadContactList,
    loadCustomEmojis,
    loadGenericEmojiEffects,
    closePaymentModal,
    clearReceipt,
    checkAppVersion,
    openChat,
    toggleLeftColumn,
    loadRecentEmojiStatuses,
    updatePageTitle,
    loadTopReactions,
    loadRecentReactions,
    loadFeaturedEmojiStickers,
    setIsAppUpdateAvailable,
  } = getActions();

  if (DEBUG && !DEBUG_isLogged) {
    DEBUG_isLogged = true;
    // eslint-disable-next-line no-console
    console.log('>>> RENDER MAIN');
  }

  // Preload Calls bundle to initialize sounds for iOS
  useTimeout(() => {
    void loadBundle(Bundles.Calls);
  }, CALL_BUNDLE_LOADING_DELAY_MS);

  const [shouldLoadReactionPicker, markShouldLoadReactionPicker] = useFlag(false);
  useTimeout(markShouldLoadReactionPicker, REACTION_PICKER_LOADING_DELAY_MS);

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const leftColumnRef = useRef<HTMLDivElement>(null);

  const { isDesktop } = useAppLayout();
  useEffect(() => {
    if (!isLeftColumnOpen && !isMiddleColumnOpen && !isDesktop) {
      // Always display at least one column
      toggleLeftColumn();
    } else if (isLeftColumnOpen && isMiddleColumnOpen && isMobile) {
      // Can't have two active columns at the same time
      toggleLeftColumn();
    }
  }, [isDesktop, isLeftColumnOpen, isMiddleColumnOpen, isMobile, toggleLeftColumn]);

  useInterval(checkAppVersion, (isMasterTab && !IS_ELECTRON) ? APP_OUTDATED_TIMEOUT_MS : undefined, true);

  useEffect(() => {
    if (!IS_ELECTRON) {
      return undefined;
    }

    const removeUpdateDownloadedListener = window.electron?.on(ElectronEvent.UPDATE_DOWNLOADED, () => {
      setIsAppUpdateAvailable(true);
    });

    const removeUpdateErrorListener = window.electron?.on(ElectronEvent.UPDATE_ERROR, () => {
      setIsAppUpdateAvailable(false);
      removeUpdateDownloadedListener?.();
    });

    return () => {
      removeUpdateErrorListener?.();
      removeUpdateDownloadedListener?.();
    };
  }, []);

  // Initial API calls
  useEffect(() => {
    if (lastSyncTime && isMasterTab) {
      updateIsOnline(true);
      loadConfig();
      loadAppConfig();
      initMain();
      loadAvailableReactions();
      loadAnimatedEmojis();
      loadGenericEmojiEffects();
      loadNotificationSettings();
      loadNotificationExceptions();
      loadTopInlineBots();
      loadEmojiKeywords({ language: BASE_EMOJI_KEYWORD_LANG });
      loadAttachBots();
      loadContactList();
      loadPremiumGifts();
      loadDefaultTopicIcons();
      checkAppVersion();
      loadTopReactions();
      loadRecentReactions();
      loadFeaturedEmojiStickers();
    }
  }, [
    lastSyncTime, loadAnimatedEmojis, loadEmojiKeywords, loadNotificationExceptions, loadNotificationSettings,
    loadTopInlineBots, updateIsOnline, loadAvailableReactions, loadAppConfig, loadAttachBots, loadContactList,
    loadPremiumGifts, checkAppVersion, loadConfig, loadGenericEmojiEffects, loadDefaultTopicIcons, loadTopReactions,
    loadDefaultStatusIcons, loadRecentReactions, loadRecentEmojiStatuses, isCurrentUserPremium, isMasterTab, initMain,
  ]);

  // Initial Premium API calls
  useEffect(() => {
    if (lastSyncTime && isMasterTab && isCurrentUserPremium) {
      loadDefaultStatusIcons();
      loadRecentEmojiStatuses();
    }
  }, [isCurrentUserPremium, isMasterTab, lastSyncTime, loadDefaultStatusIcons, loadRecentEmojiStatuses]);

  // Language-based API calls
  useEffect(() => {
    if (lastSyncTime && isMasterTab) {
      if (language !== BASE_EMOJI_KEYWORD_LANG) {
        loadEmojiKeywords({ language: language! });
      }

      loadCountryList({ langCode: language });
    }
  }, [language, lastSyncTime, loadCountryList, loadEmojiKeywords, isMasterTab]);

  // Re-fetch cached saved emoji for `localDb`
  useEffectWithPrevDeps(([prevLastSyncTime]) => {
    if (!prevLastSyncTime && lastSyncTime && isMasterTab) {
      loadCustomEmojis({
        ids: Object.keys(getGlobal().customEmojis.byId),
        ignoreCache: true,
      });
    }
  }, [lastSyncTime, isMasterTab, loadCustomEmojis]);

  // Sticker sets
  useEffect(() => {
    if (lastSyncTime && isMasterTab) {
      if (!addedSetIds || !addedCustomEmojiIds) {
        loadStickerSets();
        loadFavoriteStickers();
      }

      if (addedSetIds && addedCustomEmojiIds) {
        loadAddedStickers();
      }
    }
  }, [
    lastSyncTime, addedSetIds, loadStickerSets, loadFavoriteStickers, loadAddedStickers, addedCustomEmojiIds,
    isMasterTab,
  ]);

  // Check version when service chat is ready
  useEffect(() => {
    if (lastSyncTime && isServiceChatReady && isMasterTab) {
      checkVersionNotification();
    }
  }, [lastSyncTime, isServiceChatReady, checkVersionNotification, isMasterTab]);

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
  }, [lastSyncTime, openChat]);

  // Restore Transition slide class after async rendering
  useLayoutEffect(() => {
    const container = containerRef.current!;
    if (container.parentNode!.childElementCount === 1) {
      addExtraClass(container, 'Transition_slide-active');
    }
  }, []);

  const leftColumnTransition = useShowTransition(
    isLeftColumnOpen, undefined, true, undefined, shouldSkipHistoryAnimations, undefined, true,
  );
  const willAnimateLeftColumnRef = useRef(false);
  const forceUpdate = useForceUpdate();

  // Handle opening middle column
  useSyncEffect(([prevIsLeftColumnOpen]) => {
    if (prevIsLeftColumnOpen === undefined || isLeftColumnOpen === prevIsLeftColumnOpen || !withInterfaceAnimations) {
      return;
    }

    willAnimateLeftColumnRef.current = true;

    if (IS_ANDROID) {
      requestNextMutation(() => {
        document.body.classList.toggle('android-left-blackout-open', !isLeftColumnOpen);
      });
    }

    const dispatchHeavyAnimationEnd = dispatchHeavyAnimationEvent();

    waitForTransitionEnd(document.getElementById('MiddleColumn')!, () => {
      dispatchHeavyAnimationEnd();
      willAnimateLeftColumnRef.current = false;
      forceUpdate();
    });
  }, [isLeftColumnOpen, withInterfaceAnimations, forceUpdate]);

  const rightColumnTransition = useShowTransition(
    isRightColumnOpen, undefined, true, undefined, shouldSkipHistoryAnimations, undefined, true,
  );
  const willAnimateRightColumnRef = useRef(false);
  const [isNarrowMessageList, setIsNarrowMessageList] = useState(isRightColumnOpen);

  const isFullscreen = useFullscreenStatus();

  // Handle opening right column
  useSyncEffect(([prevIsMiddleColumnOpen, prevIsRightColumnOpen]) => {
    if (prevIsRightColumnOpen === undefined || isRightColumnOpen === prevIsRightColumnOpen) {
      return;
    }

    if (!prevIsMiddleColumnOpen || noRightColumnAnimation) {
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
  }, [isMiddleColumnOpen, isRightColumnOpen, noRightColumnAnimation, forceUpdate]);

  const className = buildClassName(
    leftColumnTransition.hasShownClass && 'left-column-shown',
    leftColumnTransition.hasOpenClass && 'left-column-open',
    willAnimateLeftColumnRef.current && 'left-column-animating',
    rightColumnTransition.hasShownClass && 'right-column-shown',
    rightColumnTransition.hasOpenClass && 'right-column-open',
    willAnimateRightColumnRef.current && 'right-column-animating',
    isNarrowMessageList && 'narrow-message-list',
    shouldSkipHistoryAnimations && 'history-animation-disabled',
    isFullscreen && 'is-fullscreen',
  );

  const handleBlur = useLastCallback(() => {
    onTabFocusChange({ isBlurred: true });
  });

  const handleFocus = useLastCallback(() => {
    onTabFocusChange({ isBlurred: false });

    if (!document.title.includes(INACTIVE_MARKER)) {
      updatePageTitle();
    }

    updateIcon(false);
  });

  const handleStickerSetModalClose = useLastCallback(() => {
    closeStickerSetModal();
  });

  const handleCustomEmojiSetsModalClose = useLastCallback(() => {
    closeCustomEmojiSets();
  });

  // Online status and browser tab indicators
  useBackgroundMode(handleBlur, handleFocus);
  useBeforeUnload(handleBlur);
  usePreventPinchZoomGesture(isMediaViewerOpen);

  return (
    <div ref={containerRef} id="Main" className={className}>
      <LeftColumn ref={leftColumnRef} />
      <MiddleColumn leftColumnRef={leftColumnRef} isMobile={isMobile} />
      <RightColumn isMobile={isMobile} />
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
      <ChatlistModal info={chatlistModal} />
      <GameModal openedGame={openedGame} gameTitle={gameTitle} />
      <WebAppModal webApp={webApp} />
      <DownloadManager />
      <ConfettiContainer />
      <PhoneCall isActive={isPhoneCallActive} />
      <UnreadCount isForAppBadge />
      <RatePhoneCallModal isOpen={isRatePhoneCallModalOpen} />
      <BotTrustModal
        bot={botTrustRequestBot}
        type={botTrustRequest?.type}
        shouldRequestWriteAccess={botTrustRequest?.shouldRequestWriteAccess}
      />
      <AttachBotInstallModal bot={attachBotToInstall} />
      <AttachBotRecipientPicker requestedAttachBotInChat={requestedAttachBotInChat} />
      <MessageListHistoryHandler />
      {isPremiumModalOpen && <PremiumMainModal isOpen={isPremiumModalOpen} />}
      <PremiumLimitReachedModal limit={limitReached} />
      <PaymentModal isOpen={isPaymentModalOpen} onClose={closePaymentModal} />
      <ReceiptModal isOpen={isReceiptModalOpen} onClose={clearReceipt} />
      <DeleteFolderDialog folder={deleteFolderDialog} />
      <ReactionPicker isOpen={isReactionPickerOpen} shouldLoad={shouldLoadReactionPicker} />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isMobile }): StateProps => {
    const {
      settings: {
        byKey: {
          language, wasTimeFormatSetManually,
        },
      },
      lastSyncTime,
    } = global;

    const {
      botTrustRequest,
      requestedAttachBotInstall,
      requestedAttachBotInChat,
      requestedDraft,
      urlAuth,
      webApp,
      safeLinkModalUrl,
      openedStickerSetShortName,
      openedCustomEmojiSetIds,
      shouldSkipHistoryAnimations,
      openedGame,
      audioPlayer,
      isLeftColumnShown,
      historyCalendarSelectedAt,
      notifications,
      dialogs,
      newContact,
      ratingPhoneCall,
      premiumModal,
      isMasterTab,
      payment,
      limitReachedModal,
      deleteFolderDialogModal,
      chatlistModal,
    } = selectTabState(global);

    const { chatId: audioChatId, messageId: audioMessageId } = audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;
    const gameMessage = openedGame && selectChatMessage(global, openedGame.chatId, openedGame.messageId);
    const gameTitle = gameMessage?.content.game?.title;
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
    const { chatId } = selectCurrentMessageList(global) || {};
    const noRightColumnAnimation = !selectPerformanceSettingsValue(global, 'rightColumnAnimations')
        || !selectCanAnimateInterface(global);

    const deleteFolderDialog = deleteFolderDialogModal ? selectChatFolder(global, deleteFolderDialogModal) : undefined;

    return {
      lastSyncTime,
      isLeftColumnOpen: isLeftColumnShown,
      isMiddleColumnOpen: Boolean(chatId),
      isRightColumnOpen: selectIsRightColumnShown(global, isMobile),
      isMediaViewerOpen: selectIsMediaViewerOpen(global),
      isForwardModalOpen: selectIsForwardModalOpen(global),
      isReactionPickerOpen: selectIsReactionPickerOpen(global),
      hasNotifications: Boolean(notifications.length),
      hasDialogs: Boolean(dialogs.length),
      audioMessage,
      safeLinkModalUrl,
      isHistoryCalendarOpen: Boolean(historyCalendarSelectedAt),
      shouldSkipHistoryAnimations,
      openedStickerSetShortName,
      openedCustomEmojiSetIds,
      isServiceChatReady: selectIsServiceChatReady(global),
      activeGroupCallId: isMasterTab ? global.groupCalls.activeGroupCallId : undefined,
      withInterfaceAnimations: selectCanAnimateInterface(global),
      language,
      wasTimeFormatSetManually,
      isPhoneCallActive: isMasterTab ? Boolean(global.phoneCall) : undefined,
      addedSetIds: global.stickers.added.setIds,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      newContactUserId: newContact?.userId,
      newContactByPhoneNumber: newContact?.isByPhoneNumber,
      openedGame,
      gameTitle,
      isRatePhoneCallModalOpen: Boolean(ratingPhoneCall),
      botTrustRequest,
      botTrustRequestBot: botTrustRequest && selectUser(global, botTrustRequest.botId),
      attachBotToInstall: requestedAttachBotInstall?.bot,
      requestedAttachBotInChat,
      webApp,
      currentUser,
      urlAuth,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isPremiumModalOpen: premiumModal?.isOpen,
      limitReached: limitReachedModal?.limit,
      isPaymentModalOpen: payment.isPaymentModalOpen,
      isReceiptModalOpen: Boolean(payment.receipt),
      deleteFolderDialog,
      isMasterTab,
      requestedDraft,
      chatlistModal,
      noRightColumnAnimation,
    };
  },
)(Main));
