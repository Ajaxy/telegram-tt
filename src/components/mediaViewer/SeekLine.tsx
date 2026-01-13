import { setExtraStyles } from '@teact/teact-dom';
import {
  memo, useEffect, useLayoutEffect,
  useRef, useSignal, useState,
} from '../../lib/teact/teact';

import type { BufferedRange } from '../../hooks/useBuffering';
import { ApiMediaFormat, type StoryboardInfo } from '../../api/types';

import { DEBUG } from '../../config';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getDocumentMediaHash } from '../../global/helpers';
import { animateNumber } from '../../util/animation';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { captureEvents } from '../../util/captureEvents';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import getPointerPosition from '../../util/events/getPointerPosition';
import { clamp, round } from '../../util/math';
import StoryboardParser from '../../util/media/StoryboardParser';

import { useThrottledSignal } from '../../hooks/useAsyncResolvers';
import useCurrentTimeSignal from '../../hooks/useCurrentTimeSignal';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useVideoWaitingSignal from './hooks/useVideoWaitingSignal';

import ShowTransition from '../ui/ShowTransition';

import styles from './SeekLine.module.scss';

type OwnProps = {
  storyboardInfo?: StoryboardInfo;
  duration: number;
  bufferedRanges: BufferedRange[];
  playbackRate: number;
  isActive?: boolean;
  isPlaying?: boolean;
  isReady: boolean;
  onSeek: (position: number) => void;
  onSeekStart: () => void;
};

const LOCK_TIMEOUT = 250;
let cancelAnimation: ReturnType<typeof animateNumber> | undefined;

