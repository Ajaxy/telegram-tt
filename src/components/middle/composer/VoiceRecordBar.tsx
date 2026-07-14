import type { ElementRef } from '../../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../../lib/teact/teact';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import { formatVoiceRecordDuration } from '../../../util/dates/oldDateFormat';
import { oggToWav } from '../../../util/oggToWav';
import { fastRaf } from '../../../util/schedulers';
import LiveWaveformRenderer from '../../../util/voiceRecording/liveWaveformRenderer';

import useTimeout from '../../../hooks/schedulers/useTimeout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useResizeObserver from '../../../hooks/useResizeObserver';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';

import styles from './VoiceRecordBar.module.scss';

export type BarRecording = {
  getElapsedMs: () => number;
  getProfilePeaks: () => number[];
  // Voice recording (native recorder only): a playable OGG snapshot of everything captured so far
  getSnapshot?: () => Uint8Array;
  // Video-message recording only: a ready-made media element for re-watching
  getPlaybackMedia?: () => Promise<HTMLMediaElement>;
};

type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  recording: BarRecording;
  isPaused: boolean;
  isVideo?: boolean;
  canSendOneTimeMedia?: boolean;
  isViewOnceEnabled?: boolean;
  onPause: NoneToVoidFunction;
  onResume: NoneToVoidFunction;
  onCancel: NoneToVoidFunction;
  onToggleViewOnce: NoneToVoidFunction;
  subscribeToPeaks: (listener: (peak: number) => void) => NoneToVoidFunction;
};

const ICON_SWAP_ANIMATION_MS = 400;
const TIMER_UPDATE_THROTTLE_MS = 30;

