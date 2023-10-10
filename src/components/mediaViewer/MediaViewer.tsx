import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiMessage, ApiPeer, ApiPhoto, ApiUser,
} from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import { getChatMediaMessageIds, isChatAdmin, isUserId } from '../../global/helpers';
import {
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentMediaSearch, selectIsChatWithSelf,
  selectListedIds,
  selectOutlyingListByMessageId,
  selectPerformanceSettingsValue,
  selectScheduledMessage,
  selectTabState,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { stopCurrentAudio } from '../../util/audioPlayer';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { MEDIA_VIEWER_MEDIA_QUERY } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';

import useAppLayout from '../../hooks/useAppLayout';
import useElectronDrag from '../../hooks/useElectronDrag';
import useFlag from '../../hooks/useFlag';
import useForceUpdate from '../../hooks/useForceUpdate';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import { exitPictureInPictureIfNeeded, usePictureInPictureSignal } from '../../hooks/usePictureInPicture';
import usePrevious from '../../hooks/usePrevious';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';
import { useStateRef } from '../../hooks/useStateRef';
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
  threadId?: number;
  mediaId?: number;
  senderId?: string;
  isChatWithSelf?: boolean;
  canUpdateMedia?: boolean;
  origin?: MediaViewerOrigin;
  avatarOwner?: ApiPeer;
  avatarOwnerFallbackPhoto?: ApiPhoto;
  message?: ApiMessage;
  chatMessages?: Record<number, ApiMessage>;
  collectionIds?: number[];
  isHidden?: boolean;
  withAnimation?: boolean;
  shouldSkipHistoryAnimations?: boolean;
};

const ANIMATION_DURATION = 250;

