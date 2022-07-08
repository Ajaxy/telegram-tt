import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import type {
  ApiChat, ApiDimensions, ApiMessage, ApiUser,
} from '../../api/types';
import { ApiMediaFormat } from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { getActions, withGlobal } from '../../global';
import {
  getChatAvatarHash,
  getChatMediaMessageIds,
  getMessageDocument,
  getMessageFileName,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessagePhoto,
  getMessageVideo,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  getPhotoFullDimensions, getVideoAvatarMediaHash,
  getVideoDimensions,
  isMessageDocumentPhoto,
  isMessageDocumentVideo,
} from '../../global/helpers';
import {
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectCurrentMediaSearch,
  selectIsChatWithSelf,
  selectListedIds,
  selectOutlyingIds,
  selectScheduledMessage,
  selectScheduledMessages,
  selectUser,
} from '../../global/selectors';
import { stopCurrentAudio } from '../../util/audioPlayer';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { ANIMATION_END_DELAY } from '../../config';
import {
  AVATAR_FULL_DIMENSIONS, MEDIA_VIEWER_MEDIA_QUERY, VIDEO_AVATAR_FULL_DIMENSIONS,
} from '../common/helpers/mediaDimensions';
import windowSize from '../../util/windowSize';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';
import { renderMessageText } from '../common/helpers/renderMessageText';

import useBlurSync from '../../hooks/useBlurSync';
import useFlag from '../../hooks/useFlag';
import useForceUpdate from '../../hooks/useForceUpdate';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import usePrevious from '../../hooks/usePrevious';

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
  messageId?: number;
  senderId?: string;
  isChatWithSelf?: boolean;
  origin?: MediaViewerOrigin;
  avatarOwner?: ApiChat | ApiUser;
  profilePhotoIndex?: number;
  message?: ApiMessage;
  chatMessages?: Record<number, ApiMessage>;
  collectionIds?: number[];
  animationLevel: 0 | 1 | 2;
};

const ANIMATION_DURATION = 350;

