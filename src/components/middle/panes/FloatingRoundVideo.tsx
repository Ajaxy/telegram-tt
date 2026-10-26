import {
  memo, useEffect, useLayoutEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { MessageList, PlaybackCapabilities, ThreadId } from '../../../types';
import type { TrackKey } from '../../../util/audioPlayback/mediaPool';

import { hasMessageTtl } from '../../../global/helpers';
import { selectCurrentMessageList, selectTabState } from '../../../global/selectors';
import {
  getPlaybackCapabilities, makeTrackKeyFromItem, selectPlaybackMessage, selectPlaybackSource,
} from '../../../global/selectors/audioPlayer';
import { peek } from '../../../util/audioPlayback/mediaPool';
import { getProgressSignal } from '../../../util/audioPlayback/playbackController';
import {
  moveRoundVideoToContainer, registerFloatingRoundVideoContainer,
} from '../../../util/audioPlayback/roundVideoContainers';
import buildClassName from '../../../util/buildClassName';
import stopEvent from '../../../util/stopEvent';

import useAudioPlayback from '../../../hooks/useAudioPlayback';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useRoundVideoContainer from '../hooks/useRoundVideoContainer';
import useRoundVideoFloatPosition from '../hooks/useRoundVideoFloatPosition';

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
};

const PROGRESS_RADIUS = 48;
const PROGRESS_CIRCUMFERENCE = PROGRESS_RADIUS * 2 * Math.PI;
const DOUBLE_TAP_DELAY = 300;

function FloatingRoundVideo({
  message, threadId, isScheduled, trackKey, capabilities, isSourceChat, currentMessageList,
}: StateProps) {
  const { closeAudioPlayer, focusMessage } = getActions();
  const lang = useLang();
  const ref = useRef<HTMLDivElement>();
  const surfaceRef = useRef<HTMLDivElement>();
  const progressRef = useRef<SVGCircleElement>();
  const tapTimeoutRef = useRef<number>();
  const { inlineContainer, isVisibilityResolved } = useRoundVideoContainer(trackKey, isSourceChat);
  const element = trackKey ? peek(trackKey) : undefined;
  const videoElement = element instanceof HTMLVideoElement ? element : undefined;
  const isFloating = Boolean(videoElement && isVisibilityResolved && !inlineContainer);

  const { isPlaying, playPause } = useAudioPlayback({
    trackKey,
    mediaType: 'voice',
    isVideo: true,
    capabilities,
    src: videoElement?.getAttribute('src') || undefined,
    originalDuration: message?.content.video?.duration || 0,
    noProgressUpdates: true,
  });
  const getProgress = getProgressSignal();

  useLayoutEffect(() => registerFloatingRoundVideoContainer(surfaceRef.current!), []);

  useLayoutEffect(() => {
    if (!videoElement || !isVisibilityResolved) return;

    videoElement.classList.add(styles.video);
    const container = inlineContainer?.isConnected ? inlineContainer : surfaceRef.current!;
    moveRoundVideoToContainer(videoElement, container);
  }, [videoElement, inlineContainer, isVisibilityResolved]);

  useLayoutEffect(() => {
    if (!trackKey || !progressRef.current) return;
    progressRef.current.setAttribute('stroke-dashoffset', String(PROGRESS_CIRCUMFERENCE * (1 - getProgress())));
  }, [getProgress, trackKey]);

  const handleClose = useLastCallback(() => {
    cancelPendingTap();
    closeAudioPlayer();
  });
  const {
    handlePointerDown, handlePointerMove: movePointer, handlePointerUp, handlePointerCancel: cancelPointer,
  } = useRoundVideoFloatPosition(ref, isFloating, currentMessageList, handleClose);

  useEffect(() => cancelPendingTap, [trackKey, isFloating]);

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
    <div
      ref={ref}
      className={buildClassName(styles.floating, isFloating && styles.shown)}
      aria-hidden={!isFloating}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleRelease}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={cancelPointer}
      onContextMenu={stopEvent}
    >
      <div ref={surfaceRef} className={styles.surface} />
      <svg viewBox="0 0 100 100" className={styles.progress}>
        <circle
          ref={progressRef}
          className={styles.progressCircle}
          cx="50"
          cy="50"
          r={PROGRESS_RADIUS}
          transform="rotate(-90, 50, 50)"
          stroke-dasharray={PROGRESS_CIRCUMFERENCE}
          stroke-dashoffset={PROGRESS_CIRCUMFERENCE}
        />
      </svg>
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
        className={styles.closeButton}
        color="dark"
        size="tiny"
        round
        iconName="close"
        ariaLabel={lang('AudioPlayerClose')}
        tabIndex={isFloating ? 0 : -1}
        noFastClick
        shouldStopPropagation
        onClick={handleClose}
      />
    </div>
  );
}

export default memo(withGlobal((global): Complete<StateProps> => {
  const item = selectTabState(global).audioPlayer.activeItem;
  const message = selectPlaybackMessage(global, item);
  const isRoundVideo = item?.type === 'message' && !item.documentId
    && message?.content.video?.isRound && !hasMessageTtl(message);
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
  };
})(FloatingRoundVideo));
