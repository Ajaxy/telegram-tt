import {
  useCallback, useEffect, useLayoutEffect,
  useRef, useSignal, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { PlaybackSource, ThreadId } from '../../../types';
import { ApiMediaFormat, MAIN_THREAD_ID } from '../../../api/types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getMediaFormat,
  getVideoMediaHash,
  hasMessageTtl,
  isMessageLocal,
} from '../../../global/helpers';
import { selectTabState } from '../../../global/selectors';
import {
  getPlaybackCapabilities, makeMessageTrackKeyFrom, selectCurrentTrackKey, selectPlaybackSource,
} from '../../../global/selectors/audioPlayer';
import { peek } from '../../../util/audioPlayback/mediaPool';
import * as playbackController from '../../../util/audioPlayback/playbackController';
import { registerRoundVideoContainer } from '../../../util/audioPlayback/roundVideoContainers';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dates/duration';
import { clamp } from '../../../util/math';
import safePlay from '../../../util/safePlay';
import stopEvent from '../../../util/stopEvent';
import { ROUND_VIDEO_DIMENSIONS_PX } from '../../common/helpers/mediaDimensions';

import useSelector from '../../../hooks/data/useSelector';
import useThumbnail from '../../../hooks/media/useThumbnail';
import { useThrottledSignal } from '../../../hooks/useAsyncResolvers';
import useAudioPlayback from '../../../hooks/useAudioPlayback';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransition from '../../../hooks/useShowTransition';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';
import Button from '../../ui/Button';
import OptimizedVideo from '../../ui/OptimizedVideo';
import ProgressSpinner from '../../ui/ProgressSpinner';
import MediaBadge from './MediaBadge';

import './RoundVideo.scss';
import styles from './media.module.scss';

type OwnProps = {
  message: ApiMessage;
  threadId?: ThreadId;
  isInScheduled?: boolean;
  className?: string;
  canAutoLoad?: boolean;
  isDownloading?: boolean;
  origin?: 'oneTimeModal';
  observeIntersection?: ObserveFn;
  onStop?: NoneToVoidFunction;
  onReadMedia?: NoneToVoidFunction;
  onHideTranscription?: (isHidden: boolean) => void;
  isTranscriptionError?: boolean;
  canTranscribe?: boolean;
  isTranscribed?: boolean;
  isTranscriptionHidden?: boolean;
  isTranscribing?: boolean;
};

const PROGRESS_CENTER = ROUND_VIDEO_DIMENSIONS_PX / 2;
const PROGRESS_MARGIN = 6;
const PROGRESS_CIRCUMFERENCE = (PROGRESS_CENTER - PROGRESS_MARGIN) * 2 * Math.PI;
const PROGRESS_THROTTLE = 16; // Min period needed for `playerEl.currentTime` to update
const FULL_TURN = Math.PI * 2;
const QUARTER_TURN = Math.PI / 2;
const PROGRESS_MIDPOINT = 0.5;
const SEEK_STEP = 5;
const SEEK_END_OFFSET = 0.01;
const SEEK_WRAP_THRESHOLD = 0.9;
const SINGLE_SOURCE: PlaybackSource = { type: 'single' };

type SeekPoint = {
  x: number;
  y: number;
};

type SeekState = {
  pointerId: number;
  point: SeekPoint;
  turns: number;
  progress: number;
  frameTime?: number;
};