const MediaViewer: FC<StateProps> = ({
  chatId,
  threadId,
  mediaId,
  senderId,
  isChatWithSelf,
  canUpdateMedia,
  origin,
  avatarOwner,
  avatarOwnerFallbackPhoto,
  message,
  chatMessages,
  collectionIds,
  withAnimation,
  isHidden,
  shouldSkipHistoryAnimations,
}) => {
  const {
    openMediaViewer,
    closeMediaViewer,
    openForwardMenu,
    focusMessage,
    toggleChatInfo,
  } = getActions();

  const isOpen = Boolean(avatarOwner || mediaId);
  const { isMobile } = useAppLayout();

  /* Animation */
  const animationKey = useRef<number>();
  const prevSenderId = usePrevious<string | undefined>(senderId);
  const headerAnimation = withAnimation ? 'slideFade' : 'none';
  const isGhostAnimation = Boolean(withAnimation && !shouldSkipHistoryAnimations);

  /* Controls */
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();

  const {
    webPagePhoto,
    webPageVideo,
    isVideo,
    actionPhoto,
    isPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    isFromSharedMedia,
    avatarPhoto,
    fileName,
  } = useMediaProps({
    message, avatarOwner, mediaId, origin, delay: isGhostAnimation && ANIMATION_DURATION,
  });

  const canReport = !!avatarPhoto && !isChatWithSelf;
  const isVisible = !isHidden && isOpen;

  /* Navigation */
  const singleMediaId = webPagePhoto || webPageVideo || actionPhoto ? mediaId : undefined;

  const mediaIds = useMemo(() => {
    if (singleMediaId) {
      return [singleMediaId];
    } else if (avatarOwner) {
      return avatarOwner.photos?.map((p, i) => i) || [];
    } else {
      return getChatMediaMessageIds(chatMessages || {}, collectionIds || [], isFromSharedMedia);
    }
  }, [singleMediaId, avatarOwner, chatMessages, collectionIds, isFromSharedMedia]);

  const selectedMediaIndex = mediaId ? mediaIds.indexOf(mediaId) : -1;

  if (isOpen && (!prevSenderId || prevSenderId !== senderId || !animationKey.current)) {
    animationKey.current = selectedMediaIndex;
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
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', forceUpdate);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(forceUpdate);
    }

    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', forceUpdate);
      } else if (typeof mql.removeListener === 'function') {
        mql.removeListener(forceUpdate);
      }
    };
  }, [forceUpdate]);

  const prevMessage = usePrevious<ApiMessage | undefined>(message);
  const prevIsHidden = usePrevious<boolean | undefined>(isHidden);
  const prevOrigin = usePrevious(origin);
  const prevMediaId = usePrevious(mediaId);
  const prevAvatarOwner = usePrevious<ApiPeer | undefined>(avatarOwner);
  const prevBestImageData = usePrevious(bestImageData);
  const textParts = message ? renderMessageText({ message, forcePlayback: true, isForMediaViewer: true }) : undefined;
  const hasFooter = Boolean(textParts);
  const shouldAnimateOpening = prevIsHidden && prevMediaId !== mediaId;

  useEffect(() => {
    if (isGhostAnimation && isOpen && (!prevMessage || shouldAnimateOpening) && !prevAvatarOwner) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(hasFooter, origin!, bestImageData!, dimensions!, isVideo, message);
    }

    if (isGhostAnimation && !isOpen && (prevMessage || prevAvatarOwner)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage || undefined);
    }
  }, [
    isGhostAnimation, isOpen, shouldAnimateOpening, origin, prevOrigin, message, prevMessage, prevAvatarOwner,
    bestImageData, prevBestImageData, dimensions, isVideo, hasFooter,
  ]);

  const handleClose = useLastCallback(() => closeMediaViewer());

  const mediaIdRef = useStateRef(mediaId);
  const handleFooterClick = useLastCallback(() => {
    handleClose();

    const currentMediaId = mediaIdRef.current;

    if (!chatId || !currentMediaId) return;

    if (isMobile) {
      setTimeout(() => {
        toggleChatInfo({ force: false }, { forceSyncOnIOs: true });
        focusMessage({ chatId, threadId, messageId: currentMediaId });
      }, ANIMATION_DURATION);
    } else {
      focusMessage({ chatId, threadId, messageId: currentMediaId });
    }
  });

  const handleForward = useLastCallback(() => {
    openForwardMenu({
      fromChatId: chatId!,
      messageIds: [mediaId!],
    });
  });

  const selectMedia = useLastCallback((id?: number) => {
    openMediaViewer({
      chatId,
      threadId,
      mediaId: id,
      avatarOwnerId: avatarOwner?.id,
      origin: origin!,
    }, {
      forceOnHeavyAnimation: true,
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

  const mediaIdsRef = useStateRef(mediaIds);

  const getMediaId = useLastCallback((fromId?: number, direction?: number): number | undefined => {
    if (fromId === undefined) return undefined;
    const mIds = mediaIdsRef.current;
    const index = mIds.indexOf(fromId);
    if ((direction === -1 && index > 0) || (direction === 1 && index < mIds.length - 1)) {
      return mIds[index + direction];
    }
    return undefined;
  });

  const handleBeforeDelete = useLastCallback(() => {
    if (mediaIds.length <= 1) {
      handleClose();
      return;
    }
    let index = mediaId ? mediaIds.indexOf(mediaId) : -1;
    // Before deleting, select previous media or the first one
    index = index > 0 ? index - 1 : 0;
    selectMedia(mediaIds[index]);
  });

  const lang = useLang();

  function renderSenderInfo() {
    return avatarOwner ? (
      <SenderInfo
        key={mediaId}
        chatId={avatarOwner.id}
        isAvatar
        isFallbackAvatar={isUserId(avatarOwner.id)
          && (avatarOwner as ApiUser).photos?.[mediaId!]?.id === avatarOwnerFallbackPhoto?.id}
      />
    ) : (
      <SenderInfo
        key={mediaId}
        chatId={chatId}
        messageId={mediaId}
      />
    );
  }

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
          {renderSenderInfo()}
        </Transition>
        <MediaViewerActions
          mediaData={bestData}
          isVideo={isVideo}
          message={message}
          canUpdateMedia={canUpdateMedia}
          avatarPhoto={avatarPhoto}
          avatarOwner={avatarOwner}
          fileName={fileName}
          canReport={canReport}
          selectMedia={selectMedia}
          onBeforeDelete={handleBeforeDelete}
          onReport={openReportModal}
          onCloseMediaViewer={handleClose}
          onForward={handleForward}
        />
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          subject="media"
          photo={avatarPhoto}
          peerId={avatarOwner?.id}
        />
      </div>
      <MediaViewerSlides
        mediaId={mediaId}
        getMediaId={getMediaId}
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
        selectMedia={selectMedia}
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
      mediaId,
      avatarOwnerId,
      origin,
      isHidden,
    } = mediaViewer;
    const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

    const { currentUserId } = global;
    let isChatWithSelf = !!chatId && selectIsChatWithSelf(global, chatId);

    if (origin === MediaViewerOrigin.SearchResult) {
      if (!(chatId && mediaId)) {
        return { withAnimation, shouldSkipHistoryAnimations };
      }

      const message = selectChatMessage(global, chatId, mediaId);
      if (!message) {
        return { withAnimation, shouldSkipHistoryAnimations };
      }

      return {
        chatId,
        mediaId,
        senderId: message.senderId,
        isChatWithSelf,
        origin,
        message,
        withAnimation,
        isHidden,
        shouldSkipHistoryAnimations,
      };
    }

    if (avatarOwnerId) {
      const user = selectUser(global, avatarOwnerId);
      const chat = selectChat(global, avatarOwnerId);
      let canUpdateMedia = false;
      if (user) {
        canUpdateMedia = avatarOwnerId === currentUserId;
      } else if (chat) {
        canUpdateMedia = isChatAdmin(chat);
      }

      isChatWithSelf = selectIsChatWithSelf(global, avatarOwnerId);

      return {
        mediaId,
        senderId: avatarOwnerId,
        avatarOwner: user || chat,
        avatarOwnerFallbackPhoto: user ? selectUserFullInfo(global, avatarOwnerId)?.fallbackPhoto : undefined,
        isChatWithSelf,
        canUpdateMedia,
        withAnimation,
        origin,
        shouldSkipHistoryAnimations,
        isHidden,
      };
    }

    if (!(chatId && threadId && mediaId)) {
      return { withAnimation, shouldSkipHistoryAnimations };
    }

    let message: ApiMessage | undefined;
    if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
      message = selectScheduledMessage(global, chatId, mediaId);
    } else {
      message = selectChatMessage(global, chatId, mediaId);
    }

    if (!message) {
      return { withAnimation, shouldSkipHistoryAnimations };
    }

    let chatMessages: Record<number, ApiMessage> | undefined;

    if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
      chatMessages = selectChatScheduledMessages(global, chatId);
    } else {
      chatMessages = selectChatMessages(global, chatId);
    }
    let collectionIds: number[] | undefined;

    if (origin === MediaViewerOrigin.Inline
      || origin === MediaViewerOrigin.Album) {
      collectionIds = selectOutlyingListByMessageId(global, chatId, threadId, message.id)
        || selectListedIds(global, chatId, threadId);
    } else if (origin === MediaViewerOrigin.SharedMedia) {
      const currentSearch = selectCurrentMediaSearch(global);
      const { foundIds } = (currentSearch && currentSearch.resultsByType && currentSearch.resultsByType.media) || {};
      collectionIds = foundIds;
    }

    return {
      chatId,
      threadId,
      mediaId,
      senderId: message.senderId,
      isChatWithSelf,
      origin,
      message,
      chatMessages,
      collectionIds,
      withAnimation,
      isHidden,
      shouldSkipHistoryAnimations,
    };
  },
)(MediaViewer));
