import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import {
  ApiChat, ApiMediaFormat, ApiMessage, ApiUser, ApiDimensions,
} from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';
import windowSize from '../../util/windowSize';
import {
  AVATAR_FULL_DIMENSIONS,
  MEDIA_VIEWER_MEDIA_QUERY,
  calculateMediaViewerDimensions,
} from '../common/helpers/mediaDimensions';
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
import {
  getChatAvatarHash,
  getChatMediaMessageIds,
  getMessageFileName,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessagePhoto,
  getMessageVideo,
  getMessageDocument,
  isMessageDocumentPhoto,
  isMessageDocumentVideo,
  getMessageWebPagePhoto,
  getMessageWebPageVideo,
  getPhotoFullDimensions,
  getVideoDimensions, getMessageFileSize,
} from '../../modules/helpers';
import { pick } from '../../util/iteratees';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { stopCurrentAudio } from '../../util/audioPlayer';
import useForceUpdate from '../../hooks/useForceUpdate';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useBlurSync from '../../hooks/useBlurSync';
import usePrevious from '../../hooks/usePrevious';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import { renderMessageText } from '../common/helpers/renderMessageText';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import Spinner from '../ui/Spinner';
import ShowTransition from '../ui/ShowTransition';
import Transition from '../ui/Transition';
import Button from '../ui/Button';
import SenderInfo from './SenderInfo';
import MediaViewerActions from './MediaViewerActions';
import MediaViewerFooter from './MediaViewerFooter';
import VideoPlayer from './VideoPlayer';
import ZoomControls from './ZoomControls';
import PanZoom from './PanZoom';

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

type DispatchProps = Pick<GlobalActions, 'openMediaViewer' | 'closeMediaViewer' | 'openForwardMenu' | 'focusMessage'>;

const ANIMATION_DURATION = 350;

