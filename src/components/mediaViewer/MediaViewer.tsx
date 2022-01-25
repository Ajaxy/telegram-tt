import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import {
  ApiChat, ApiDimensions, ApiMediaFormat, ApiMessage, ApiUser,
} from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';

import useBlurSync from '../../hooks/useBlurSync';
import useForceUpdate from '../../hooks/useForceUpdate';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import usePrevious from '../../hooks/usePrevious';
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
  getPhotoFullDimensions,
  getVideoDimensions,
  isMessageDocumentPhoto,
  isMessageDocumentVideo,
} from '../../modules/helpers';
import {
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectCurrentMediaSearch,
  selectListedIds,
  selectOutlyingIds,
  selectScheduledMessage,
  selectScheduledMessages,
  selectUser,
} from '../../modules/selectors';
import { stopCurrentAudio } from '../../util/audioPlayer';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { captureEvents } from '../../util/captureEvents';
import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';
import windowSize from '../../util/windowSize';
import { AVATAR_FULL_DIMENSIONS, MEDIA_VIEWER_MEDIA_QUERY } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';

import Button from '../ui/Button';
import ShowTransition from '../ui/ShowTransition';
import Transition from '../ui/Transition';
import MediaViewerActions from './MediaViewerActions';
import MediaViewerSlides from './MediaViewerSlides';
import PanZoom from './PanZoom';
import SenderInfo from './SenderInfo';
import SlideTransition from './SlideTransition';
import ZoomControls from './ZoomControls';

import './MediaViewer.scss';

