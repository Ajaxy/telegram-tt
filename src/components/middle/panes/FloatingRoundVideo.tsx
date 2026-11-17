import {
  memo, useEffect, useLayoutEffect, useRef,
} from '../../../lib/teact/teact';
import { addExtraClass, removeExtraClass, setExtraStyles } from '../../../lib/teact/teact-dom';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type {
  MessageList, PlaybackCapabilities, RoundVideoMode, ThreadId,
} from '../../../types';
import type { TrackKey } from '../../../util/audioPlayback/mediaPool';

import { ANIMATION_END_DELAY } from '../../../config';
import { requestForcedReflow, requestMutation, requestNextMutation } from '../../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface, selectCurrentMessageList, selectTabState } from '../../../global/selectors';
import {
  getPlaybackCapabilities, makeTrackKeyFromItem, selectPlaybackRoundVideo, selectPlaybackSource,
} from '../../../global/selectors/audioPlayer';
import { peek } from '../../../util/audioPlayback/mediaPool';
import { getProgressSignal } from '../../../util/audioPlayback/playbackController';
import {
  moveRoundVideoToContainer, registerFloatingRoundVideoContainer,
} from '../../../util/audioPlayback/roundVideoContainers';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import { formatMediaDuration } from '../../../util/dates/duration';
import { disableDirectTextInput, enableDirectTextInput } from '../../../util/directInputManager';
import stopEvent from '../../../util/stopEvent';
import { focusNextWithin } from '../../../util/trapFocus';

import useAudioPlayback from '../../../hooks/useAudioPlayback';
import useDerivedState from '../../../hooks/useDerivedState';
import useFlag from '../../../hooks/useFlag';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../../hooks/useLayoutEffectWithPrevDeps';
import useSyncEffectWithPrevDeps from '../../../hooks/useSyncEffectWithPrevDeps';
import useRoundVideoContainer from '../hooks/useRoundVideoContainer';
import useRoundVideoFloatPosition from '../hooks/useRoundVideoFloatPosition';
import useRoundVideoSeek, { getRingPoint } from '../hooks/useRoundVideoSeek';

import Button from '../../ui/Button';

import styles from './FloatingRoundVideo.module.scss';

type StateProps = {
  message?: ApiMessage;
  threadId?: ThreadId;
  isScheduled?: boolean;
  trackKey?: TrackKey;
  capabilities: PlaybackCapabilities;
  isSourceChat: boolean;
  currentMessageList?: MessageList;
  mode?: RoundVideoMode;
};

const PROGRESS_CENTER = 50;
const PROGRESS_RADIUS = 48;
const PROGRESS_CIRCUMFERENCE = PROGRESS_RADIUS * 2 * Math.PI;
const DOUBLE_TAP_DELAY = 300;
const CLOSE_ANIMATION_DURATION = 200;
const ZOOM_DURATION = 200;