const MediaViewer: FC<StateProps & DispatchProps> = ({
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
  openMediaViewer,
  closeMediaViewer,
  openForwardMenu,
  focusMessage,
  animationLevel,
}) => {
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
  const isPhoto = Boolean(!isVideo && (photo || webPagePhoto || isDocumentPhoto));
  const { isGif } = video || webPageVideo || {};
  const isAvatar = Boolean(avatarOwner);

  /* Navigation */
  const isSingleSlide = Boolean(webPagePhoto || webPageVideo);
  const messageIds = useMemo(() => {
    return isSingleSlide && messageId
      ? [messageId]
      : getChatMediaMessageIds(chatMessages || {}, collectionIds || [], isFromSharedMedia);
  }, [isSingleSlide, messageId, chatMessages, collectionIds, isFromSharedMedia]);

  const selectedMediaMessageIndex = messageId ? messageIds.indexOf(messageId) : -1;
  const isFirst = selectedMediaMessageIndex === 0 || selectedMediaMessageIndex === -1;
  const isLast = selectedMediaMessageIndex === messageIds.length - 1 || selectedMediaMessageIndex === -1;

  /* Animation */
  const animationKey = useRef<number>();
  const prevSenderId = usePrevious<string | undefined>(senderId);
  if (isOpen && (!prevSenderId || prevSenderId !== senderId || !animationKey.current)) {
    animationKey.current = selectedMediaMessageIndex;
  }
  const slideAnimation = animationLevel >= 1 ? 'mv-slide' : 'none';
  const headerAnimation = animationLevel === 2 ? 'slide-fade' : 'none';
  const isGhostAnimation = animationLevel === 2;

  /* Controls */
  const [isFooterHidden, setIsFooterHidden] = useState<boolean>(false);
  const [canPanZoomWrap, setCanPanZoomWrap] = useState(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panDelta, setPanDelta] = useState({ x: 0, y: 0 });

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
  const { mediaData: fullMediaBlobUrl, loadProgress } = useMediaWithLoadProgress(
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

  const videoSize = message ? getMessageFileSize(message) : undefined;
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
  useEffect(() => {
    if (isGhostAnimation && isOpen && !prevMessage && !prevAvatarOwner) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      const textParts = message ? renderMessageText(message) : undefined;
      const hasFooter = Boolean(textParts);
      animateOpening(hasFooter, origin!, bestImageData!, dimensions, isVideo, message);
    }

    if (isGhostAnimation && !isOpen && (prevMessage || prevAvatarOwner)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage || undefined);
    }
  }, [
    isGhostAnimation, isOpen, origin, prevOrigin, message, prevMessage, prevAvatarOwner,
    bestImageData, prevBestImageData, dimensions, isVideo,
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
    setPanDelta({ x: 0, y: 0 });
  };

  const handleZoomToggle = useCallback(() => {
    setIsZoomed(!isZoomed);
    setZoomLevel(!isZoomed ? 1.5 : 1);
    if (isZoomed) {
      setPanDelta({ x: 0, y: 0 });
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
    focusMessage({ chatId, threadId, messageId });
  }, [close, chatId, threadId, focusMessage, messageId]);

  const handleForward = useCallback(() => {
    openForwardMenu({ fromChatId: chatId, messageIds: [messageId] });
    closeZoom();
  }, [openForwardMenu, chatId, messageId]);

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

  const getMessageId = useCallback((fromId: number, direction: number): number => {
    let index = messageIds.indexOf(fromId);
    if ((direction === -1 && index > 0) || (direction === 1 && index < messageIds.length - 1)) {
      index += direction;
    }

    return messageIds[index];
  }, [messageIds]);

  const selectPreviousMedia = useCallback(() => {
    if (isFirst) {
      return;
    }

    openMediaViewer({
      chatId,
      threadId,
      messageId: messageId ? getMessageId(messageId, -1) : undefined,
      origin,
    });
  }, [chatId, threadId, getMessageId, isFirst, messageId, openMediaViewer, origin]);

  const selectNextMedia = useCallback(() => {
    if (isLast) {
      return;
    }

    openMediaViewer({
      chatId,
      threadId,
      messageId: messageId ? getMessageId(messageId, 1) : undefined,
      origin,
    });
  }, [chatId, threadId, getMessageId, isLast, messageId, openMediaViewer, origin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Left': // IE/Edge specific value
        case 'ArrowLeft':
          selectPreviousMedia();
          break;

        case 'Right': // IE/Edge specific value
        case 'ArrowRight':
          selectNextMedia();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown, false);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, false);
    };
  });

  // Support for swipe gestures and closing on click
  useEffect(() => {
    const element = document.querySelector<HTMLDivElement>('.slide-container > .active, .slide-container > .to');
    if (!element) {
      return undefined;
    }

    const shouldCloseOnVideo = isGif && !IS_IOS;

    return captureEvents(element, {
      // eslint-disable-next-line max-len
      excludedClosestSelector: `.backdrop, .navigation, .media-viewer-head, .media-viewer-footer${!shouldCloseOnVideo ? ', .VideoPlayer' : ''}`,
      onClick: () => {
        if (!isZoomed && !IS_TOUCH_ENV) {
          close();
        }
      },
      onSwipe: IS_TOUCH_ENV ? (e, direction) => {
        if (direction === SwipeDirection.Right) {
          selectPreviousMedia();
        } else if (direction === SwipeDirection.Left) {
          selectNextMedia();
        } else if (!(e.target && (e.target as HTMLElement).closest('.MediaViewerFooter'))) {
          close();
        }

        return true;
      } : undefined,
    });
  }, [close, isFooterHidden, isGif, isPhoto, isZoomed, selectNextMedia, selectPreviousMedia]);

  const handlePan = useCallback((x: number, y: number) => {
    setPanDelta({ x, y });
  }, []);

  const handleToggleFooterVisibility = useCallback(() => {
    if (IS_TOUCH_ENV && (isPhoto || isGif)) {
      setIsFooterHidden(!isFooterHidden);
    }
  }, [isFooterHidden, isGif, isPhoto]);

  const lang = useLang();

  useHistoryBack(isOpen, closeMediaViewer, openMediaViewer, {
    chatId,
    threadId,
    messageId,
    origin,
    avatarOwnerId: avatarOwner && avatarOwner.id,
  });

  function renderSlide(isActive: boolean) {
    if (isAvatar) {
      return (
        <div key={chatId} className="media-viewer-content">
          {renderPhoto(
            fullMediaBlobUrl || previewBlobUrl,
            calculateMediaViewerDimensions(AVATAR_FULL_DIMENSIONS, false),
            !IS_SINGLE_COLUMN_LAYOUT && !isZoomed,
          )}
        </div>
      );
    } else if (message) {
      const textParts = renderMessageText(message);
      const hasFooter = Boolean(textParts);

      return (
        <div
          key={messageId}
          className={`media-viewer-content ${hasFooter ? 'has-footer' : ''}`}
          onClick={handleToggleFooterVisibility}
        >
          {isPhoto && renderPhoto(
            localBlobUrl || fullMediaBlobUrl || previewBlobUrl || pictogramBlobUrl,
            message && calculateMediaViewerDimensions(dimensions!, hasFooter),
            !IS_SINGLE_COLUMN_LAYOUT && !isZoomed,
          )}
          {isVideo && (
            <VideoPlayer
              key={messageId}
              url={localBlobUrl || fullMediaBlobUrl}
              isGif={isGif}
              posterData={bestImageData}
              posterSize={message && calculateMediaViewerDimensions(dimensions!, hasFooter, true)}
              loadProgress={loadProgress}
              fileSize={videoSize!}
              isMediaViewerOpen={isOpen}
              noPlay={!isActive}
              onClose={close}
            />
          )}
          {textParts && (
            <MediaViewerFooter
              text={textParts}
              onClick={handleFooterClick}
              isHidden={isFooterHidden && (!isVideo || isGif)}
              isForVideo={isVideo && !isGif}
            />
          )}
        </div>
      );
    }

    return undefined;
  }

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
            <Transition
              className="slide-container"
              activeKey={selectedMediaMessageIndex}
              name={slideAnimation}
            >
              {renderSlide}
            </Transition>
          </PanZoom>
          {!isFirst && (
            <button
              type="button"
              className={`navigation prev ${isVideo && !isGif && 'inline'}`}
              aria-label={lang('AccDescrPrevious')}
              dir={lang.isRtl ? 'rtl' : undefined}
              onClick={selectPreviousMedia}
            />
          )}
          {!isLast && (
            <button
              type="button"
              className={`navigation next ${isVideo && !isGif && 'inline'}`}
              aria-label={lang('Next')}
              dir={lang.isRtl ? 'rtl' : undefined}
              onClick={selectNextMedia}
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

function renderPhoto(blobUrl?: string, imageSize?: ApiDimensions, canDrag?: boolean) {
  return blobUrl
    ? (
      <img
        src={blobUrl}
        alt=""
        // @ts-ignore teact feature
        style={imageSize ? `width: ${imageSize.width}px` : ''}
        draggable={Boolean(canDrag)}
      />
    )
    : (
      <div
        className="spinner-wrapper"
        // @ts-ignore teact feature
        style={imageSize ? `width: ${imageSize.width}px` : ''}
      >
        <Spinner color="white" />
      </div>
    );
}

export default memo(withGlobal(
  (global): StateProps => {
    const {
      chatId, threadId, messageId, avatarOwnerId, profilePhotoIndex, origin,
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openMediaViewer', 'closeMediaViewer', 'openForwardMenu', 'focusMessage',
  ]),
)(MediaViewer));
