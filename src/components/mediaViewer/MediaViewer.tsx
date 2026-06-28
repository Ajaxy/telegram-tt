import type React from '../../lib/teact/teact';
import {
  beginHeavyAnimation,
  memo, useEffect, useLayoutEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat,
  ApiMessage,
  ApiPeer,
  ApiPeerPhotos,
  ApiPhoto,
  ApiSponsoredMessage,
} from '../../api/types';
import {
  type MediaViewerMedia,
  MediaViewerOrigin,
  type MediaViewerPageMedia,
  type ThreadId,
} from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import {
  getMediaSearchType,
  getMessageContentIds,
  getMessagePaidMedia, isChatAdmin,
} from '../../global/helpers';
import { hasRichText } from '../../global/helpers/richMessage';
import {
  selectChatMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentChatMediaSearch,
  selectCurrentSharedMediaSearch,
  selectIsChatWithSelf,
  selectListedIds,
  selectOutlyingListByMessageId,
  selectPeer,
  selectPeerPhotos,
  selectPerformanceSettingsValue,
  selectScheduledMessage, selectSponsoredMessage,
  selectTabState,
} from '../../global/selectors';
import { stopCurrentAudio } from '../../util/audioPlayer';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { isUserId } from '../../util/entities/ids';
import { MEDIA_VIEWER_MEDIA_QUERY } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import { getMediaViewerItem, type MediaViewerItem, type ViewableMedia } from './helpers/getViewableMedia';
import selectViewableMedia from './helpers/getViewableMedia';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';

import useAppLayout from '../../hooks/useAppLayout';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import { exitPictureInPictureIfNeeded, PICTURE_IN_PICTURE_SIGNAL } from '../../hooks/usePictureInPicture';
import usePrevious from '../../hooks/usePrevious';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';
import useShowTransition from '../../hooks/useShowTransition';
import { useMediaProps } from './hooks/useMediaProps';

import ReportAvatarModal from '../common/ReportAvatarModal';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import MediaViewerActions from './MediaViewerActions';
import MediaViewerSlides from './MediaViewerSlides';
import SenderInfo from './SenderInfo';

import './MediaViewer.scss';

type StateProps = {
  chatId?: string;
  threadId?: ThreadId;
  messageId?: number;
  message?: ApiMessage;
  collectedMessageIds?: number[];
  isChatWithSelf?: boolean;
  canUpdateMedia?: boolean;
  origin?: MediaViewerOrigin;
  avatar?: ApiPhoto;
  avatarOwner?: ApiPeer;
  profilePhotos?: ApiPeerPhotos;
  chatMessages?: Record<number, ApiMessage>;
  sponsoredMessage?: ApiSponsoredMessage;
  standaloneMedia?: MediaViewerMedia[];
  pageMedia?: MediaViewerPageMedia;
  mediaIndex?: number;
  isHidden?: boolean;
  withAnimation?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  withDynamicLoading?: boolean;
  isLoadingMoreMedia?: boolean;
  isSynced?: boolean;
  currentItem?: MediaViewerItem;
  viewableMedia?: ViewableMedia;
};

const ANIMATION_DURATION = 250;
const AVATAR_LOAD_TRIGGER = 4;

