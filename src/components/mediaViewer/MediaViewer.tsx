import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat,
  ApiMessage, ApiPeer, ApiPhoto,
} from '../../api/types';
import { type MediaViewerMedia, MediaViewerOrigin, type ThreadId } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import {
  getChatMediaMessageIds, getMessagePaidMedia, isChatAdmin, isUserId,
} from '../../global/helpers';
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
  selectPerformanceSettingsValue,
  selectScheduledMessage,
  selectTabState,
} from '../../global/selectors';
import { stopCurrentAudio } from '../../util/audioPlayer';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { MEDIA_VIEWER_MEDIA_QUERY } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import getViewableMedia, { getMediaViewerItem, type MediaViewerItem } from './helpers/getViewableMedia';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';

import useAppLayout from '../../hooks/useAppLayout';
import useElectronDrag from '../../hooks/useElectronDrag';
import useFlag from '../../hooks/useFlag';
import useForceUpdate from '../../hooks/useForceUpdate';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import { exitPictureInPictureIfNeeded, usePictureInPictureSignal } from '../../hooks/usePictureInPicture';
import usePrevious from '../../hooks/usePrevious';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';
import { useMediaProps } from './hooks/useMediaProps';

import ReportModal from '../common/ReportModal';
import Button from '../ui/Button';
import ShowTransition from '../ui/ShowTransition';
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
  chatMessages?: Record<number, ApiMessage>;
  standaloneMedia?: MediaViewerMedia[];
  mediaIndex?: number;
  isHidden?: boolean;
  withAnimation?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  withDynamicLoading?: boolean;
  isLoadingMoreMedia?: boolean;
  isSynced?: boolean;
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
  chatMessages,
  standaloneMedia,
  mediaIndex,
  withAnimation,
  isHidden,
  shouldSkipHistoryAnimations,
  withDynamicLoading,
  isLoadingMoreMedia,
  isSynced,
}: StateProps) => {
  const {
    openMediaViewer,
    closeMediaViewer,
    openForwardMenu,
    focusMessage,
    toggleChatInfo,
    searchChatMediaMessages,
    loadMoreProfilePhotos,
  } = getActions();

  const isOpen = Boolean(avatarOwner || message || standaloneMedia);
  const { isMobile } = useAppLayout();

  /* Animation */
  const animationKey = useRef<number>();
  const senderId = message?.senderId || avatarOwner?.id;
  const prevSenderId = usePrevious<string | undefined>(senderId);
  const headerAnimation = withAnimation ? 'slideFade' : 'none';
  const isGhostAnimation = Boolean(withAnimation && !shouldSkipHistoryAnimations);

  /* Controls */
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();

  const currentItem = getMediaViewerItem({
    message, avatarOwner, standaloneMedia, mediaIndex,
  });
  const { media, isSingle } = getViewableMedia(currentItem) || {};

  const {
    isVideo,
    isPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    isFromSharedMedia,
  } = useMediaProps({
    media, isAvatar: Boolean(avatarOwner), origin, delay: isGhostAnimation && ANIMATION_DURATION,
  });

  const canReport = avatarOwner && !isChatWithSelf;
  const isVisible = !isHidden && isOpen;

  const messageMediaIds = useMemo(() => {
    return withDynamicLoading
      ? collectedMessageIds
      : getChatMediaMessageIds(chatMessages || {}, collectedMessageIds || [], isFromSharedMedia);
  }, [chatMessages, collectedMessageIds, isFromSharedMedia, withDynamicLoading]);

  if (isOpen && (!prevSenderId || prevSenderId !== senderId || animationKey.current === undefined)) {
    animationKey.current = isSingle ? 0 : (messageId || mediaIndex);
  }

  const [getIsPictureInPicture] = usePictureInPictureSignal();

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
    if (isVisible) {
      exitPictureInPictureIfNeeded();
    }
  }, [isVisible]);

  useEffect(() => {
    if (isMobile) {
      document.body.classList.toggle('is-media-viewer-open', isOpen);
    }
  }, [isMobile, isOpen]);

  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(headerRef);

  const forceUpdate = useForceUpdate();
  useEffect(() => {
    const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
    mql.addEventListener('change', forceUpdate);

    return () => {
      mql.removeEventListener('change', forceUpdate);
    };
  }, [forceUpdate]);

  const prevMessage = usePrevious<ApiMessage | undefined>(message);
  const prevIsHidden = usePrevious<boolean | undefined>(isHidden);
  const prevOrigin = usePrevious(origin);
  const prevItem = usePrevious(currentItem);
  const prevBestImageData = usePrevious(bestImageData);
  const textParts = message ? renderMessageText({ message, forcePlayback: true, isForMediaViewer: true }) : undefined;
  const hasFooter = Boolean(textParts);
  const shouldAnimateOpening = prevIsHidden && prevItem !== currentItem;

  useEffect(() => {
    if (isGhostAnimation && isOpen && (shouldAnimateOpening || !prevItem)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(hasFooter, origin!, bestImageData!, dimensions!, isVideo, message, mediaIndex);
    }

    if (isGhostAnimation && !isOpen && prevItem) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage, prevItem?.mediaIndex);
    }
  }, [
    bestImageData, dimensions, hasFooter, isGhostAnimation, isOpen, isVideo, message, origin,
    prevBestImageData, prevItem, prevMessage, prevOrigin, shouldAnimateOpening, mediaIndex,
  ]);

  const handleClose = useLastCallback(() => closeMediaViewer());

  const handleFooterClick = useLastCallback(() => {
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

  const handleForward = useLastCallback(() => {
    openForwardMenu({
      fromChatId: chatId!,
      messageIds: [messageId!],
    });
  });

  useEffect(() => (isOpen ? captureEscKeyListener(() => {
    handleClose();
  }) : undefined), [handleClose, isOpen]);

  useEffect(() => {
    if (isVideo && !isGif) {
      stopCurrentAudio();
    }
  }, [isGif, isVideo]);

  const loadMoreItemsIfNeeded = useLastCallback((item?: MediaViewerItem) => {
    if (!item || isLoadingMoreMedia) return;

    if (item.type === 'avatar') {
      const isNearEnd = item.mediaIndex >= item.avatarOwner.profilePhotos!.photos.length - AVATAR_LOAD_TRIGGER;
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
      const { avatarOwner: fromAvatarOwner, mediaIndex: fromMediaIndex } = from;
      const nextIndex = fromMediaIndex + direction;
      if (nextIndex >= 0 && fromAvatarOwner.profilePhotos && nextIndex < fromAvatarOwner.profilePhotos.photos.length) {
        return { type: 'avatar', avatarOwner: fromAvatarOwner, mediaIndex: nextIndex };
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
    if (index === undefined) return undefined;
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

    openMediaViewer({
      origin: origin!,
      chatId: itemChatId,
      messageId: itemMessageId,
      standaloneMedia: itemStandaloneMedia,
      mediaIndex: item.mediaIndex,
      isAvatarView: item.type === 'avatar',
      withDynamicLoading,
    }, {
      forceOnHeavyAnimation: true,
    });
  });

  const handleBeforeDelete = useLastCallback(() => {
    const mediaCount = avatarOwner?.profilePhotos?.photos.length
      || standaloneMedia?.length || messageMediaIds?.length || 0;
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

    if ((currentItem.type === 'avatar' && isUserId(currentItem.avatarOwner.id)) || currentItem.type === 'standalone') {
      // Keep current item, it'll update when indexes shift
      return;
    }

    handleClose();
  });

  const lang = useOldLang();

  return (
    <ShowTransition
      id="MediaViewer"
      isOpen={isOpen}
      isHidden={isHidden}
      shouldAnimateFirstRender
      noCloseTransition={shouldSkipHistoryAnimations}
    >
      <div className="media-viewer-head" dir={lang.isRtl ? 'rtl' : undefined} ref={headerRef}>
        {isMobile && (
          <Button
            className="media-viewer-close"
            round
            size="smaller"
            color="translucent-white"
            ariaLabel={lang('Close')}
            onClick={handleClose}
          >
            <i className="icon icon-close" />
          </Button>
        )}
        <Transition activeKey={animationKey.current!} name={headerAnimation}>
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
          canReport={canReport}
          onBeforeDelete={handleBeforeDelete}
          onReport={openReportModal}
          onCloseMediaViewer={handleClose}
          onForward={handleForward}
        />
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          subject="media"
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
      />
    </ShowTransition>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const { mediaViewer, shouldSkipHistoryAnimations } = selectTabState(global);
    const {
      chatId,
      threadId,
      messageId,
      origin,
      isHidden,
      withDynamicLoading,
      standaloneMedia,
      mediaIndex,
      isAvatarView,
    } = mediaViewer;
    const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

    const { currentUserId, isSynced } = global;
    const isChatWithSelf = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    if (isAvatarView) {
      const peer = selectPeer(global, chatId!);
      let canUpdateMedia = false;
      if (peer) {
        canUpdateMedia = isUserId(peer.id) ? peer.id === currentUserId : isChatAdmin(peer as ApiChat);
      }

      const profilePhotos = peer?.profilePhotos;

      return {
        avatar: profilePhotos?.photos[mediaIndex!],
        avatarOwner: peer,
        isLoadingMoreMedia: profilePhotos?.isLoading,
        isChatWithSelf,
        canUpdateMedia,
        withAnimation,
        origin,
        shouldSkipHistoryAnimations,
        isHidden,
        standaloneMedia,
        mediaIndex,
        isSynced,
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
        const { foundIds } = (currentSearch && currentSearch.resultsByType && currentSearch.resultsByType.media) || {};
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
      collectedMessageIds,
      withAnimation,
      isHidden,
      shouldSkipHistoryAnimations,
      withDynamicLoading,
      standaloneMedia,
      mediaIndex,
      isLoadingMoreMedia,
      isSynced,
    };
  },
)(MediaViewer));