const MediaViewer: FC<StateProps> = ({
  chatId,
  threadId,
  messageId,
  senderId,
  isChatWithSelf,
  origin,
  avatarOwner,
  profilePhotoIndex,
  message,
  chatMessages,
  collectionIds,
  animationLevel,
}) => {
  const {
    openMediaViewer,
    closeMediaViewer,
    openForwardMenu,
    focusMessage,
    toggleChatInfo,
  } = getActions();

  const isOpen = Boolean(avatarOwner || messageId);

  const isFromSharedMedia = origin === MediaViewerOrigin.SharedMedia;
  const isFromSearch = origin === MediaViewerOrigin.SearchResult;

  /* Content */
  const photo = message ? getMessagePhoto(message) : undefined;
  const video = message ? getMessageVideo(message) : undefined;
  const webPagePhoto = message ? getMessageWebPagePhoto(message) : undefined;
  const webPageVideo = message ? getMessageWebPageVideo(message) : undefined;
  const isDocumentPhoto = message ? isMessageDocumentPhoto(message) : false;
  const isDocumentVideo = message ? isMessageDocumentVideo(message) : false;
  const isVideo = Boolean(video || webPageVideo || isDocumentVideo);
  const { isGif } = video || webPageVideo || {};
  const isPhoto = Boolean(!isVideo && (photo || webPagePhoto || isDocumentPhoto));
  const isAvatar = Boolean(avatarOwner);

  /* Navigation */
  const singleMessageId = webPagePhoto || webPageVideo ? messageId : undefined;

  const messageIds = useMemo(() => {
    return singleMessageId
      ? [singleMessageId]
      : getChatMediaMessageIds(chatMessages || {}, collectionIds || [], isFromSharedMedia);
  }, [singleMessageId, chatMessages, collectionIds, isFromSharedMedia]);

  const selectedMediaMessageIndex = messageId ? messageIds.indexOf(messageId) : -1;

  /* Animation */
  const animationKey = useRef<number>();
  const prevSenderId = usePrevious<string | undefined>(senderId);
  if (isOpen && (!prevSenderId || prevSenderId !== senderId || !animationKey.current)) {
    animationKey.current = selectedMediaMessageIndex;
  }
  const headerAnimation = animationLevel === 2 ? 'slide-fade' : 'none';
  const isGhostAnimation = animationLevel === 2;

  /* Controls */
  const [isReportModalOpen, openReportModal, closeReportModal] = useFlag();
  const [zoomLevelChange, setZoomLevelChange] = useState<number>(1);

  /* Media data */
  function getMediaHash(isFull?: boolean) {
    if (isAvatar && profilePhotoIndex !== undefined) {
      const { photos } = avatarOwner!;
      const avatarPhoto = photos && photos[profilePhotoIndex];
      return avatarPhoto
        // Video for avatar should be used only for full size
        ? (avatarPhoto.isVideo && isFull ? getVideoAvatarMediaHash(avatarPhoto) : `photo${avatarPhoto.id}?size=c`)
        : getChatAvatarHash(avatarOwner!, isFull ? 'big' : 'normal');
    }

    return message && getMessageMediaHash(message, isFull ? 'viewerFull' : 'viewerPreview');
  }

  const pictogramBlobUrl = useMedia(
    message && (isFromSharedMedia || isFromSearch) && getMessageMediaHash(message, 'pictogram'),
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const previewMediaHash = getMediaHash();
  const previewBlobUrl = useMedia(
    previewMediaHash,
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const { mediaData: fullMediaBlobUrl } = useMediaWithLoadProgress(
    getMediaHash(true),
    undefined,
    message && getMessageMediaFormat(message, 'viewerFull'),
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const avatarPhoto = avatarOwner?.photos?.[profilePhotoIndex!];
  const isVideoAvatar = Boolean(isAvatar && avatarPhoto?.isVideo);
  const canReport = !!avatarPhoto && profilePhotoIndex! > 0 && !isChatWithSelf;

  const localBlobUrl = (photo || video) ? (photo || video)!.blobUrl : undefined;
  let bestImageData = (!isVideo && (localBlobUrl || fullMediaBlobUrl)) || previewBlobUrl || pictogramBlobUrl;
  const thumbDataUri = useBlurSync(!bestImageData && message && getMessageMediaThumbDataUri(message));
  if (!bestImageData && origin !== MediaViewerOrigin.SearchResult) {
    bestImageData = thumbDataUri;
  }
  if (isVideoAvatar && previewBlobUrl) {
    bestImageData = previewBlobUrl;
  }

  const fileName = message
    ? getMessageFileName(message)
    : isAvatar
      ? `avatar${avatarOwner!.id}-${profilePhotoIndex}.${avatarOwner?.hasVideoAvatar ? 'mp4' : 'jpg'}`
      : undefined;

  let dimensions!: ApiDimensions;
  if (message) {
    if (isDocumentPhoto || isDocumentVideo) {
      dimensions = getMessageDocument(message)!.mediaSize!;
    } else if (photo || webPagePhoto) {
      dimensions = getPhotoFullDimensions((photo || webPagePhoto)!)!;
    } else if (video || webPageVideo) {
      dimensions = getVideoDimensions((video || webPageVideo)!)!;
    }
  } else {
    dimensions = isVideoAvatar ? VIDEO_AVATAR_FULL_DIMENSIONS : AVATAR_FULL_DIMENSIONS;
  }

  useEffect(() => {
    if (!IS_SINGLE_COLUMN_LAYOUT) {
      return;
    }

    document.body.classList.toggle('is-media-viewer-open', isOpen);
  }, [isOpen]);

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
  const prevOrigin = usePrevious(origin);
  const prevAvatarOwner = usePrevious<ApiChat | ApiUser | undefined>(avatarOwner);
  const prevBestImageData = usePrevious(bestImageData);
  const textParts = message ? renderMessageText(message) : undefined;
  const hasFooter = Boolean(textParts);

  useEffect(() => {
    if (isGhostAnimation && isOpen && !prevMessage && !prevAvatarOwner) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(hasFooter, origin!, bestImageData!, dimensions, isVideo, message);
    }

    if (isGhostAnimation && !isOpen && (prevMessage || prevAvatarOwner)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage || undefined);
    }
  }, [
    isGhostAnimation, isOpen, origin, prevOrigin, message, prevMessage, prevAvatarOwner,
    bestImageData, prevBestImageData, dimensions, isVideo, hasFooter,
  ]);

  const close = useCallback(() => {
    closeMediaViewer();
  }, [closeMediaViewer]);

  const handleFooterClick = useCallback(() => {
    close();

    if (IS_SINGLE_COLUMN_LAYOUT) {
      setTimeout(() => {
        toggleChatInfo(false, { forceSyncOnIOs: true });
        focusMessage({ chatId, threadId, messageId });
      }, ANIMATION_DURATION);
    } else {
      focusMessage({ chatId, threadId, messageId });
    }
  }, [close, chatId, threadId, focusMessage, toggleChatInfo, messageId]);

  const handleForward = useCallback(() => {
    openForwardMenu({
      fromChatId: chatId,
      messageIds: [messageId],
    });
  }, [openForwardMenu, chatId, messageId]);

  const selectMessage = useCallback((id?: number) => openMediaViewer({
    chatId,
    threadId,
    messageId: id,
    origin,
  }, {
    forceOnHeavyAnimation: true,
  }), [chatId, openMediaViewer, origin, threadId]);

  useEffect(() => (isOpen ? captureEscKeyListener(() => {
    close();
  }) : undefined), [close, isOpen]);

  useEffect(() => {
    if (isVideo && !isGif) {
      stopCurrentAudio();
    }
  }, [isGif, isVideo]);

  // Prevent refresh when rotating device to watch a video
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, [isOpen]);

  const getMessageId = useCallback((fromId?: number, direction?: number): number | undefined => {
    if (!fromId) return undefined;
    const index = messageIds.indexOf(fromId);
    if ((direction === -1 && index > 0) || (direction === 1 && index < messageIds.length - 1)) {
      return messageIds[index + direction];
    }
    return undefined;
  }, [messageIds]);

  const lang = useLang();

  useHistoryBack({
    isActive: isOpen,
    onBack: closeMediaViewer,
  });

  function renderSenderInfo() {
    return isAvatar ? (
      <SenderInfo
        key={avatarOwner!.id}
        chatId={avatarOwner!.id}
        isAvatar
      />
    ) : (
      <SenderInfo
        key={messageId}
        chatId={chatId}
        messageId={messageId}
      />
    );
  }

  return (
    <ShowTransition id="MediaViewer" isOpen={isOpen}>
      <div className="media-viewer-head" dir={lang.isRtl ? 'rtl' : undefined}>
        {IS_SINGLE_COLUMN_LAYOUT && (
          <Button
            className="media-viewer-close"
            round
            size="smaller"
            color="translucent-white"
            ariaLabel={lang('Close')}
            onClick={close}
          >
            <i className="icon-close" />
          </Button>
        )}
        <Transition activeKey={animationKey.current!} name={headerAnimation}>
          {renderSenderInfo()}
        </Transition>
        <MediaViewerActions
          mediaData={fullMediaBlobUrl || previewBlobUrl}
          isVideo={isVideo}
          message={message}
          fileName={fileName}
          canReport={canReport}
          onReport={openReportModal}
          onCloseMediaViewer={close}
          onForward={handleForward}
          zoomLevelChange={zoomLevelChange}
          setZoomLevelChange={setZoomLevelChange}
          isAvatar={isAvatar}
        />
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          subject="media"
          photo={avatarPhoto}
          chatId={avatarOwner?.id}
        />
      </div>
      <MediaViewerSlides
        messageId={messageId}
        getMessageId={getMessageId}
        chatId={chatId}
        isPhoto={isPhoto}
        isGif={isGif}
        threadId={threadId}
        avatarOwnerId={avatarOwner && avatarOwner.id}
        profilePhotoIndex={profilePhotoIndex}
        origin={origin}
        isOpen={isOpen}
        hasFooter={hasFooter}
        zoomLevelChange={zoomLevelChange}
        isActive
        isVideo={isVideo}
        animationLevel={animationLevel}
        onClose={close}
        selectMessage={selectMessage}
        onFooterClick={handleFooterClick}
      />
    </ShowTransition>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      chatId,
      threadId,
      messageId,
      avatarOwnerId,
      profilePhotoIndex,
      origin,
    } = global.mediaViewer;
    const {
      animationLevel,
    } = global.settings.byKey;

    let isChatWithSelf = !!chatId && selectIsChatWithSelf(global, chatId);

    if (origin === MediaViewerOrigin.SearchResult) {
      if (!(chatId && messageId)) {
        return { animationLevel };
      }

      const message = selectChatMessage(global, chatId, messageId);
      if (!message) {
        return { animationLevel };
      }

      return {
        chatId,
        messageId,
        senderId: message.senderId,
        isChatWithSelf,
        origin,
        message,
        animationLevel,
      };
    }

    if (avatarOwnerId) {
      const sender = selectUser(global, avatarOwnerId) || selectChat(global, avatarOwnerId);
      isChatWithSelf = selectIsChatWithSelf(global, avatarOwnerId);

      return {
        messageId: -1,
        senderId: avatarOwnerId,
        avatarOwner: sender,
        isChatWithSelf,
        profilePhotoIndex: profilePhotoIndex || 0,
        animationLevel,
        origin,
      };
    }

    if (!(chatId && threadId && messageId)) {
      return { animationLevel };
    }

    let message: ApiMessage | undefined;
    if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
      message = selectScheduledMessage(global, chatId, messageId);
    } else {
      message = selectChatMessage(global, chatId, messageId);
    }

    if (!message) {
      return { animationLevel };
    }

    let chatMessages: Record<number, ApiMessage> | undefined;

    if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
      chatMessages = selectScheduledMessages(global, chatId);
    } else {
      chatMessages = selectChatMessages(global, chatId);
    }
    let collectionIds: number[] | undefined;

    if (origin === MediaViewerOrigin.Inline || origin === MediaViewerOrigin.Album) {
      collectionIds = selectOutlyingIds(global, chatId, threadId) || selectListedIds(global, chatId, threadId);
    } else if (origin === MediaViewerOrigin.SharedMedia) {
      const currentSearch = selectCurrentMediaSearch(global);
      const { foundIds } = (currentSearch && currentSearch.resultsByType && currentSearch.resultsByType.media) || {};
      collectionIds = foundIds;
    }

    return {
      chatId,
      threadId,
      messageId,
      senderId: message.senderId,
      isChatWithSelf,
      origin,
      message,
      chatMessages,
      collectionIds,
      animationLevel,
    };
  },
)(MediaViewer));