function FloatingRoundVideo({
  message, threadId, isScheduled, trackKey, capabilities, isSourceChat, currentMessageList, mode,
}: StateProps) {
  const { closeAudioPlayer, focusMessage, setRoundVideoMode } = getActions();
  const lang = useLang();
  const ref = useRef<HTMLDivElement>();
  const surfaceRef = useRef<HTMLDivElement>();
  const progressRef = useRef<SVGCircleElement>();
  const seekRef = useRef<HTMLDivElement>();
  const thumbRef = useRef<SVGCircleElement>();
  const tapTimeoutRef = useRef<number>();
  const closeTimeoutRef = useRef<number>();
  const zoomTimeoutRef = useRef<number>();
  const zoomBackTimeoutRef = useRef<number>();
  const forceUpdate = useForceUpdate();
  const [isClosing, markClosing, unmarkClosing] = useFlag();
  const { inlineContainer, isVisibilityResolved } = useRoundVideoContainer(trackKey, isSourceChat);
  const element = trackKey ? peek(trackKey) : undefined;
  const videoElement = element instanceof HTMLVideoElement ? element : undefined;
  const isDetached = Boolean(mode);
  const isLarge = mode === 'large';

  // A detached circle returned to its visible message keeps floating until it lands there
  useSyncEffectWithPrevDeps(([prevMode, prevTrackKey]) => {
    if (!prevMode || mode || trackKey !== prevTrackKey || !inlineContainer
      || !selectCanAnimateInterface(getGlobal())) {
      return undefined;
    }

    zoomBackTimeoutRef.current = window.setTimeout(() => {
      zoomBackTimeoutRef.current = undefined;
      forceUpdate();
    }, ZOOM_DURATION + ANIMATION_END_DELAY);

    return () => {
      window.clearTimeout(zoomBackTimeoutRef.current);
      zoomBackTimeoutRef.current = undefined;
    };
  }, [mode, trackKey]);

  const isZoomingBack = zoomBackTimeoutRef.current !== undefined;
  const isFloating = Boolean(videoElement
    && (isDetached || isZoomingBack || (isVisibilityResolved && !inlineContainer)));
  const isExpanded = isFloating && isLarge;

  const duration = message?.content.video?.duration || 0;
  const { isPlaying, playPause, previewProgress } = useAudioPlayback({
    trackKey,
    mediaType: 'voice',
    isVideo: true,
    capabilities,
    src: videoElement?.getAttribute('src') || undefined,
    originalDuration: duration,
    noProgressUpdates: true,
  });
  const getProgress = getProgressSignal();
  const canSeek = isExpanded && !isPlaying && !isClosing;
  const currentTime = useDerivedState(
    () => (canSeek ? Math.floor(getProgress() * duration) : 0),
    [canSeek, getProgress, duration],
  );

  const {
    handleSeekStart, handleSeekMove, handleSeekEnd, handleSeekCancel, handleSeekKeyDown,
  } = useRoundVideoSeek({
    ref: seekRef, trackKey, canSeek, getProgress, previewProgress,
  });

  useLayoutEffect(() => registerFloatingRoundVideoContainer(surfaceRef.current!), []);

  const startZooming = useLastCallback(() => {
    const root = ref.current;
    if (!root) return;

    window.clearTimeout(zoomTimeoutRef.current);
    addExtraClass(root, styles.zooming);
    zoomTimeoutRef.current = window.setTimeout(() => {
      requestMutation(() => removeExtraClass(root, styles.zooming));
    }, ZOOM_DURATION + ANIMATION_END_DELAY);
  });

  // Grows the player out of the message circle, the way the media viewer opens a photo
  const zoomFrom = useLastCallback((origin: HTMLElement) => {
    requestForcedReflow(() => {
      const rect = origin.getBoundingClientRect();

      return () => {
        const root = ref.current;
        if (!root) return;

        setZoomOrigin(root, rect);
        addExtraClass(root, styles.zoomFrom);
        requestNextMutation(() => {
          removeExtraClass(root, styles.zoomFrom);
          startZooming();
        });
      };
    });
  });

  const zoomBack = useLastCallback(() => {
    const target = inlineContainer;
    if (!target) return;

    requestForcedReflow(() => {
      const rect = target.getBoundingClientRect();

      return () => {
        const root = ref.current;
        if (!root || zoomBackTimeoutRef.current === undefined) return;

        setZoomOrigin(root, rect);
        addExtraClass(root, styles.zoomBack);
        startZooming();
      };
    });
  });

  useLayoutEffect(() => {
    if (!isZoomingBack) return undefined;

    const root = ref.current!;
    zoomBack();
    return () => removeExtraClass(root, styles.zoomBack);
  }, [isZoomingBack, zoomBack]);

  // Runs before the video moves, while its parent still marks where the player is zoomed from
  useLayoutEffectWithPrevDeps(([prevIsLarge]) => {
    if (prevIsLarge === undefined || prevIsLarge === isLarge || !selectCanAnimateInterface(getGlobal())) return;

    const origin = videoElement?.parentElement;
    if (isLarge && origin?.isConnected && origin !== surfaceRef.current) {
      zoomFrom(origin);
    } else {
      startZooming();
    }
  }, [isLarge, videoElement, zoomFrom, startZooming]);

  useLayoutEffect(() => {
    if (!videoElement || (!isDetached && !isVisibilityResolved)) return;

    videoElement.classList.add(styles.video);
    const container = !isDetached && !isZoomingBack && inlineContainer?.isConnected
      ? inlineContainer : surfaceRef.current!;
    moveRoundVideoToContainer(videoElement, container);
  }, [videoElement, inlineContainer, isVisibilityResolved, isDetached, isZoomingBack]);

  useLayoutEffect(() => {
    if (!trackKey || !progressRef.current) return;

    const progress = getProgress();
    progressRef.current.setAttribute('stroke-dashoffset', String(PROGRESS_CIRCUMFERENCE * (1 - progress)));
    const thumb = thumbRef.current;
    if (thumb) {
      const { x, y } = getRingPoint(progress, PROGRESS_CENTER, PROGRESS_RADIUS);
      thumb.setAttribute('cx', String(x));
      thumb.setAttribute('cy', String(y));
    }
  }, [getProgress, trackKey, canSeek]);

  const handleClose = useLastCallback(() => {
    if (isClosing) return;

    cancelPendingTap();
    if (!selectCanAnimateInterface(getGlobal())) {
      closeAudioPlayer();
      return;
    }

    markClosing();
    closeTimeoutRef.current = window.setTimeout(() => closeAudioPlayer(), CLOSE_ANIMATION_DURATION);
  });
  const {
    handlePointerDown, handlePointerMove: movePointer, handlePointerUp, handlePointerCancel: cancelPointer,
  } = useRoundVideoFloatPosition(ref, isFloating, isLarge, currentMessageList, styles.snapping, handleClose);

  const handleMinimize = useLastCallback(() => {
    setRoundVideoMode({ mode: 'mini' });
  });

  const handleResize = useLastCallback(() => {
    cancelPendingTap();
    setRoundVideoMode({ mode: isLarge ? 'mini' : 'large' });
  });

  const handlePlaybackKey = useLastCallback((e: KeyboardEvent) => {
    // Focused controls keep their own activation
    if (e.target !== ref.current) return false;

    e.preventDefault();
    playPause();
    return true;
  });

  const handleTab = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    focusNextWithin(ref.current!, e.shiftKey);
    return true;
  });

  // Keeps keyboard input away from the composer behind the backdrop, the way a modal does
  useEffect(() => {
    if (!isExpanded) return undefined;

    disableDirectTextInput();
    ref.current!.focus();
    const releaseKeyboard = captureKeyboardListeners({
      onEsc: handleMinimize,
      onEnter: handlePlaybackKey,
      onSpace: handlePlaybackKey,
      onTab: handleTab,
    });

    return () => {
      releaseKeyboard();
      enableDirectTextInput();
    };
  }, [isExpanded]);

  useHistoryBack({
    isActive: isExpanded,
    onBack: handleMinimize,
  });

  useEffect(() => cancelPendingTap, [trackKey, isFloating, isLarge]);

  useEffect(() => () => {
    window.clearTimeout(closeTimeoutRef.current);
    unmarkClosing();
  }, [trackKey]);

  useEffect(() => () => window.clearTimeout(zoomTimeoutRef.current), []);

  const handlePointerMove = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (movePointer(e)) cancelPendingTap();
  });

  const handleRelease = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!handlePointerUp(e)) {
      cancelPendingTap();
      return;
    }

    if (tapTimeoutRef.current !== undefined) {
      cancelPendingTap();
      handleFocusMessage();
    } else {
      tapTimeoutRef.current = window.setTimeout(() => {
        tapTimeoutRef.current = undefined;
        playPause();
      }, DOUBLE_TAP_DELAY);
    }
  });

  const handlePointerCancel = useLastCallback(() => {
    cancelPendingTap();
    cancelPointer();
  });

  function cancelPendingTap() {
    window.clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = undefined;
  }

  const handleFocusMessage = useLastCallback(() => {
    if (!message) return;
    focusMessage({
      chatId: message.chatId, messageId: message.id, threadId,
      messageListType: isScheduled ? 'scheduled' : undefined,
    });
  });

  return (
    <>
      <div
        className={buildClassName(styles.backdrop, isExpanded && !isClosing && styles.backdropShown)}
        onClick={handleMinimize}
      />
      <div
        ref={ref}
        className={buildClassName(
          styles.floating,
          isFloating && styles.shown,
          isLarge && styles.large,
          isClosing && styles.closing,
        )}
        aria-hidden={!isFloating}
        tabIndex={isExpanded ? -1 : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handleRelease}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={cancelPointer}
        onClick={isLarge ? playPause : undefined}
        onContextMenu={stopEvent}
      >
        <div ref={surfaceRef} className={styles.surface} />
        <div
          ref={seekRef}
          className={styles.progress}
          role={canSeek ? 'slider' : undefined}
          tabIndex={canSeek ? 0 : undefined}
          aria-label={canSeek ? lang('AttachVideoMessage') : undefined}
          aria-valuemin={canSeek ? 0 : undefined}
          aria-valuemax={canSeek ? duration : undefined}
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
          <svg viewBox="0 0 100 100" className={styles.ring}>
            <circle
              ref={progressRef}
              className={styles.progressCircle}
              cx={PROGRESS_CENTER}
              cy={PROGRESS_CENTER}
              r={PROGRESS_RADIUS}
              transform={`rotate(-90, ${PROGRESS_CENTER}, ${PROGRESS_CENTER})`}
              stroke-dasharray={PROGRESS_CIRCUMFERENCE}
              stroke-dashoffset={PROGRESS_CIRCUMFERENCE}
            />
            {canSeek && (
              <>
                <circle className={styles.hitArea} cx={PROGRESS_CENTER} cy={PROGRESS_CENTER} r={PROGRESS_RADIUS} />
                <circle ref={thumbRef} className={styles.thumb} r="2" />
              </>
            )}
          </svg>
        </div>
        <Button
          className={buildClassName(styles.playbackButton, !isPlaying && styles.paused)}
          color="dark"
          round
          iconName={isPlaying ? 'pause' : 'play'}
          ariaLabel={lang(isPlaying ? 'AriaComposerPausePlayback' : 'AccActionPlay')}
          tabIndex={isFloating ? 0 : -1}
          noFastClick
          shouldStopPropagation
          onClick={playPause}
        />
        <Button
          className={buildClassName(styles.cornerButton, styles.resizeButton)}
          color="dark"
          size="tiny"
          round
          iconName={isLarge ? 'smallscreen' : 'fullscreen'}
          iconClassName={styles.cornerIcon}
          ariaLabel={lang(isLarge ? 'AccExitFullscreen' : 'AccSwitchToFullscreen')}
          tabIndex={isFloating ? 0 : -1}
          noFastClick
          shouldStopPropagation
          onClick={handleResize}
        />
        <Button
          className={buildClassName(styles.cornerButton, styles.closeButton)}
          color="dark"
          size="tiny"
          round
          iconName="close"
          iconClassName={styles.cornerIcon}
          ariaLabel={lang('AudioPlayerClose')}
          tabIndex={isFloating ? 0 : -1}
          noFastClick
          shouldStopPropagation
          onClick={handleClose}
        />
      </div>
    </>
  );
}