const MediaViewer = ({
  chatId,
  threadId,
  messageId,
  message,
  collectedMessageIds,
  isChatWithSelf,
  canUpdateMedia,
  origin,
  avatar,
  avatarOwner,
  profilePhotos,
  chatMessages,
  sponsoredMessage,
  standaloneMedia,
  pageMedia,
  mediaIndex,
  withAnimation,
  isHidden,
  shouldSkipHistoryAnimations,
  withDynamicLoading,
  isLoadingMoreMedia,
  isSynced,
  currentItem,
  viewableMedia,
}: StateProps) => {
  const {
    openMediaViewer,
    closeMediaViewer,
    openForwardMenu,
    focusMessage,
    toggleChatInfo,
    searchChatMediaMessages,
    loadMoreProfilePhotos,
    clickSponsored,
    openUrl,
  } = getActions();

  const dialogRef = useRef<HTMLDialogElement>();
  const isOpen = Boolean(avatarOwner || message || standaloneMedia || pageMedia || sponsoredMessage);
  const prevIsOpen = usePreviousDeprecated(isOpen);
  const prevIsHidden = usePreviousDeprecated(isHidden);
  const { isMobile } = useAppLayout();

  const { media, isSingle } = viewableMedia || {};

  /* Animation */
  const animationKeyRef = useRef<number>();
  const senderId = message?.senderId || avatarOwner?.id || message?.chatId
    || (currentItem?.type === 'pageBlock' ? currentItem.pageMedia.pageUrl || 'pageBlock' : undefined);
  const prevSenderId = usePreviousDeprecated<string | undefined>(senderId);
  const headerAnimation = withAnimation ? 'slideFade' : 'none';
  const isGhostAnimation = Boolean(withAnimation && !shouldSkipHistoryAnimations);

  /* Controls */
  const [isReportAvatarModalOpen, openReportAvatarModal, closeReportAvatarModal] = useFlag();

  const {
    isVideo,
    isPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    contentType,
  } = useMediaProps({
    media, isAvatar: Boolean(avatarOwner), origin, delay: isGhostAnimation && ANIMATION_DURATION,
  });

  const canReportAvatar = (() => {
    if (isChatWithSelf) return false;
    if (currentItem?.type !== 'avatar' || !avatarOwner) return false;
    const info = currentItem.profilePhotos;
    if (media === info.personalPhoto) return false;
    return true;
  })();

  const messageMediaIds = useMemo(() => {
    return withDynamicLoading
      ? collectedMessageIds
      : getMessageContentIds(chatMessages || {}, collectedMessageIds || [], contentType || 'media');
  }, [chatMessages, collectedMessageIds, contentType, withDynamicLoading]);

  if (isOpen && (!prevSenderId || prevSenderId !== senderId || animationKeyRef.current === undefined)) {
    animationKeyRef.current = isSingle ? 0 : (messageId || mediaIndex);
  }

  const [getIsPictureInPicture] = PICTURE_IN_PICTURE_SIGNAL;

  useEffect(() => {
    if (!isOpen || getIsPictureInPicture()) {
      return undefined;
    }

    disableDirectTextInput();
    const stopPriorityPlayback = dispatchPriorityPlaybackEvent();

    return () => {
      stopPriorityPlayback();
      enableDirectTextInput();
    };
  }, [isOpen, getIsPictureInPicture]);

  useEffect(() => {
    if (!isHidden || !isOpen) {
      exitPictureInPictureIfNeeded();
    }
  }, [isHidden, isOpen]);

  useEffect(() => {
    if (isMobile) {
      requestMutation(() => {
        document.body.classList.toggle('is-media-viewer-open', isOpen);
      });
    }
  }, [isMobile, isOpen]);

  const forceUpdate = useForceUpdate();
  useEffect(() => {
    const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
    mql.addEventListener('change', forceUpdate);

    return () => {
      mql.removeEventListener('change', forceUpdate);
    };
  }, [forceUpdate]);

  const prevMessage = usePrevious<ApiMessage | undefined>(message);
  const prevOrigin = usePrevious(origin);
  const prevItem = usePrevious(currentItem);
  const prevBestImageData = usePrevious(bestImageData);
  const textMessage = currentItem?.type === 'message' ? currentItem.message : undefined;
  const textParts = textMessage
    ? renderMessageText({ message: textMessage, forcePlayback: true, isForMediaViewer: true })
    : undefined;
  const pageCaption = viewableMedia?.caption;
  const hasPageCaption = Boolean(pageCaption && (
    hasRichText(pageCaption.text) || hasRichText(pageCaption.credit)
  ));
  const hasFooter = Boolean(textParts || hasPageCaption);
  const sourceId = currentItem?.type === 'pageBlock'
    ? currentItem.pageMedia.sourceIds[currentItem.mediaIndex] : undefined;
  const prevSourceId = usePrevious(sourceId);
  const [
    hasStartedOpeningAnimation,
    markOpeningAnimationStarted,
    resetOpeningAnimationStarted,
  ] = useFlag();
  const shouldStartOpening = Boolean(
    isGhostAnimation && isOpen && !isHidden && !prevItem && (!prevIsOpen || prevIsHidden),
  );
  const shouldHideOpeningMedia = shouldStartOpening && !hasStartedOpeningAnimation;

  useEffectWithPrevDeps(([wasOpen, wasHidden]) => {
    if (wasOpen === isOpen && wasHidden === isHidden) return undefined;

    if (isGhostAnimation && isOpen && !isHidden && !prevItem) {
      const animationDuration = ANIMATION_DURATION + ANIMATION_END_DELAY;
      beginHeavyAnimation(animationDuration);
      const hasQueuedOpeningAnimation = animateOpening(
        hasFooter, origin!, bestImageData!, dimensions!, isVideo, message, mediaIndex, sourceId,
      );
      if (hasQueuedOpeningAnimation) {
        requestMutation(() => {
          markOpeningAnimationStarted();
        });
      } else {
        markOpeningAnimationStarted();
      }
    }

    if (isGhostAnimation && !isOpen && prevItem) {
      beginHeavyAnimation(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage, prevItem?.mediaIndex, prevSourceId);
    }

    if (!isOpen || isHidden) {
      resetOpeningAnimationStarted();
    }

    return undefined;
  }, [
    isOpen, isHidden, bestImageData, dimensions, hasFooter, isGhostAnimation, isVideo, message, origin,
    prevBestImageData, prevItem, prevMessage, prevOrigin, mediaIndex, sourceId, prevSourceId,
  ]);

  const handleClose = useLastCallback(() => closeMediaViewer());
  const handleEsc = useLastCallback((event: KeyboardEvent) => {
    event.preventDefault();

    if (isOpen) {
      handleClose();
    }
  });

  const shouldShowDialog = isOpen && !isHidden;
  const { shouldRender: shouldRenderDialog } = useShowTransition<HTMLDialogElement>({
    isOpen: shouldShowDialog,
    ref: dialogRef,
    noCloseTransition: shouldSkipHistoryAnimations || isHidden,
    closeDuration: ANIMATION_DURATION + ANIMATION_END_DELAY,
    className: false,
    withShouldRender: true,
  });
  const shouldKeepDialogOpen = shouldRenderDialog && !isHidden;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (shouldKeepDialogOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [shouldKeepDialogOpen]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !shouldKeepDialogOpen) {
      return undefined;
    }

    const handleCancel = (event: Event) => {
      event.preventDefault();
      handleClose();
    };

    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [handleClose, shouldKeepDialogOpen]);

  useEffect(() => (
    shouldKeepDialogOpen ? captureKeyboardListeners({ onEsc: handleEsc }) : undefined
  ), [handleEsc, shouldKeepDialogOpen]);

  const handleFooterClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('a')) return; // Prevent closing on timestamp click

    handleClose();

    if (!chatId || !messageId) return;

    if (isMobile) {
      setTimeout(() => {
        toggleChatInfo({ force: false }, { forceSyncOnIOs: true });
        focusMessage({ chatId, threadId, messageId });
      }, ANIMATION_DURATION);
    } else {
      focusMessage({ chatId, threadId, messageId });
    }
  });

  const handleSponsoredClick = useLastCallback((isFromMedia?: boolean) => {
    if (!sponsoredMessage || !chatId) return;

    clickSponsored({ isMedia: isFromMedia, isFullscreen: true, randomId: sponsoredMessage.randomId });
    openUrl({ url: sponsoredMessage.url });
    closeMediaViewer();
  });

  const handleForward = useLastCallback(() => {
    openForwardMenu({
      fromChatId: chatId!,
      messageIds: [messageId!],
    });
  });

  useEffect(() => {
    if (isVideo && !isGif) {
      stopCurrentAudio();
    }
  }, [isGif, isVideo]);

  const loadMoreItemsIfNeeded = useLastCallback((item?: MediaViewerItem) => {
    if (!item || isLoadingMoreMedia) return;

    if (item.type === 'avatar') {
      const isNearEnd = item.mediaIndex >= item.profilePhotos.photos.length - AVATAR_LOAD_TRIGGER;
      if (!isNearEnd) return;
      loadMoreProfilePhotos({ peerId: item.avatarOwner.id });
    }

    if (item.type === 'message' && withDynamicLoading) {
      searchChatMediaMessages({ chatId, threadId, currentMediaMessageId: item.message.id });
    }
  });

  const getNextItem = useLastCallback((from: MediaViewerItem, direction: number): MediaViewerItem | undefined => {
    if (direction === 0 || isSingle) return undefined;

    if (from.type === 'standalone') {
      const { media: fromMedia, mediaIndex: fromMediaIndex } = from;
      const nextIndex = fromMediaIndex + direction;
      if (nextIndex >= 0 && nextIndex < fromMedia.length) {
        return { type: 'standalone', media: fromMedia, mediaIndex: nextIndex };
      }

      return undefined;
    }

    if (from.type === 'avatar') {
      const { avatarOwner: fromAvatarOwner, profilePhotos: fromProfilePhotos, mediaIndex: fromMediaIndex } = from;
      const nextIndex = fromMediaIndex + direction;
      if (nextIndex >= 0 && fromProfilePhotos && nextIndex < fromProfilePhotos.photos.length) {
        return {
          type: 'avatar',
          avatarOwner: fromAvatarOwner,
          profilePhotos: fromProfilePhotos,
          mediaIndex: nextIndex,
        };
      }

      return undefined;
    }

    if (from.type === 'pageBlock') {
      const { pageMedia: fromPageMedia, mediaIndex: fromMediaIndex } = from;
      const nextIndex = fromMediaIndex + direction;
      if (nextIndex >= 0 && nextIndex < fromPageMedia.blocks.length) {
        return { type: 'pageBlock', pageMedia: fromPageMedia, mediaIndex: nextIndex };
      }

      return undefined;
    }

    if (from.type === 'sponsoredMessage') {
      const { message: fromSponsoredMessage, mediaIndex: fromSponsoredMessageIndex } = from;
      const nextIndex = fromSponsoredMessageIndex! + direction;
      if (nextIndex >= 0 && fromSponsoredMessage) {
        return { type: 'sponsoredMessage', message: fromSponsoredMessage, mediaIndex: nextIndex };
      }

      return undefined;
    }

    const { message: fromMessage, mediaIndex: fromMediaIndex } = from;

    const paidMedia = getMessagePaidMedia(fromMessage);
    if (paidMedia) {
      const nextIndex = fromMediaIndex! + direction;

      if (nextIndex >= 0 && nextIndex < paidMedia.extendedMedia.length) {
        return { type: 'message', message: fromMessage, mediaIndex: nextIndex };
      }
    }

    const index = messageMediaIds?.indexOf(fromMessage.id);
    if (index === undefined || index === -1) return undefined;
    const nextIndex = index + direction;
    const nextMessageId = messageMediaIds![nextIndex];
    const nextMessage = chatMessages?.[nextMessageId];
    if (nextMessage) {
      return { type: 'message', message: nextMessage };
    }

    return undefined;
  });

  const openMediaViewerItem = useLastCallback((item?: MediaViewerItem) => {
    if (!item) {
      handleClose();
      return;
    }

    const itemChatId = item.type === 'avatar'
      ? item.avatarOwner.id : item.type === 'message'
        ? item.message.chatId : undefined;
    const itemMessageId = item.type === 'message' ? item.message.id : undefined;
    const itemStandaloneMedia = item.type === 'standalone' ? item.media : undefined;
    const itemPageMedia = item.type === 'pageBlock' ? item.pageMedia : undefined;

    openMediaViewer({
      origin: origin!,
      chatId: itemChatId,
      messageId: itemMessageId,
      standaloneMedia: itemStandaloneMedia,
      pageMedia: itemPageMedia,
      mediaIndex: item.mediaIndex,
      isAvatarView: item.type === 'avatar',
      withDynamicLoading,
    }, {
      forceOnHeavyAnimation: true,
    });
  });

  const handleBeforeDelete = useLastCallback(() => {
    const mediaCount = profilePhotos?.photos.length
      || standaloneMedia?.length || pageMedia?.blocks.length || messageMediaIds?.length || 0;
    if (mediaCount <= 1 || !currentItem) {
      handleClose();
      return;
    }
    // Before deleting, select previous media
    const prevMedia = getNextItem(currentItem, -1);
    if (prevMedia) {
      openMediaViewerItem(prevMedia);
      return;
    }

    if (
      (currentItem.type === 'avatar' && isUserId(currentItem.avatarOwner.id))
      || currentItem.type === 'standalone'
      || currentItem.type === 'pageBlock'
    ) {
      // Keep current item, it'll update when indexes shift
      return;
    }

    handleClose();
  });

  const lang = useOldLang();

  const content = (
    <>
      <div
        className="media-viewer-head"
        dir={lang.isRtl ? 'rtl' : undefined}
        data-tauri-drag-region={IS_TAURI && IS_MAC_OS ? true : undefined}
      >
        {isMobile && (
          <Button
            className="media-viewer-close"
            round
            size="smaller"
            color="translucent-white"
            iconName="close"
            ariaLabel={lang('Close')}
            onClick={handleClose}
          />
        )}
        <Transition activeKey={animationKeyRef.current!} name={headerAnimation}>
          <SenderInfo
            key={media?.id}
            item={currentItem}
          />
        </Transition>
        <MediaViewerActions
          mediaData={bestData}
          isVideo={isVideo}
          item={currentItem}
          canUpdateMedia={canUpdateMedia}
          canReportAvatar={canReportAvatar}
          onBeforeDelete={handleBeforeDelete}
          onReportAvatar={openReportAvatarModal}
          onCloseMediaViewer={handleClose}
          onForward={handleForward}
        />
        <ReportAvatarModal
          isOpen={isReportAvatarModalOpen}
          onClose={closeReportAvatarModal}
          photo={avatar}
          peerId={avatarOwner?.id}
        />
      </div>
      <MediaViewerSlides
        item={currentItem}
        loadMoreItemsIfNeeded={loadMoreItemsIfNeeded}
        isLoadingMoreMedia={isLoadingMoreMedia}
        isSynced={isSynced}
        getNextItem={getNextItem}
        chatId={chatId}
        isPhoto={isPhoto}
        isGif={isGif}
        threadId={threadId}
        avatarOwnerId={avatarOwner?.id}
        origin={origin}
        isOpen={isOpen}
        hasFooter={hasFooter}
        isVideo={isVideo}
        withAnimation={withAnimation}
        onClose={handleClose}
        selectItem={openMediaViewerItem}
        isHidden={isHidden}
        onFooterClick={handleFooterClick}
        handleSponsoredClick={handleSponsoredClick}
      />
    </>
  );
  const prevContent = usePreviousDeprecated(content);
  const closingContentRef = useRef<React.ReactNode>();

  if (prevIsOpen && !isOpen) {
    closingContentRef.current = prevContent;
  }

  if (!isOpen && !shouldRenderDialog) {
    return undefined;
  }

  return (
    <dialog
      id="MediaViewer"
      ref={dialogRef}
      aria-modal="true"
      className={shouldHideOpeningMedia ? 'opening' : undefined}
    >
      {isOpen ? content : closingContentRef.current}
    </dialog>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const { mediaViewer, shouldSkipHistoryAnimations } = selectTabState(global);
    const {
      chatId,
      threadId,
      messageId,
      origin,
      isHidden,
      withDynamicLoading,
      standaloneMedia,
      pageMedia,
      mediaIndex,
      isAvatarView,
      isSponsoredMessage,
    } = mediaViewer;
    const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

    const { currentUserId, isSynced } = global;
    const isChatWithSelf = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    if (isAvatarView) {
      const avatarOwner = selectPeer(global, chatId!);
      let canUpdateMedia = false;
      if (avatarOwner) {
        canUpdateMedia = isUserId(avatarOwner.id)
          ? avatarOwner.id === currentUserId : isChatAdmin(avatarOwner as ApiChat);
      }

      const profilePhotos = selectPeerPhotos(global, chatId!);

      const currentItem = getMediaViewerItem({
        avatarOwner, standaloneMedia, pageMedia, profilePhotos, mediaIndex,
      });
      const viewableMedia = selectViewableMedia(global, origin, currentItem);

      return {
        profilePhotos,
        avatar: profilePhotos?.photos[mediaIndex!],
        avatarOwner,
        isLoadingMoreMedia: profilePhotos?.isLoading,
        isChatWithSelf,
        canUpdateMedia,
        withAnimation,
        origin,
        shouldSkipHistoryAnimations,
        isHidden,
        standaloneMedia,
        pageMedia,
        mediaIndex,
        isSynced,
        currentItem,
        viewableMedia,
        chatId,
        threadId,
        messageId,
        message: undefined,
        collectedMessageIds: undefined,
        chatMessages: undefined,
        sponsoredMessage: undefined,
        withDynamicLoading,
      };
    }

    let message: ApiMessage | undefined;
    if (chatId && messageId) {
      if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
        message = selectScheduledMessage(global, chatId, messageId);
      } else {
        message = selectChatMessage(global, chatId, messageId);
      }
    }

    let sponsoredMessage: ApiSponsoredMessage | undefined;
    if (isSponsoredMessage && chatId) {
      if (origin === MediaViewerOrigin.SponsoredMessage) {
        sponsoredMessage = selectSponsoredMessage(global, chatId);
      }
    }

    const currentItem = getMediaViewerItem({
      message, standaloneMedia, pageMedia, mediaIndex, sponsoredMessage,
    });
    const viewableMedia = selectViewableMedia(global, origin, currentItem);

    let chatMessages: Record<number, ApiMessage> | undefined;

    if (chatId) {
      if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
        chatMessages = selectChatScheduledMessages(global, chatId);
      } else {
        chatMessages = selectChatMessages(global, chatId);
      }
    }

    let isLoadingMoreMedia = false;
    const isOriginInline = origin === MediaViewerOrigin.Inline;
    const isOriginAlbum = origin === MediaViewerOrigin.Album;
    let collectedMessageIds: number[] | undefined;

    if (chatId && threadId && messageId) {
      if (withDynamicLoading && (isOriginInline || isOriginAlbum)) {
        const currentSearch = selectCurrentChatMediaSearch(global);
        isLoadingMoreMedia = Boolean(currentSearch?.isLoading);
        const { foundIds } = (currentSearch?.currentSegment) || {};
        collectedMessageIds = foundIds;
      } else if (origin === MediaViewerOrigin.SharedMedia) {
        const currentSearch = selectCurrentSharedMediaSearch(global);
        const resultsByType = currentSearch?.resultsByType;
        const contentType = viewableMedia && getMediaSearchType(viewableMedia?.media);
        const { foundIds } = (contentType && resultsByType?.[contentType]) || {};
        collectedMessageIds = foundIds;
      } else if (isOriginInline || isOriginAlbum) {
        const outlyingList = selectOutlyingListByMessageId(global, chatId, threadId, messageId);
        collectedMessageIds = outlyingList || selectListedIds(global, chatId, threadId);
      }
    }

    return {
      chatId,
      threadId,
      messageId,
      isChatWithSelf,
      origin,
      message,
      chatMessages,
      sponsoredMessage,
      collectedMessageIds,
      withAnimation,
      isHidden,
      shouldSkipHistoryAnimations,
      withDynamicLoading,
      standaloneMedia,
      pageMedia,
      mediaIndex,
      isLoadingMoreMedia,
      isSynced,
      currentItem,
      viewableMedia,
      canUpdateMedia: undefined,
      avatar: undefined,
      avatarOwner: undefined,
      profilePhotos: undefined,
    };
  },
)(MediaViewer));