type StateProps = {
  chatId?: string;
  threadId?: number;
  messageId?: number;
  senderId?: string;
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
  } = getDispatch();

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
  const isFirst = selectedMediaMessageIndex === 0 || selectedMediaMessageIndex === -1;
  const isLast = selectedMediaMessageIndex === messageIds.length - 1 || selectedMediaMessageIndex === -1;

  /* Animation */
  const animationKey = useRef<number>();
  const prevSenderId = usePrevious<string | undefined>(senderId);
  if (isOpen && (!prevSenderId || prevSenderId !== senderId || !animationKey.current)) {
    animationKey.current = selectedMediaMessageIndex;
  }
  const slideAnimation = animationLevel >= 1 && !IS_TOUCH_ENV ? 'mv-slide' : 'none';
  const headerAnimation = animationLevel === 2 ? 'slide-fade' : 'none';
  const isGhostAnimation = animationLevel === 2;

  /* Controls */
  const [canPanZoomWrap, setCanPanZoomWrap] = useState(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panDelta, setPanDelta] = useState({
    x: 0,
    y: 0,
  });

  /* Media data */
  function getMediaHash(isFull?: boolean) {
    if (isAvatar && profilePhotoIndex !== undefined) {
      const { photos } = avatarOwner!;
      return photos && photos[profilePhotoIndex]
        ? `photo${photos[profilePhotoIndex].id}?size=c`
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

  const localBlobUrl = (photo || video) ? (photo || video)!.blobUrl : undefined;
  let bestImageData = (!isVideo && (localBlobUrl || fullMediaBlobUrl)) || previewBlobUrl || pictogramBlobUrl;
  const thumbDataUri = useBlurSync(!bestImageData && message && getMessageMediaThumbDataUri(message));
  if (!bestImageData && origin !== MediaViewerOrigin.SearchResult) {
    bestImageData = thumbDataUri;
  }

  const fileName = message
    ? getMessageFileName(message)
    : isAvatar
      ? `avatar${avatarOwner!.id}-${profilePhotoIndex}.jpg`
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
    dimensions = AVATAR_FULL_DIMENSIONS;
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

  useEffect(() => {
    let timer: number | undefined;

    if (isZoomed) {
      setCanPanZoomWrap(true);
    } else {
      timer = window.setTimeout(() => {
        setCanPanZoomWrap(false);
      }, ANIMATION_DURATION);
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [isZoomed]);

  const closeZoom = () => {
    setIsZoomed(false);
    setZoomLevel(1);
    setPanDelta({
      x: 0,
      y: 0,
    });
  };

  const handleZoomToggle = useCallback(() => {
    setIsZoomed(!isZoomed);
    setZoomLevel(!isZoomed ? 1.5 : 1);
    if (isZoomed) {
      setPanDelta({
        x: 0,
        y: 0,
      });
    }
  }, [isZoomed]);

  const handleZoomValue = useCallback((level: number, canCloseZoom = false) => {
    setZoomLevel(level);
    if (level === 1 && canCloseZoom) {
      closeZoom();
    }
  }, []);

  const close = useCallback(() => {
    closeMediaViewer();
    closeZoom();
  }, [closeMediaViewer]);

  const handleFooterClick = useCallback(() => {
    close();
    focusMessage({
      chatId,
      threadId,
      messageId,
    });
  }, [close, chatId, threadId, focusMessage, messageId]);

  const handleForward = useCallback(() => {
    openForwardMenu({
      fromChatId: chatId,
      messageIds: [messageId],
    });
    closeZoom();
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
    if (isZoomed) {
      closeZoom();
    } else {
      close();
    }
  }) : undefined), [close, isOpen, isZoomed]);

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

  const nextMessageId = getMessageId(messageId, 1);
  const previousMessageId = getMessageId(messageId, -1);

  const handlePan = useCallback((x: number, y: number) => {
    setPanDelta({
      x,
      y,
    });
  }, []);

  const lang = useLang();

  useHistoryBack(isOpen, closeMediaViewer, openMediaViewer, {
    chatId,
    threadId,
    messageId,
    origin,
    avatarOwnerId: avatarOwner && avatarOwner.id,
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Left': // IE/Edge specific value
        case 'ArrowLeft':
          selectMessage(previousMessageId);
          break;

        case 'Right': // IE/Edge specific value
        case 'ArrowRight':
          selectMessage(nextMessageId);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown, false);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, false);
    };
  }, [isOpen, nextMessageId, previousMessageId, selectMessage]);

  useEffect(() => {
    if (isZoomed || IS_TOUCH_ENV) return undefined;
    const element = document.querySelector<HTMLDivElement>('.MediaViewerSlide--active');
    if (!element) {
      return undefined;
    }

    const shouldCloseOnVideo = isGif && !IS_IOS;

    return captureEvents(element, {
      // eslint-disable-next-line max-len
      excludedClosestSelector: `.backdrop, .navigation, .media-viewer-head, .media-viewer-footer${!shouldCloseOnVideo ? ', .VideoPlayer' : ''}`,
      onClick: close,
    });
  }, [close, isGif, isZoomed, messageId]);

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
    <ShowTransition
      id="MediaViewer"
      className={isZoomed ? 'zoomed' : ''}
      isOpen={isOpen}
    >
      {() => (
        <>
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
              {renderSenderInfo}
            </Transition>
            <MediaViewerActions
              mediaData={fullMediaBlobUrl || previewBlobUrl}
              isVideo={isVideo}
              isZoomed={isZoomed}
              message={message}
              fileName={fileName}
              onCloseMediaViewer={close}
              onForward={handleForward}
              onZoomToggle={handleZoomToggle}
              isAvatar={isAvatar}
            />
          </div>
          <PanZoom
            noWrap={!canPanZoomWrap}
            canPan={isZoomed}
            panDeltaX={panDelta.x}
            panDeltaY={panDelta.y}
            zoomLevel={zoomLevel}
            onPan={handlePan}
          >
            <SlideTransition
              activeKey={selectedMediaMessageIndex}
              name={slideAnimation}
            >
              {(isActive: boolean) => (
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
                  isZoomed={isZoomed}
                  isActive={isActive}
                  isVideo={isVideo}
                  animationLevel={animationLevel}
                  onClose={close}
                  selectMessage={selectMessage}
                  onFooterClick={handleFooterClick}
                />
              )}
            </SlideTransition>
          </PanZoom>
          {!isFirst && !IS_TOUCH_ENV && (
            <button
              type="button"
              className={`navigation prev ${isVideo && !isGif && 'inline'}`}
              aria-label={lang('AccDescrPrevious')}
              dir={lang.isRtl ? 'rtl' : undefined}
              onClick={() => selectMessage(previousMessageId)}
            />
          )}
          {!isLast && !IS_TOUCH_ENV && (
            <button
              type="button"
              className={`navigation next ${isVideo && !isGif && 'inline'}`}
              aria-label={lang('Next')}
              dir={lang.isRtl ? 'rtl' : undefined}
              onClick={() => selectMessage(nextMessageId)}
            />
          )}
          <ZoomControls
            isShown={isZoomed}
            onChangeZoom={handleZoomValue}
          />
        </>
      )}
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
        origin,
        message,
        animationLevel,
      };
    }

    if (avatarOwnerId) {
      const sender = selectUser(global, avatarOwnerId) || selectChat(global, avatarOwnerId);

      return {
        messageId: -1,
        senderId: avatarOwnerId,
        avatarOwner: sender,
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
      origin,
      message,
      chatMessages,
      collectionIds,
      animationLevel,
    };
  },
)(MediaViewer));
