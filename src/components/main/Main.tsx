import '../../global/actions/all';

import {
  beginHeavyAnimation,
  memo, useEffect, useLayoutEffect,
  useRef, useState,
} from '../../lib/teact/teact';
import { addExtraClass } from '../../lib/teact/teact-dom';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder, ApiLimitTypeWithModal, ApiUser } from '../../api/types';
import type { TabState } from '../../global/types';

import { BASE_EMOJI_KEYWORD_LANG, DEBUG, INACTIVE_MARKER } from '../../config';
import { requestNextMutation } from '../../lib/fasterdom/fasterdom';
import {
  selectCanAnimateInterface,
  selectChatFolder,
  selectChatMessage,
  selectCurrentMessageList,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsForwardModalOpen,
  selectIsMediaViewerOpen,
  selectIsReactionPickerOpen,
  selectIsRightColumnShown,
  selectIsServiceChatReady,
  selectIsStoryViewerOpen,
  selectPerformanceSettingsValue,
  selectTabState,
  selectUser,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_ANDROID, IS_WAVE_TRANSFORM_SUPPORTED } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import { processDeepLink } from '../../util/deeplink';
import { Bundles, loadBundle } from '../../util/moduleLoader';
import { parseInitialLocationHash, parseLocationHash } from '../../util/routing';
import updateIcon from '../../util/updateIcon';

import useInterval from '../../hooks/schedulers/useInterval';
import useTimeout from '../../hooks/schedulers/useTimeout';
import useTauriEvent from '../../hooks/tauri/useTauriEvent';
import useAppLayout from '../../hooks/useAppLayout';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePreventPinchZoomGesture from '../../hooks/usePreventPinchZoomGesture';
import useShowTransition from '../../hooks/useShowTransition';
import useSyncEffect from '../../hooks/useSyncEffect';
import useBackgroundMode from '../../hooks/window/useBackgroundMode';
import useBeforeUnload from '../../hooks/window/useBeforeUnload';
import { useFullscreenStatus } from '../../hooks/window/useFullscreen';

import ActiveCallHeader from '../calls/ActiveCallHeader.async';
import GroupCall from '../calls/group/GroupCall.async';
import PhoneCall from '../calls/phone/PhoneCall.async';
import RatePhoneCallModal from '../calls/phone/RatePhoneCallModal.async';
import CustomEmojiSetsModal from '../common/CustomEmojiSetsModal.async';
import DeleteMessageModal from '../common/DeleteMessageModal.async';
import StickerSetModal from '../common/StickerSetModal.async';
import UnreadCount from '../common/UnreadCounter';
import LeftColumn from '../left/LeftColumn';
import MediaViewer from '../mediaViewer/MediaViewer.async';
import ReactionPicker from '../middle/message/reactions/ReactionPicker.async';
import MessageListHistoryHandler from '../middle/MessageListHistoryHandler';
import MiddleColumn from '../middle/MiddleColumn';
import AudioPlayer from '../middle/panes/AudioPlayer';
import ModalContainer from '../modals/ModalContainer';
import PaymentModal from '../payment/PaymentModal.async';
import ReceiptModal from '../payment/ReceiptModal.async';
import RightColumn from '../right/RightColumn';
import StoryViewer from '../story/StoryViewer.async';
import AttachBotRecipientPicker from './AttachBotRecipientPicker.async';
import BotTrustModal from './BotTrustModal.async';
import DeleteFolderDialog from './DeleteFolderDialog.async';
import Dialogs from './Dialogs.async';
import DownloadManager from './DownloadManager';
import DraftRecipientPicker from './DraftRecipientPicker.async';
import ForwardRecipientPicker from './ForwardRecipientPicker.async';
import GameModal from './GameModal';
import HistoryCalendar from './HistoryCalendar.async';
import NewContactModal from './NewContactModal.async';
import Notifications from './Notifications.async';
import PremiumLimitReachedModal from './premium/common/PremiumLimitReachedModal.async';
import GiveawayModal from './premium/GiveawayModal.async';
import PremiumMainModal from './premium/PremiumMainModal.async';
import StarsGiftingPickerModal from './premium/StarsGiftingPickerModal.async';
import SafeLinkModal from './SafeLinkModal.async';
import ConfettiContainer from './visualEffects/ConfettiContainer';
import SnapEffectContainer from './visualEffects/SnapEffectContainer';
import WaveContainer from './visualEffects/WaveContainer';