const VoiceRecordBar = ({
  ref,
  recording,
  isPaused,
  isVideo,
  canSendOneTimeMedia,
  isViewOnceEnabled,
  onPause,
  onResume,
  onCancel,
  onToggleViewOnce,
  subscribeToPeaks,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const timerRef = useRef<HTMLSpanElement>();
  const rendererRef = useRef<LiveWaveformRenderer>();
  const audioRef = useRef<HTMLMediaElement>();
  const audioPromiseRef = useRef<Promise<HTMLMediaElement>>();
  const audioUrlRef = useRef<string>();
  const playbackLoopTokenRef = useRef(0);
  const playbackGenerationRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMounted, markMounted] = useFlag();
  useTimeout(markMounted, ICON_SWAP_ANIMATION_MS);

  const lang = useLang();
  const oldLang = useOldLang();

  const canReplay = Boolean(recording.getSnapshot || recording.getPlaybackMedia);

  const releasePlayback = useLastCallback(() => {
    playbackGenerationRef.current++;
    audioPromiseRef.current = undefined;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audioRef.current = undefined;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = undefined;
    }
    playbackLoopTokenRef.current++;
    setIsPlaying(false);
  });

  const ensurePlaybackAudio = useLastCallback(() => {
    if (!audioPromiseRef.current) {
      const audioPromise = createPlaybackAudio();
      audioPromiseRef.current = audioPromise;
      audioPromise.catch(() => {
        if (audioPromiseRef.current === audioPromise) {
          audioPromiseRef.current = undefined;
        }
      });
    }

    return audioPromiseRef.current;
  });

  const createPlaybackAudio = useLastCallback(async () => {
    const generation = playbackGenerationRef.current;

    let media: HTMLMediaElement;
    let url: string | undefined;
    if (isVideo) {
      media = await recording.getPlaybackMedia!();
    } else {
      const snapshot = recording.getSnapshot!();
      const wavBlob = await oggToWav(new Blob([snapshot.buffer as ArrayBuffer], { type: 'audio/ogg' }));
      url = URL.createObjectURL(wavBlob);
      media = new Audio(url);
    }

    if (generation !== playbackGenerationRef.current) {
      if (url) URL.revokeObjectURL(url);
      throw new Error('Recording playback is stale');
    }
    if (url) {
      audioUrlRef.current = url;
    }

    media.addEventListener('play', () => setIsPlaying(true));
    media.addEventListener('pause', () => setIsPlaying(false));
    media.addEventListener('ended', () => {
      setIsPlaying(false);
      rendererRef.current?.setProgress(1);
    });

    audioRef.current = media;
    return media;
  });

  const getPlaybackDuration = useLastCallback(() => {
    const mediaDuration = audioRef.current?.duration;
    return mediaDuration && Number.isFinite(mediaDuration) ? mediaDuration : recording.getElapsedMs() / 1000;
  });

  const startPlaybackLoop = useLastCallback(() => {
    const token = ++playbackLoopTokenRef.current;

    const tick = () => {
      if (token !== playbackLoopTokenRef.current) return;
      const audio = audioRef.current;
      if (!audio) return;

      const duration = getPlaybackDuration();
      if (duration) {
        rendererRef.current?.setProgress(audio.currentTime / duration);
      }
      updateTimerText(timerRef.current, audio.currentTime * 1000, true);

      if (!audio.paused) {
        fastRaf(tick);
      }
    };

    tick();
  });

  const handlePlayClick = useLastCallback(async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      return;
    }

    try {
      const audio = await ensurePlaybackAudio();
      await audio.play();
      startPlaybackLoop();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  const handleSeek = useLastCallback(async (progress: number) => {
    const audio = await ensurePlaybackAudio().catch((err): undefined => {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    });
    if (!audio) return;

    const applySeek = () => {
      audio.currentTime = progress * getPlaybackDuration();
      rendererRef.current?.setProgress(progress);
      updateTimerText(timerRef.current, audio.currentTime * 1000);
    };

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applySeek();
    } else {
      audio.addEventListener('loadedmetadata', applySeek, { once: true });
    }
  });

  // Space toggles recording pause/resume, or playback play/pause once a listening session has started
  const handleSpaceKey = useLastCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement | undefined;
    if (target?.closest('button, a, [role="button"]')) {
      return false;
    }

    const isTypingTarget = target
      && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      && (target.checkVisibility?.({ visibilityProperty: true, checkVisibilityCSS: true }) ?? true);
    if (isTypingTarget) {
      return false;
    }

    e.preventDefault();
    if (isPlaying) {
      audioRef.current?.pause();
    } else if (isPaused) {
      if (audioRef.current) {
        void handlePlayClick();
      } else {
        onResume();
      }
    } else {
      onPause();
    }
    return undefined;
  });

  useEffect(() => {
    return captureKeyboardListeners({ onSpace: handleSpaceKey });
  }, [handleSpaceKey]);

  useResizeObserver(canvasRef, (entry) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.handleResize(entry.contentRect.width, entry.contentRect.height);
    if (isPaused) {
      renderer.setPeaks(recording.getProfilePeaks());
    }
  });

  useEffect(() => {
    const renderer = new LiveWaveformRenderer(canvasRef.current!);
    renderer.onSeek = handleSeek;
    rendererRef.current = renderer;

    updateTimerText(timerRef.current, recording.getElapsedMs());

    const unsubscribe = subscribeToPeaks((peak) => renderer.pushPeak(peak));

    return () => {
      unsubscribe();
      renderer.destroy();
      rendererRef.current = undefined;
      releasePlayback();
    };
  }, [handleSeek, recording, releasePlayback, subscribeToPeaks]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (isPaused) {
      renderer.setPeaks(recording.getProfilePeaks());
      renderer.setSeekable(canReplay);
    } else {
      releasePlayback();
      renderer.setSeekable(false);
      renderer.setProgress(undefined);
    }
  }, [isPaused, recording, canReplay, releasePlayback]);

  useEffect(() => {
    if (isPaused) {
      updateTimerText(timerRef.current, recording.getElapsedMs());
      return undefined;
    }

    let isCancelled = false;
    const tick = () => {
      if (isCancelled) return;
      updateTimerText(timerRef.current, recording.getElapsedMs(), true);
      fastRaf(tick);
    };
    fastRaf(tick);

    return () => {
      isCancelled = true;
    };
  }, [recording, isPaused]);

  function renderControl() {
    return (
      <span className={styles.control}>
        {!isPaused ? (
          <Icon name="record-dot" className={styles.recordIndicator} />
        ) : canReplay && (
          <Button
            className={styles.playButton}
            round
            color="primary"
            ariaLabel={lang(isPlaying ? 'AriaComposerPausePlayback' : 'AriaComposerPlayVoice')}
            onClick={handlePlayClick}
          >
            <Icon
              name="record-play"
              className={buildClassName(styles.swapIcon, !isPlaying && styles.swapIconActive)}
            />
            <Icon name="pause" className={buildClassName(styles.swapIcon, isPlaying && styles.swapIconActive)} />
          </Button>
        )}
      </span>
    );
  }

  return (
    <div ref={ref} className={buildClassName(styles.root, isMounted && styles.mounted, 'voice-record-bar')}>
      <Button
        className={styles.sideButton}
        round
        color="translucent"
        ariaLabel={lang('AriaComposerCancelVoice')}
        onClick={onCancel}
      >
        <Icon name="delete" className={styles.deleteIcon} />
      </Button>
      <div className={styles.pill}>
        {renderControl()}
        <canvas ref={canvasRef} className={styles.waveform} />
        <span ref={timerRef} className={styles.timer} />
      </div>
      {canSendOneTimeMedia && (
        <Button
          className={buildClassName(styles.sideButton, isViewOnceEnabled && styles.viewOnceActive)}
          round
          color="translucent"
          ariaLabel={oldLang('Chat.PlayOnceVoiceMessageTooltip')}
          onClick={onToggleViewOnce}
        >
          <Icon
            name="view-once"
            className={buildClassName(styles.swapIcon, !isViewOnceEnabled && styles.swapIconActive)}
          />
          <Icon
            name="one-filled"
            className={buildClassName(styles.swapIcon, isViewOnceEnabled && styles.swapIconActive)}
          />
        </Button>
      )}
      <Button
        className={styles.sideButton}
        round
        color="translucent"
        ariaLabel={lang(isPaused
          ? (isVideo ? 'AriaComposerResumeVideo' : 'AriaComposerResumeVoice')
          : (isVideo ? 'AriaComposerPauseVideo' : 'AriaComposerPauseVoice'))}
        onClick={isPaused ? onResume : onPause}
      >
        <Icon name="pause-circle" className={buildClassName(styles.swapIcon, !isPaused && styles.swapIconActive)} />
        <Icon
          name={isVideo ? 'round-video' : 'microphone'}
          className={buildClassName(styles.swapIcon, isPaused && styles.swapIconActive)}
        />
      </Button>
    </div>
  );
};

const timerStateByElement = new WeakMap<HTMLElement, { lastUpdateAt: number; lastText: string }>();

function updateTimerText(el: HTMLElement | undefined, durationMs: number, isThrottled?: boolean) {
  if (!el) return;

  const state = timerStateByElement.get(el);
  const now = Date.now();
  if (isThrottled && state && now - state.lastUpdateAt < TIMER_UPDATE_THROTTLE_MS) return;

  const text = formatVoiceRecordDuration(durationMs);
  if (state?.lastText === text) return;

  timerStateByElement.set(el, { lastUpdateAt: now, lastText: text });
  requestMutation(() => {
    el.textContent = text;
  });
}

export default memo(VoiceRecordBar);