const SeekLine = ({
  storyboardInfo,
  duration,
  bufferedRanges,
  isReady,
  playbackRate,
  isActive,
  isPlaying,
  onSeek,
  onSeekStart,
}: OwnProps) => {
  const seekerRef = useRef<HTMLDivElement>();
  const [getCurrentTimeSignal] = useCurrentTimeSignal();
  const [getIsWaiting] = useVideoWaitingSignal();
  const getCurrentTime = useThrottledSignal(getCurrentTimeSignal, LOCK_TIMEOUT);
  const [getSelectedTime, setSelectedTime] = useSignal(getCurrentTime());
  const [getPreviewOffset, setPreviewOffset] = useSignal(0);
  const [getPreviewTime, setPreviewTime] = useSignal(0);
  const isLockedRef = useRef<boolean>(false);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>();
  const previewRef = useRef<HTMLDivElement>();
  const progressRef = useRef<HTMLDivElement>();
  const previewTimeRef = useRef<HTMLDivElement>();
  const storyboardParser = useRef<StoryboardParser>();

  const storyboardHash = storyboardInfo && getDocumentMediaHash(storyboardInfo.storyboardFile, 'full');
  const storyboardMapHash = storyboardInfo && getDocumentMediaHash(storyboardInfo.storyboardMapFile, 'full');

  const storyboardUrl = useMedia(storyboardHash, !isReady);
  const storyboardMapData = useMedia(storyboardMapHash, !isReady, ApiMediaFormat.Text);

  useEffect(() => {
    setPreviewVisible(false);
  }, [isActive]);

  useEffect(() => {
    if (!storyboardMapData) return;
    try {
      storyboardParser.current = new StoryboardParser(storyboardMapData);
    } catch (error) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error(`Error parsing storyboard map data`, error, storyboardMapData);
      }
    }
  }, [storyboardMapData]);

  const setPreview = useLastCallback((time: number) => {
    const previewContainer = previewContainerRef.current;
    if (!storyboardParser.current || !previewContainer) return;
    const frame = storyboardParser.current.getNearestPreview(time);

    setPreviewTime(Math.floor(frame.time));

    requestMutation(() => {
      setExtraStyles(previewContainer, {
        backgroundPosition: `${-frame.left}px ${-frame.top}px`,
      });
    });
  });

  useEffect(() => {
    if (cancelAnimation) cancelAnimation();
    cancelAnimation = undefined;
    if (!isLockedRef.current && !isSeeking) {
      const time = getCurrentTime();
      const remaining = duration - time;
      cancelAnimation = animateNumber({
        from: time,
        to: duration,
        duration: (remaining * 1000) / playbackRate,
        onUpdate: setSelectedTime,
      });
    }
  }, [getCurrentTime, isSeeking, setSelectedTime, playbackRate, duration]);

  useEffect(() => {
    if (!isPlaying || getIsWaiting()) {
      if (cancelAnimation) cancelAnimation();
      cancelAnimation = undefined;
    }
  }, [isPlaying, getSelectedTime, getIsWaiting]);

  useEffect(() => {
    if (isPlaying) {
      if (cancelAnimation) cancelAnimation();
      cancelAnimation = undefined;
      const time = getCurrentTime();
      const remaining = duration - time;
      cancelAnimation = animateNumber({
        from: time,
        to: duration,
        duration: (remaining * 1000) / playbackRate,
        onUpdate: setSelectedTime,
      });
    }
    // eslint-disable-next-line
  }, [isPlaying, playbackRate, duration]);

  useLayoutEffect(() => {
    if (!progressRef.current) return;
    const progress = round((getSelectedTime() / duration) * 100, 2);
    progressRef.current.style.width = `${progress}%`;
  }, [getSelectedTime, duration]);

  useLayoutEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.style.left = `${getPreviewOffset()}px`;
  }, [getPreviewOffset]);

  useLayoutEffect(() => {
    if (!previewTimeRef.current) return;
    previewTimeRef.current.innerText = formatMediaDuration(getPreviewTime());
  }, [getPreviewTime]);

  useEffect(() => {
    if (!seekerRef.current || !isActive) return undefined;
    const seeker = seekerRef.current;
    let seekerSize = seeker.getBoundingClientRect();

    let time = 0;
    let offset = 0;

    const getPreviewProps = (e: MouseEvent | TouchEvent) => {
      const pageX = getPointerPosition(e).x;
      const t = clamp(duration * ((pageX - seekerSize.left) / seekerSize.width), 0, duration);
      if (!storyboardInfo) return [t, 0];
      if (!seekerSize.width) seekerSize = seeker.getBoundingClientRect();
      const preview = previewRef.current!;
      const o = clamp(
        pageX - seekerSize.left - preview.clientWidth / 2, -4, seekerSize.width - preview.clientWidth + 4,
      );
      return [t, o];
    };

    const stopAnimation = () => {
      if (cancelAnimation) cancelAnimation();
      cancelAnimation = undefined;
    };

    const handleSeek = (e: MouseEvent | TouchEvent) => {
      stopAnimation();
      setPreviewVisible(true);
      ([time, offset] = getPreviewProps(e));
      void setPreview(time);
      setPreviewOffset(offset);
      setSelectedTime(time);
    };

    const handleStartSeek = () => {
      stopAnimation();
      setPreviewVisible(true);
      setIsSeeking(true);
      onSeekStart();
    };

    const handleStopSeek = () => {
      stopAnimation();
      isLockedRef.current = true;
      setPreviewVisible(false);
      setIsSeeking(false);
      setSelectedTime(time);
      onSeek(time);
      // Prevent current time updates from overriding the selected time
      setTimeout(() => {
        isLockedRef.current = false;
      }, LOCK_TIMEOUT);
    };

    const cleanup = captureEvents(seeker, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });

    if (IS_TOUCH_ENV) {
      return cleanup;
    }

    const handleSeekMouseMove = (e: MouseEvent) => {
      setPreviewVisible(true);
      ([time, offset] = getPreviewProps(e));
      setPreviewOffset(offset);
      void setPreview(time);
    };

    const handleSeekMouseLeave = () => {
      setPreviewVisible(false);
    };

    seeker.addEventListener('mousemove', handleSeekMouseMove);
    seeker.addEventListener('mouseenter', handleSeekMouseMove);
    seeker.addEventListener('mouseleave', handleSeekMouseLeave);

    return () => {
      cleanup();
      seeker.removeEventListener('mousemove', handleSeekMouseMove);
      seeker.removeEventListener('mouseenter', handleSeekMouseMove);
      seeker.removeEventListener('mouseleave', handleSeekMouseLeave);
    };
  }, [
    duration, setPreview, isActive, onSeek, onSeekStart, setPreviewOffset, setSelectedTime, setIsSeeking,
    isPreviewVisible, playbackRate, storyboardInfo,
  ]);

  return (
    <div className={styles.container} ref={seekerRef}>
      {storyboardInfo && (
        <ShowTransition
          isOpen
          isHidden={!isPreviewVisible}
          className={styles.preview}
          style={`width: ${storyboardInfo.frameSize.width}px; height: ${storyboardInfo.frameSize.height}px`}
          ref={previewRef}
        >
          <div
            ref={previewContainerRef}
            style={buildStyle(
              `background-image: url(${storyboardUrl});`,
            )}
            className={styles.previewContainer}
          />
          <div className={styles.previewTime}>
            <span className={styles.previewTimeText} ref={previewTimeRef} />
          </div>
        </ShowTransition>
      )}
      <div className={styles.track}>
        {bufferedRanges.map(({
          start,
          end,
        }) => (
          <div
            key={`${start}-${end}`}
            className={styles.buffered}
            // @ts-ignore
            style={`left: ${start * 100}%; right: ${100 - end * 100}%`}
          />
        ))}
      </div>
      <div className={styles.track}>
        <div
          ref={progressRef}
          className={buildClassName(styles.played, isSeeking && styles.seeking)}
        />
      </div>
    </div>
  );
};

export default memo(SeekLine);