import './Main.scss';

export interface OwnProps {
  isMobile?: boolean;
}

type StateProps = {
  isMasterTab?: boolean;
  currentUserId?: string;
  isLeftColumnOpen: boolean;
  isMiddleColumnOpen: boolean;
  isRightColumnOpen: boolean;
  isMediaViewerOpen: boolean;
  isStoryViewerOpen: boolean;
  isForwardModalOpen: boolean;
  hasNotifications: boolean;
  hasDialogs: boolean;
  safeLinkModalUrl?: string;
  isHistoryCalendarOpen: boolean;
  shouldSkipHistoryAnimations?: boolean;
  openedStickerSetShortName?: string;
  openedCustomEmojiSetIds?: string[];
  activeGroupCallId?: string;
  isServiceChatReady?: boolean;
  wasTimeFormatSetManually?: boolean;
  isPhoneCallActive?: boolean;
  addedSetIds?: string[];
  addedCustomEmojiIds?: string[];
  newContactUserId?: string;
  newContactByPhoneNumber?: boolean;
  openedGame?: TabState['openedGame'];
  gameTitle?: string;
  isRatePhoneCallModalOpen?: boolean;
  isPremiumModalOpen?: boolean;
  botTrustRequest?: TabState['botTrustRequest'];
  botTrustRequestBot?: ApiUser;
  requestedAttachBotInChat?: TabState['requestedAttachBotInChat'];
  requestedDraft?: TabState['requestedDraft'];
  limitReached?: ApiLimitTypeWithModal;
  deleteFolderDialog?: ApiChatFolder;
  isPaymentModalOpen?: boolean;
  isReceiptModalOpen?: boolean;
  isReactionPickerOpen: boolean;
  isGiveawayModalOpen?: boolean;
  isDeleteMessageModalOpen?: boolean;
  isStarsGiftingPickerModal?: boolean;
  isCurrentUserPremium?: boolean;
  noRightColumnAnimation?: boolean;
  withInterfaceAnimations?: boolean;
  isSynced?: boolean;
  isAccountFrozen?: boolean;
  isAppConfigLoaded?: boolean;
};

const APP_OUTDATED_TIMEOUT_MS = 5 * 60 * 1000; // 5 min
const CALL_BUNDLE_LOADING_DELAY_MS = 5000; // 5 sec

let DEBUG_isLogged = false;