const RoundVideo = ({
  message,
  threadId,
  isInScheduled,
  className,
  canAutoLoad,
  isDownloading,
  origin,
  observeIntersection,
  onStop,
  onReadMedia,
  isTranscriptionError,
  isTranscribed,
  canTranscribe,
  onHideTranscription,
  isTranscriptionHidden,
  isTranscribing,
}: OwnProps) => {
  const {
    cancelMediaDownload, openOneTimeMediaModal, transcribeAudio,
    openAudioPlayer,
  } = getActions();

  const lang = useLang();
  const ref = useRef<HTMLDivElement>();
  const playerRef = useRef<HTMLVideoElement>();
  const playbackContainerRef = useRef<HTMLDivElement>();
  const circleRef = useRef<SVGCircleElement>();
  const progressRef = useRef<HTMLDivElement>();
  const progressThumbRef = useRef<SVGCircleElement>();
  const seekStateRef = useRef<SeekState>();

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const video = message.content.video!;
  const isScheduled = isInScheduled || message.isScheduled;
  const trackKey = makeMessageTrackKeyFrom(message, isScheduled);
  const hasTtl = hasMessageTtl(message);
  const isCurrent = useSelector(useCallback(
    (global: GlobalState) => !hasTtl && selectCurrentTrackKey(global) === trackKey,
    [hasTtl, trackKey],
  ));
  const isSingle = useSelector(useCallback(
    (global: GlobalState) => isCurrent && selectPlaybackSource(global)?.type === 'single',
    [isCurrent],
  ));
  const isMuted = useSelector(useCallback(
    (global: GlobalState) => isCurrent && Boolean(selectTabState(global).audioPlayer.isMuted),
    [isCurrent],
  ));
  const isMediaUnread = message.isMediaUnread;

  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = Boolean((isLoadAllowed || isCurrent) && (isIntersecting || isCurrent));
  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    getVideoMediaHash(video, 'inline'),
    !shouldLoad,
    getMediaFormat(video, 'inline'),
  );
  const fullMediaData = video.blobUrl || mediaData;

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getVideoMediaHash(video, 'download'),
    !isDownloading,
    ApiMediaFormat.BlobUrl,
  );

  const [isPlayerReady, markPlayerReady] = useFlag();
  const isInOneTimeModal = origin === 'oneTimeModal';
  const shouldRenderSpoiler = hasTtl && !isInOneTimeModal;
  const thumbDataUri = useThumbnail(message);
  const hasThumb = Boolean(thumbDataUri);
  const noThumb = !hasThumb || isPlayerReady || shouldRenderSpoiler || isCurrent;
  const thumbRef = useBlurredMediaThumbRef(video, noThumb);
  useMediaTransition({ hasMediaData: !noThumb, ref: thumbRef });

  const isTransferring = (isLoadAllowed && !isPlayerReady) || isDownloading;
  const wasLoadDisabled = usePreviousDeprecated(isLoadAllowed) === false;

  const {
    ref: spinnerRef,
    shouldRender: shouldRenderSpinner,
  } = useShowTransition({
    isOpen: isTransferring,
    noMountTransition: wasLoadDisabled,
    withShouldRender: true,
  });

  const [isOneTimeActivated, setIsOneTimeActivated] = useState(false);
  const isActivated = hasTtl ? isOneTimeActivated : isCurrent;
  const [isOneTimePaused, markOneTimePaused, unmarkOneTimePaused] = useFlag();
  const [oneTimeCurrentTime, setOneTimeCurrentTime] = useState(0);

  const {
    isPlaying, playProgress, getFrameProgress, duration, previewProgress,
  } = useAudioPlayback({
    trackKey: isCurrent ? trackKey : undefined,
    mediaType: 'voice',
    isVideo: true,
    capabilities: getPlaybackCapabilities('message', { isSingle }),
    originalDuration: video.duration,
    withFrameProgress: true,
  });
  const isPaused = hasTtl ? isOneTimePaused : !isPlaying;
  const currentTime = hasTtl ? oneTimeCurrentTime : Math.floor(playProgress * duration);
  const canSeek = isActivated && isPaused && !hasTtl && !isDownloading;

  const {
    ref: playbackButtonRef,
    shouldRender: shouldRenderPlaybackButton,
  } = useShowTransition({
    isOpen: canSeek,
    withShouldRender: true,
  });

  const getPlayer = useLastCallback(() => {
    const element = !hasTtl && peek(trackKey);
    return element instanceof HTMLVideoElement ? element : playerRef.current!;
  });

  const [getOneTimeProgress, setOneTimeProgress] = useSignal(0);
  const getProgress = hasTtl ? getOneTimeProgress : getFrameProgress;
  const getThrottledProgress = useThrottledSignal(getProgress, PROGRESS_THROTTLE);

  useEffect(() => {
    if (!hasTtl || !isActivated || isPaused) {
      return;
    }

    const playerEl = getPlayer();
    if (Number.isFinite(playerEl.duration) && playerEl.duration > 0) {
      setOneTimeProgress(playerEl.currentTime / playerEl.duration);
    }
  }, [hasTtl, setOneTimeProgress, isActivated, isPaused, getThrottledProgress]);

  useLayoutEffect(() => {
    if (!isActivated || !circleRef.current) {
      return;
    }

    const progress = getThrottledProgress();
    const strokeDashOffset = PROGRESS_CIRCUMFERENCE - progress * PROGRESS_CIRCUMFERENCE;
    circleRef.current.setAttribute('stroke-dashoffset', strokeDashOffset.toString());
    const thumb = progressThumbRef.current;
    if (thumb) {
      const angle = progress * FULL_TURN - QUARTER_TURN;
      const radius = PROGRESS_CENTER - PROGRESS_MARGIN;
      thumb.setAttribute('cx', String(PROGRESS_CENTER + Math.cos(angle) * radius));
      thumb.setAttribute('cy', String(PROGRESS_CENTER + Math.sin(angle) * radius));
    }
  }, [isActivated, canSeek, getThrottledProgress]);

  // Seeking only after the previous frame is shown keeps frames updating while the pointer moves
  const seekFrame = useLastCallback(() => {
    requestMutation(() => {
      const seekState = seekStateRef.current;
      const playerEl = getPlayer();
      if (!seekState || playerEl.seeking || peek(trackKey) !== playerEl) return;

      const time = getSeekTime(playerEl, seekState.progress);
      if (time === seekState.frameTime) return;

      seekState.frameTime = time;
      playerEl.currentTime = time;
    });
  });

  const handleSeekFrame = useLastCallback(() => {
    const seekState = seekStateRef.current;
    if (!seekState) return;

    // Seek events report the shown frame, which lags behind the pointer
    previewProgress(seekState.progress);
    seekFrame();
  });

  useEffect(() => {
    if (!canSeek) return undefined;

    const progressEl = progressRef.current!;
    const playerEl = getPlayer();
    // Native listeners keep seeking away from message selection, swipe-to-reply and long press
    progressEl.addEventListener('touchstart', stopEvent, { passive: false });
    progressEl.addEventListener('mousedown', stopEvent);
    progressEl.addEventListener('dblclick', stopEvent);
    playerEl.addEventListener('seeking', handleSeekFrame);
    playerEl.addEventListener('seeked', handleSeekFrame);

    return () => {
      seekStateRef.current = undefined;
      progressEl.removeEventListener('touchstart', stopEvent);
      progressEl.removeEventListener('mousedown', stopEvent);
      progressEl.removeEventListener('dblclick', stopEvent);
      playerEl.removeEventListener('seeking', handleSeekFrame);
      playerEl.removeEventListener('seeked', handleSeekFrame);
    };
  }, [canSeek]);

  const shouldPlay = Boolean(fullMediaData && isIntersecting && (hasTtl || !isActivated));

  const stopPlaying = useLastCallback(() => {
    setIsOneTimeActivated(false);
    unmarkOneTimePaused();
    seekStateRef.current = undefined;
    setOneTimeProgress(0);
    const playerEl = playerRef.current;
    if (!playerEl) return;

    requestMutation(() => {
      if (playerRef.current !== playerEl) return;

      playerEl.muted = true;
      playerEl.loop = true;
      playerEl.playbackRate = 1;
      if (isIntersecting) safePlay(playerEl);
    });
  });

  useLayoutEffect(() => {
    if (hasTtl) return undefined;

    return registerRoundVideoContainer(trackKey, playbackContainerRef.current!);
  }, [hasTtl, trackKey]);

  useLayoutEffect(() => {
    if (isActivated) return;

    unmarkOneTimePaused();
    seekStateRef.current = undefined;
    setOneTimeProgress(0);
  }, [isActivated, setOneTimeProgress]);

  useLayoutEffect(() => {
    const playerEl = playerRef.current;
    if (hasTtl || !isActivated || !playerEl) return;

    // Rewind the covered preview in advance so it resumes from the first frame after playback
    playerEl.pause();
    playerEl.currentTime = 0;
  }, [hasTtl, isActivated, fullMediaData]);

  const togglePlaying = useLastCallback(() => {
    if (!hasTtl) {
      if (isActivated && playbackController.getState().trackKey === trackKey) {
        playbackController.togglePlayPause();
        return;
      }

      if (!fullMediaData) return;

      if (!isActivated) {
        playerRef.current!.pause();
      }

      let source = isActivated ? selectPlaybackSource(getGlobal()) : undefined;
      if (!isActivated || !source) {
        source = isScheduled || isMessageLocal(message) ? SINGLE_SOURCE : {
          type: 'chat', chatId: message.chatId, threadId: threadId ?? MAIN_THREAD_ID, mediaType: 'voice',
        };
      }
      if (!isActivated) {
        openAudioPlayer({
          item: {
            type: 'message', chatId: message.chatId, messageId: message.id,
            threadId: threadId ?? MAIN_THREAD_ID, isScheduled,
          },
          source,
        });
      }
      playbackController.playTrack(trackKey, fullMediaData, {
        mediaType: 'voice', isVideo: true, duration: video.duration,
        capabilities: getPlaybackCapabilities('message', { isSingle: source.type === 'single' }),
      });
      return;
    }

    const playerEl = getPlayer();
    if (isActivated) {
      if (playerEl.paused) {
        safePlay(playerEl);
        playbackController.stopCurrentAudio();
      } else {
        playerEl.pause();
      }
    } else {
      // Pause is a workaround for iOS Safari – otherwise it stops video after several frames
      playerEl.pause();
      playerEl.currentTime = 0;
      safePlay(playerEl);
      playbackController.stopCurrentAudio();
      setIsOneTimeActivated(true);
    }
  });

  const handleEnded = useLastCallback(() => {
    if (hasTtl) {
      (onStop ?? stopPlaying)();
    }
  });

  useEffect(() => {
    if (!isInOneTimeModal) {
      return;
    }
    togglePlaying();
  }, [isInOneTimeModal]);

  const handleClick = useLastCallback((event) => {
    if (event.target.closest('.transcribe-button')) {
      return;
    }

    if (!fullMediaData && !isCurrent) {
      setIsLoadAllowed((isAllowed) => !isAllowed);

      return;
    }

    if (isDownloading) {
      cancelMediaDownload({ media: video });
      return;
    }

    if (hasTtl && !isInOneTimeModal) {
      openOneTimeMediaModal({ message });
      onReadMedia?.();
      return;
    }

    togglePlaying();
  });

  useEffect(() => {
    if (hasTtl && onReadMedia && isMediaUnread && isActivated) {
      onReadMedia();
    }
  }, [hasTtl, isActivated, isMediaUnread, onReadMedia]);

  const handleTimeUpdate = useLastCallback(() => {
    if (seekStateRef.current) return;

    const playerEl = getPlayer();
    if (!Number.isFinite(playerEl.duration) || playerEl.duration <= 0) return;

    setOneTimeProgress(playerEl.currentTime / playerEl.duration);
    setOneTimeCurrentTime(Math.floor(playerEl.currentTime));
  });

  const handlePause = useLastCallback(() => {
    if (isActivated) markOneTimePaused();
  });

  const handleSeekStart = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const playerEl = getPlayer();
    if (!canSeek || e.button !== 0 || !e.isPrimary || seekStateRef.current
      || !Number.isFinite(playerEl.duration) || playerEl.duration <= 0) return;

    stopEvent(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getSeekPoint(e);
    const angle = getSeekAngle(point);
    const currentProgress = getProgress();
    // The top of the ring represents both ends; grab the one nearest the current position
    const turns = Math.abs(angle - currentProgress) > SEEK_WRAP_THRESHOLD ? Math.sign(currentProgress - angle) : 0;
    const progress = clamp(angle + turns, 0, 1);
    seekStateRef.current = {
      pointerId: e.pointerId, point, turns, progress,
    };
    previewProgress(progress);
    seekFrame();
  });

  const handleSeekMove = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const seekState = seekStateRef.current;
    if (!seekState || seekState.pointerId !== e.pointerId) return;

    stopEvent(e);
    const point = getSeekPoint(e);
    // Crossing the top past an end pins the progress there until the pointer crosses back
    if (isCrossingTop(seekState.point, point)) {
      seekState.turns = clamp(seekState.turns + (point.x < 0 ? -1 : 1), -1, 1);
    }
    seekState.point = point;
    seekState.progress = clamp(getSeekAngle(point) + seekState.turns, 0, 1);
    previewProgress(seekState.progress);
    seekFrame();
  });

  const handleSeekEnd = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const seekState = seekStateRef.current;
    if (!seekState || seekState.pointerId !== e.pointerId) return;

    handleSeekMove(e);
    seekStateRef.current = undefined;
    const playerEl = getPlayer();
    const time = getSeekTime(playerEl, seekState.progress);
    requestMutation(() => {
      if (peek(trackKey) !== playerEl) return;

      playerEl.currentTime = time;
    });
  });

  const handleSeekCancel = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (seekStateRef.current?.pointerId !== e.pointerId) return;

    seekStateRef.current = undefined;
    const playerEl = getPlayer();
    previewProgress(playerEl.currentTime / playerEl.duration);
  });

  const handleSeekKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canSeek || seekStateRef.current) return;

    const playerEl = getPlayer();
    if (!Number.isFinite(playerEl.duration) || playerEl.duration <= 0) return;

    let time: number;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        time = playerEl.currentTime - SEEK_STEP;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        time = playerEl.currentTime + SEEK_STEP;
        break;
      case 'Home':
        time = 0;
        break;
      case 'End':
        time = playerEl.duration;
        break;
      default:
        return;
    }
    stopEvent(e);
    time = clamp(time, 0, Math.max(0, playerEl.duration - SEEK_END_OFFSET));
    previewProgress(time / playerEl.duration);
    requestMutation(() => {
      if (peek(trackKey) !== playerEl) return;

      playerEl.currentTime = time;
    });
  });

  const handleTranscribe = useLastCallback(() => {
    transcribeAudio({ chatId: message.chatId, messageId: message.id });
  });

  function renderPlayWrapper() {
    return (
      <div className="play-wrapper">
        <Button
          color="dark"
          round
          size="smaller"
          className="play"
          nonInteractive
          iconName="play"
          iconClassName="play-icon"
        />
        <Icon name="view-once" className="view-once-icon" />
      </div>
    );
  }

  const handleButtonClick = useLastCallback(() => {
    if ((isTranscribed || isTranscriptionError) && onHideTranscription) {
      onHideTranscription(!isTranscriptionHidden);
    } else if (!isTranscribing) {
      handleTranscribe();
    }
  });

  return (
    <div
      ref={ref}
      className={buildClassName(
        'RoundVideo',
        'media-inner',
        isInOneTimeModal && 'non-interactive',
        className,
      )}
      onClick={handleClick}
    >
      {(fullMediaData || !hasTtl) && (
        <div className="video-wrapper">
          {shouldRenderSpoiler && (
            <MediaSpoiler
              isVisible
              thumbDataUri={thumbDataUri}
              width={ROUND_VIDEO_DIMENSIONS_PX}
              height={ROUND_VIDEO_DIMENSIONS_PX}
              className="media-spoiler"
            />
          )}
          {fullMediaData && (
            <OptimizedVideo
              canPlay={shouldPlay}
              ref={playerRef}
              src={fullMediaData}
              className="full-media"
              width={ROUND_VIDEO_DIMENSIONS_PX}
              height={ROUND_VIDEO_DIMENSIONS_PX}
              autoPlay={!shouldRenderSpoiler}
              disablePictureInPicture
              muted={!hasTtl || !isActivated}
              defaultMuted
              loop={!hasTtl || !isActivated}
              playsInline
              isPriority
              onEnded={hasTtl && isActivated ? handleEnded : undefined}
              onTimeUpdate={hasTtl && isActivated ? handleTimeUpdate : undefined}
              onPlay={hasTtl ? unmarkOneTimePaused : undefined}
              onPause={hasTtl ? handlePause : undefined}
              onReady={markPlayerReady}
            />
          )}
          {!hasTtl && <div ref={playbackContainerRef} className="round-video-host" />}
        </div>
      )}
      {!shouldRenderSpoiler && (
        <canvas
          ref={thumbRef}
          className="thumbnail"
          style={`width: ${ROUND_VIDEO_DIMENSIONS_PX}px; height: ${ROUND_VIDEO_DIMENSIONS_PX}px`}
        />
      )}
      <div
        ref={progressRef}
        className="progress"
        role={canSeek ? 'slider' : undefined}
        tabIndex={canSeek ? 0 : undefined}
        aria-label={canSeek ? lang('AttachVideoMessage') : undefined}
        aria-valuemin={canSeek ? 0 : undefined}
        aria-valuemax={canSeek ? video.duration : undefined}
        aria-valuenow={canSeek ? currentTime : undefined}
        aria-valuetext={canSeek ? formatMediaDuration(currentTime) : undefined}
        onPointerDown={handleSeekStart}
        onPointerMove={handleSeekMove}
        onPointerUp={handleSeekEnd}
        onPointerCancel={handleSeekCancel}
        onLostPointerCapture={handleSeekCancel}
        onKeyDown={handleSeekKeyDown}
        onClick={stopEvent}
      >
        {isActivated && (
          <svg width={ROUND_VIDEO_DIMENSIONS_PX} height={ROUND_VIDEO_DIMENSIONS_PX}>
            <circle
              ref={circleRef}
              cx={PROGRESS_CENTER}
              cy={PROGRESS_CENTER}
              r={PROGRESS_CENTER - PROGRESS_MARGIN}
              className="progress-circle"
              transform={`rotate(-90, ${PROGRESS_CENTER}, ${PROGRESS_CENTER})`}
              stroke-dasharray={PROGRESS_CIRCUMFERENCE}
              stroke-dashoffset={PROGRESS_CIRCUMFERENCE}
            />
            {canSeek && (
              <>
                <circle
                  className="progress-hit-area"
                  cx={PROGRESS_CENTER}
                  cy={PROGRESS_CENTER}
                  r={PROGRESS_CENTER - PROGRESS_MARGIN}
                />
                <circle ref={progressThumbRef} className="progress-thumb" r="4" />
              </>
            )}
          </svg>
        )}
      </div>
      {shouldRenderSpinner && (
        <div ref={spinnerRef} className={buildClassName('media-loading', styles.loading)}>
          <ProgressSpinner progress={isDownloading ? downloadProgress : loadProgress} />
        </div>
      )}
      {shouldRenderPlaybackButton && (
        // Button drops its transitions while pressed, so the fade runs on the wrapper
        <div ref={playbackButtonRef}>
          <Button
            className="playback-button"
            color="dark"
            round
            iconName="play"
            ariaLabel={lang('AccActionPlay')}
            noFastClick
            shouldStopPropagation
            onClick={togglePlaying}
          />
        </div>
      )}
      {shouldRenderSpoiler && !shouldRenderSpinner && renderPlayWrapper()}
      {!fullMediaData && !isLoadAllowed && !isCurrent && (
        <Icon name="download" className={buildClassName(styles.controlButton, styles.downloadButton)} />
      )}
      {!isInOneTimeModal && (
        <MediaBadge
          className={buildClassName(
            'message-media-duration', isMediaUnread && 'unread',
          )}
        >
          {isActivated ? formatMediaDuration(currentTime) : formatMediaDuration(video.duration)}
          {(!isActivated || isPaused || isMuted) && <Icon name="muted" className="muted-icon" />}
        </MediaBadge>
      )}
      {canTranscribe && (
        <Button
          onClick={handleButtonClick}
          className="transcribe-button"
        >
          {isTranscribed || isTranscriptionError ? <Icon name="down" /> : <Icon name="transcribe" />}
          {isTranscribing && (
            <svg viewBox="0 0 32 24" className="loading-svg">
              <rect
                className="loading-rect"
                fill="transparent"
                width="32"
                height="24"
                stroke-width="3"
                stroke-linejoin="round"
                rx="6"
                ry="6"
                stroke="white"
                stroke-dashoffset="1"
                stroke-dasharray="32,68"
              />
            </svg>
          )}
        </Button>
      )}
    </div>
  );
};

function getSeekPoint(e: React.PointerEvent<HTMLDivElement>): SeekPoint {
  const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
  return {
    x: (e.clientX - left) / width - PROGRESS_MIDPOINT,
    y: (e.clientY - top) / height - PROGRESS_MIDPOINT,
  };
}

function getSeekAngle({ x, y }: SeekPoint) {
  const angle = Math.atan2(x, -y) / FULL_TURN;
  return angle < 0 ? angle + 1 : angle;
}

function getSeekTime(playerEl: HTMLMediaElement, progress: number) {
  return Math.min(progress * playerEl.duration, Math.max(0, playerEl.duration - SEEK_END_OFFSET));
}

function isCrossingTop(from: SeekPoint, to: SeekPoint) {
  if ((from.x < 0) === (to.x < 0)) return false;

  // The segment between pointer events meets the vertical axis above the center
  return from.y - (from.x * (to.y - from.y)) / (to.x - from.x) < 0;
}

export default RoundVideo;
