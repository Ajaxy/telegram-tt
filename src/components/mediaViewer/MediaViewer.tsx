import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import {
  ApiChat, ApiMediaFormat, ApiMessage, ApiUser,
} from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';
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
  getMessageMediaFilename,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessagePhoto,
  getMessageVideo,
  getMessageWebPagePhoto,
  getPhotoFullDimensions,
  getVideoDimensions,
  IDimensions,
} from '../../modules/helpers';
import { pick } from '../../util/iteratees';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { stopCurrentAudio } from '../../util/audioPlayer';
import useForceUpdate from '../../hooks/useForceUpdate';
import useMedia from '../../hooks/useMedia';
import useMediaWithDownloadProgress from '../../hooks/useMediaWithDownloadProgress';
import useBlurSync from '../../hooks/useBlurSync';
import usePrevious from '../../hooks/usePrevious';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import { renderMessageText } from '../common/helpers/renderMessageText';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';
import useLang from '../../hooks/useLang';

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
  chatId?: number;
  threadId?: number;
  messageId?: number;
  senderId?: number;
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
  // eslint-disable-next-line no-null/no-null
  const animationKey = useRef<number>(null);
  const isOpen = Boolean(avatarOwner || messageId);
  const webPagePhoto = message ? getMessageWebPagePhoto(message) : undefined;
  const photo = message ? getMessagePhoto(message) : undefined;
  const video = message ? getMessageVideo(message) : undefined;
  const isWebPagePhoto = Boolean(webPagePhoto);
  const isPhoto = Boolean(photo || webPagePhoto);
  const isVideo = Boolean(video);
  const isGif = video ? video.isGif : undefined;
  const isFromSharedMedia = origin === MediaViewerOrigin.SharedMedia;
  const isFromSearch = origin === MediaViewerOrigin.SearchResult;
  const slideAnimation = animationLevel >= 1 ? 'mv-slide' : 'none';
  const headerAnimation = animationLevel === 2 ? 'slide-fade' : 'none';
  const isGhostAnimation = animationLevel === 2;
  const fileName = avatarOwner
    ? `avatar${avatarOwner.id}-${profilePhotoIndex}.jpg`
    : message && getMessageMediaFilename(message);
  const prevSenderId = usePrevious<number | undefined>(senderId);
  const [canPanZoomWrap, setCanPanZoomWrap] = useState(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panDelta, setPanDelta] = useState({ x: 0, y: 0 });
  const [isFooterHidden, setIsFooterHidden] = useState<boolean>(false);

  const messageIds = useMemo(() => {
    return isWebPagePhoto && messageId
      ? [messageId]
      : getChatMediaMessageIds(chatMessages || {}, collectionIds || [], isFromSharedMedia);
  }, [isWebPagePhoto, messageId, chatMessages, collectionIds, isFromSharedMedia]);

  const selectedMediaMessageIndex = messageId ? messageIds.indexOf(messageId) : -1;
  const isFirst = selectedMediaMessageIndex === 0 || selectedMediaMessageIndex === -1;
  const isLast = selectedMediaMessageIndex === messageIds.length - 1 || selectedMediaMessageIndex === -1;
  if (isOpen && (!prevSenderId || prevSenderId !== senderId || !animationKey.current)) {
    animationKey.current = selectedMediaMessageIndex;
  }

  function getMediaHash(full?: boolean) {
    if (avatarOwner && profilePhotoIndex !== undefined) {
      const { photos } = avatarOwner;
      return photos && photos[profilePhotoIndex]
        ? `photo${photos[profilePhotoIndex].id}?size=c`
        : getChatAvatarHash(avatarOwner, full ? 'big' : 'normal');
    }

    return message && getMessageMediaHash(message, full ? 'viewerFull' : 'viewerPreview');
  }

  const blobUrlPictogram = useMedia(
    message && (isFromSharedMedia || isFromSearch) && getMessageMediaHash(message, 'pictogram'),
    undefined,
    ApiMediaFormat.BlobUrl,
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const previewMediaHash = getMediaHash();
  const blobUrlPreview = useMedia(
    previewMediaHash,
    undefined,
    avatarOwner && previewMediaHash && previewMediaHash.startsWith('profilePhoto')
      ? ApiMediaFormat.DataUri
      : ApiMediaFormat.BlobUrl,
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );
  const { mediaData: fullMediaData, downloadProgress } = useMediaWithDownloadProgress(
    getMediaHash(true),
    undefined,
    message && getMessageMediaFormat(message, 'viewerFull'),
    undefined,
    isGhostAnimation && ANIMATION_DURATION,
  );

  const localBlobUrl = (photo || video) ? (photo || video)!.blobUrl : undefined;
  let bestImageData = (!isVideo && (localBlobUrl || fullMediaData)) || blobUrlPreview || blobUrlPictogram;
  const thumbDataUri = useBlurSync(!bestImageData && message && getMessageMediaThumbDataUri(message));
  if (!bestImageData && origin !== MediaViewerOrigin.SearchResult) {
    bestImageData = thumbDataUri;
  }

  const photoDimensions = isPhoto ? getPhotoFullDimensions((
    isWebPagePhoto ? getMessageWebPagePhoto(message!) : getMessagePhoto(message!)
  )!) : undefined;
  const videoDimensions = isVideo ? getVideoDimensions(getMessageVideo(message!)!) : undefined;

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
      animateOpening(hasFooter, origin!, bestImageData!, message);
    }

    if (isGhostAnimation && !isOpen && (prevMessage || prevAvatarOwner)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage || undefined);
    }
  }, [
    isGhostAnimation, isOpen, origin, prevOrigin,
    message, prevMessage, prevAvatarOwner, bestImageData, prevBestImageData,
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

  function renderSlide(isActive: boolean) {
    if (avatarOwner) {
      return (
        <div key={chatId} className="media-viewer-content">
          {renderPhoto(
            fullMediaData || blobUrlPreview,
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
            localBlobUrl || fullMediaData || blobUrlPreview || blobUrlPictogram,
            message && calculateMediaViewerDimensions(photoDimensions!, hasFooter),
            !IS_SINGLE_COLUMN_LAYOUT && !isZoomed,
          )}
          {isVideo && (
            <VideoPlayer
              key={messageId}
              url={localBlobUrl || fullMediaData}
              isGif={isGif}
              posterData={bestImageData}
              posterSize={message && calculateMediaViewerDimensions(videoDimensions!, hasFooter, true)}
              downloadProgress={downloadProgress}
              fileSize={video!.size}
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
    return (
      <SenderInfo
        key={avatarOwner ? avatarOwner.id : messageId}
        chatId={avatarOwner ? avatarOwner.id : chatId}
        messageId={messageId}
        isAvatar={Boolean(avatarOwner)}
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
              mediaData={fullMediaData || blobUrlPreview}
              isVideo={isVideo}
              isZoomed={isZoomed}
              message={message}
              fileName={fileName}
              onCloseMediaViewer={close}
              onForward={handleForward}
              onZoomToggle={handleZoomToggle}
              isAvatar={Boolean(avatarOwner)}
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

function renderPhoto(blobUrl?: string, imageSize?: IDimensions, canDrag?: boolean) {
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