function setZoomOrigin(root: HTMLElement, { left, top, width }: DOMRect) {
  setExtraStyles(root, {
    '--round-video-origin-x': `${left}px`,
    '--round-video-origin-y': `${top}px`,
    '--round-video-origin-size': `${width}px`,
  });
}

export default memo(withGlobal((global): Complete<StateProps> => {
  const item = selectTabState(global).audioPlayer.activeItem;
  const message = selectPlaybackRoundVideo(global, item);
  const isRoundVideo = item?.type === 'message' && message !== undefined;
  const currentList = selectCurrentMessageList(global);
  const threadId = item?.type === 'message' ? item.threadId : undefined;
  const isScheduled = item?.type === 'message' && Boolean(item.isScheduled);

  return {
    message: isRoundVideo ? message : undefined,
    threadId: isRoundVideo ? threadId : undefined,
    isScheduled: isRoundVideo ? isScheduled : undefined,
    trackKey: isRoundVideo ? makeTrackKeyFromItem(item) : undefined,
    capabilities: getPlaybackCapabilities('message', { isSingle: selectPlaybackSource(global)?.type === 'single' }),
    isSourceChat: Boolean(isRoundVideo && currentList?.chatId === message.chatId
      && currentList?.threadId === threadId
      && (currentList?.type === 'scheduled') === isScheduled),
    currentMessageList: isRoundVideo ? currentList : undefined,
    mode: isRoundVideo ? selectTabState(global).audioPlayer.roundVideoMode : undefined,
  };
})(FloatingRoundVideo));