const Main = ({
  isMobile,
  isLeftColumnOpen,
  isMiddleColumnOpen,
  isRightColumnOpen,
  isMediaViewerOpen,
  isStoryViewerOpen,
  isForwardModalOpen,
  hasNotifications,
  hasDialogs,
  activeGroupCallId,
  safeLinkModalUrl,
  isHistoryCalendarOpen,
  shouldSkipHistoryAnimations,
  limitReached,
  openedStickerSetShortName,
  openedCustomEmojiSetIds,
  isServiceChatReady,
  withInterfaceAnimations,
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
  requestedAttachBotInChat,
  requestedDraft,
  isPremiumModalOpen,
  isGiveawayModalOpen,
  isDeleteMessageModalOpen,
  isStarsGiftingPickerModal,
  isPaymentModalOpen,
  isReceiptModalOpen,
  isReactionPickerOpen,
  isCurrentUserPremium,
  deleteFolderDialog,
  isMasterTab,
  noRightColumnAnimation,
  isSynced,
  currentUserId,
  isAccountFrozen,
  isAppConfigLoaded,
}: OwnProps & StateProps) => {
  const {
    initMain,
    loadAnimatedEmojis,
    loadBirthdayNumbersStickers,
    loadRestrictedEmojiStickers,
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
    loadTonGifts,
    loadStarGifts,
    loadMyUniqueGifts,
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
    openThread,
    toggleLeftColumn,
    loadRecentEmojiStatuses,
    loadUserCollectibleStatuses,
    updatePageTitle,
    loadTopReactions,
    loadRecentReactions,
    loadDefaultTagReactions,
    loadFeaturedEmojiStickers,
    loadAuthorizations,
    loadPeerColors,
    loadSavedReactionTags,
    loadTimezones,
    loadQuickReplies,
    loadStarStatus,
    loadAvailableEffects,
    loadTopBotApps,
    loadPaidReactionPrivacy,
    loadPasswordInfo,
    loadBotFreezeAppeal,
    loadAllChats,
    loadAllStories,
    loadAllHiddenStories,
    loadContentSettings,
  } = getActions();

  if (DEBUG && !DEBUG_isLogged) {
    DEBUG_isLogged = true;
    // eslint-disable-next-line no-console
    console.log('>>> RENDER MAIN');
  }

  const lang = useLang();

  // Preload Calls bundle to initialize sounds for iOS
  useTimeout(() => {
    void loadBundle(Bundles.Calls);
  }, CALL_BUNDLE_LOADING_DELAY_MS);

  const containerRef = useRef<HTMLDivElement>();
  const leftColumnRef = useRef<HTMLDivElement>();

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

  useInterval(checkAppVersion, isMasterTab ? APP_OUTDATED_TIMEOUT_MS : undefined, true);

  // Initial API calls
  useEffect(() => {
    if (isMasterTab && isSynced) {
      updateIsOnline({ isOnline: true });
      loadConfig();
      loadAppConfig();
      loadPeerColors();
      initMain();
      loadContactList();
      checkAppVersion();
      loadAuthorizations();
      loadPasswordInfo();
    }
  }, [isMasterTab, isSynced]);

  // Initial API calls
  useEffect(() => {
    if (isMasterTab && isSynced && isAppConfigLoaded && !isAccountFrozen) {
      loadAllChats({ listType: 'saved' });
      loadAllStories();
      loadAllHiddenStories();
      loadContentSettings();
      loadRecentReactions();
      loadDefaultTagReactions();
      loadAttachBots();
      loadNotificationSettings();
      loadNotificationExceptions();
      loadTopInlineBots();
      loadTopReactions();
      loadStarStatus();
      loadEmojiKeywords({ language: BASE_EMOJI_KEYWORD_LANG });
      loadFeaturedEmojiStickers();
      loadSavedReactionTags();
      loadTopBotApps();
      loadPaidReactionPrivacy();
      loadDefaultTopicIcons();
      loadAnimatedEmojis();
      loadAvailableReactions();
      loadUserCollectibleStatuses();
      loadGenericEmojiEffects();
      loadPremiumGifts();
      loadTonGifts();
      loadStarGifts();
      loadMyUniqueGifts();
      loadAvailableEffects();
      loadBirthdayNumbersStickers();
      loadRestrictedEmojiStickers();
      loadQuickReplies();
      loadTimezones();
    }
  }, [isMasterTab, isSynced, isAppConfigLoaded, isAccountFrozen]);

  // Initial Premium API calls
  useEffect(() => {
    if (isMasterTab && isCurrentUserPremium && isAppConfigLoaded && !isAccountFrozen) {
      loadDefaultStatusIcons();
      loadRecentEmojiStatuses();
    }
  }, [isCurrentUserPremium, isMasterTab, isAppConfigLoaded, isAccountFrozen]);

  // Language-based API calls
  useEffect(() => {
    if (isMasterTab) {
      if (lang.code !== BASE_EMOJI_KEYWORD_LANG) {
        loadEmojiKeywords({ language: lang.code });
      }

      loadCountryList({ langCode: lang.code });
    }
  }, [lang, isMasterTab]);

  // Re-fetch cached saved emoji for `localDb`
  useEffect(() => {
    if (isMasterTab) {
      loadCustomEmojis({
        ids: Object.keys(getGlobal().customEmojis.byId),
        ignoreCache: true,
      });
    }
  }, [isMasterTab]);

  // Sticker sets
  useEffect(() => {
    if (isMasterTab && isSynced && isAppConfigLoaded && !isAccountFrozen) {
      if (!addedSetIds || !addedCustomEmojiIds) {
        loadStickerSets();
        loadFavoriteStickers();
      }

      if (addedSetIds && addedCustomEmojiIds) {
        loadAddedStickers();
      }
    }
  }, [addedSetIds, addedCustomEmojiIds, isMasterTab, isSynced, isAppConfigLoaded, isAccountFrozen]);

  useEffect(() => {
    loadBotFreezeAppeal();
  }, [isAppConfigLoaded]);

  // Check version when service chat is ready
  useEffect(() => {
    if (isServiceChatReady && isMasterTab) {
      checkVersionNotification();
    }
  }, [isServiceChatReady, isMasterTab]);

  // Ensure time format
  useEffect(() => {
    if (!wasTimeFormatSetManually) {
      ensureTimeFormat();
    }
  }, [wasTimeFormatSetManually]);

  // Parse deep link
  useEffect(() => {
    if (!isSynced) return;
    updatePageTitle();

    const parsedInitialLocationHash = parseInitialLocationHash();
    if (parsedInitialLocationHash?.tgaddr) {
      processDeepLink(decodeURIComponent(parsedInitialLocationHash.tgaddr));
    }
  }, [isSynced]);

  useTauriEvent<string>('deeplink', (event) => {
    try {
      const url = event.payload || '';
      const decodedUrl = decodeURIComponent(url);
      processDeepLink(decodedUrl);
    } catch (e) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Failed to process deep link', e);
      }
    }
  });

  useEffect(() => {
    const parsedLocationHash = parseLocationHash(currentUserId);
    if (!parsedLocationHash) return;

    openThread({
      chatId: parsedLocationHash.chatId,
      threadId: parsedLocationHash.threadId,
      type: parsedLocationHash.type,
    });
  }, [currentUserId]);

  // Restore Transition slide class after async rendering
  useLayoutEffect(() => {
    const container = containerRef.current!;
    if (container.parentNode!.childElementCount === 1) {
      addExtraClass(container, 'Transition_slide-active');
    }
  }, []);

  useShowTransition({
    ref: containerRef,
    isOpen: isLeftColumnOpen,
    noCloseTransition: shouldSkipHistoryAnimations,
    prefix: 'left-column-',
  });
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

    const endHeavyAnimation = beginHeavyAnimation();

    waitForTransitionEnd(document.getElementById('MiddleColumn')!, () => {
      endHeavyAnimation();
      willAnimateLeftColumnRef.current = false;
      forceUpdate();
    });
  }, [isLeftColumnOpen, withInterfaceAnimations, forceUpdate]);

  useShowTransition({
    ref: containerRef,
    isOpen: isRightColumnOpen,
    noCloseTransition: shouldSkipHistoryAnimations,
    prefix: 'right-column-',
  });
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

    const endHeavyAnimation = beginHeavyAnimation();

    waitForTransitionEnd(document.getElementById('RightColumn')!, () => {
      endHeavyAnimation();
      willAnimateRightColumnRef.current = false;
      forceUpdate();
      setIsNarrowMessageList(isRightColumnOpen);
    });
  }, [isMiddleColumnOpen, isRightColumnOpen, noRightColumnAnimation, forceUpdate]);

  const className = buildClassName(
    willAnimateLeftColumnRef.current && 'left-column-animating',
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
  useBackgroundMode(handleBlur, handleFocus, IS_TAURI);
  useBeforeUnload(handleBlur);
  usePreventPinchZoomGesture(isMediaViewerOpen || isStoryViewerOpen);

  return (
    <div ref={containerRef} id="Main" className={className}>
      <LeftColumn ref={leftColumnRef} />
      <MiddleColumn leftColumnRef={leftColumnRef} isMobile={isMobile} />
      <RightColumn isMobile={isMobile} />
      <MediaViewer isOpen={isMediaViewerOpen} />
      <StoryViewer isOpen={isStoryViewerOpen} />
      <ForwardRecipientPicker isOpen={isForwardModalOpen} />
      <DraftRecipientPicker requestedDraft={requestedDraft} />
      <Notifications isOpen={hasNotifications} />
      <Dialogs isOpen={hasDialogs} />
      <AudioPlayer noUi />
      <ModalContainer />
      <SafeLinkModal url={safeLinkModalUrl} />
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
      <DownloadManager />
      <ConfettiContainer />
      {IS_WAVE_TRANSFORM_SUPPORTED && <WaveContainer />}
      <SnapEffectContainer />
      <PhoneCall isActive={isPhoneCallActive} />
      <UnreadCount isForAppBadge />
      <RatePhoneCallModal isOpen={isRatePhoneCallModalOpen} />
      <BotTrustModal
        bot={botTrustRequestBot}
        type={botTrustRequest?.type}
        shouldRequestWriteAccess={botTrustRequest?.shouldRequestWriteAccess}
      />
      <AttachBotRecipientPicker requestedAttachBotInChat={requestedAttachBotInChat} />
      <MessageListHistoryHandler />
      <PremiumMainModal isOpen={isPremiumModalOpen} />
      <GiveawayModal isOpen={isGiveawayModalOpen} />
      <StarsGiftingPickerModal isOpen={isStarsGiftingPickerModal} />
      <PremiumLimitReachedModal limit={limitReached} />
      <PaymentModal isOpen={isPaymentModalOpen} onClose={closePaymentModal} />
      <ReceiptModal isOpen={isReceiptModalOpen} onClose={clearReceipt} />
      <DeleteFolderDialog folder={deleteFolderDialog} />
      <ReactionPicker isOpen={isReactionPickerOpen} />
      <DeleteMessageModal isOpen={isDeleteMessageModalOpen} />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isMobile }): Complete<StateProps> => {
    const {
      currentUserId,
    } = global;

    const {
      botTrustRequest,
      requestedAttachBotInChat,
      requestedDraft,
      safeLinkModalUrl,
      openedStickerSetShortName,
      openedCustomEmojiSetIds,
      shouldSkipHistoryAnimations,
      openedGame,
      isLeftColumnShown,
      historyCalendarSelectedAt,
      notifications,
      dialogs,
      newContact,
      ratingPhoneCall,
      premiumModal,
      giveawayModal,
      deleteMessageModal,
      starsGiftingPickerModal,
      isMasterTab,
      payment,
      limitReachedModal,
      deleteFolderDialogModal,
    } = selectTabState(global);

    const { wasTimeFormatSetManually } = selectSharedSettings(global);

    const gameMessage = openedGame && selectChatMessage(global, openedGame.chatId, openedGame.messageId);
    const gameTitle = gameMessage?.content.game?.title;
    const { chatId } = selectCurrentMessageList(global) || {};
    const noRightColumnAnimation = !selectPerformanceSettingsValue(global, 'rightColumnAnimations')
      || !selectCanAnimateInterface(global);

    const deleteFolderDialog = deleteFolderDialogModal ? selectChatFolder(global, deleteFolderDialogModal) : undefined;
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    return {
      currentUserId,
      isLeftColumnOpen: isLeftColumnShown,
      isMiddleColumnOpen: Boolean(chatId),
      isRightColumnOpen: selectIsRightColumnShown(global, isMobile),
      isMediaViewerOpen: selectIsMediaViewerOpen(global),
      isStoryViewerOpen: selectIsStoryViewerOpen(global),
      isForwardModalOpen: selectIsForwardModalOpen(global),
      isReactionPickerOpen: selectIsReactionPickerOpen(global),
      hasNotifications: Boolean(notifications.length),
      hasDialogs: Boolean(dialogs.length),
      safeLinkModalUrl,
      isHistoryCalendarOpen: Boolean(historyCalendarSelectedAt),
      shouldSkipHistoryAnimations,
      openedStickerSetShortName,
      openedCustomEmojiSetIds,
      isServiceChatReady: selectIsServiceChatReady(global),
      activeGroupCallId: isMasterTab ? global.groupCalls.activeGroupCallId : undefined,
      withInterfaceAnimations: selectCanAnimateInterface(global),
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
      requestedAttachBotInChat,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isPremiumModalOpen: premiumModal?.isOpen,
      isGiveawayModalOpen: giveawayModal?.isOpen,
      isDeleteMessageModalOpen: Boolean(deleteMessageModal),
      isStarsGiftingPickerModal: starsGiftingPickerModal?.isOpen,
      limitReached: limitReachedModal?.limit,
      isPaymentModalOpen: payment.isPaymentModalOpen,
      isReceiptModalOpen: Boolean(payment.receipt),
      deleteFolderDialog,
      isMasterTab,
      requestedDraft,
      noRightColumnAnimation,
      isSynced: global.isSynced,
      isAccountFrozen,
      isAppConfigLoaded: global.isAppConfigLoaded,
    };
  },
)(Main));
