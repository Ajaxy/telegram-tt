import type { FC } from '../../../lib/teact/teact';
import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { ApiMediaFormat } from '../../../api/types';
import { ROUND_VIDEO_DIMENSIONS_PX } from '../../common/helpers/mediaDimensions';
import { getMessageMediaFormat, getMessageMediaHash, getMessageMediaThumbDataUri } from '../../../global/helpers';
import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { stopCurrentAudio } from '../../../util/audioPlayer';
import safePlay from '../../../util/safePlay';

import useLastCallback from '../../../hooks/useLastCallback';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import useMediaTransition from '../../../hooks/useMediaTransition';
import usePrevious from '../../../hooks/usePrevious';
import useFlag from '../../../hooks/useFlag';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';
import useSignal from '../../../hooks/useSignal';
import { useThrottledSignal } from '../../../hooks/useAsyncResolvers';

import ProgressSpinner from '../../ui/ProgressSpinner';
import OptimizedVideo from '../../ui/OptimizedVideo';

import './RoundVideo.scss';

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  canAutoLoad?: boolean;
  isDownloading?: boolean;
};

const PROGRESS_CENTER = ROUND_VIDEO_DIMENSIONS_PX / 2;
const PROGRESS_MARGIN = 6;
const PROGRESS_CIRCUMFERENCE = (PROGRESS_CENTER - PROGRESS_MARGIN) * 2 * Math.PI;
const PROGRESS_THROTTLE = 16; // Min period needed for `playerEl.currentTime` to update

let stopPrevious: NoneToVoidFunction;

const RoundVideo: FC<OwnProps> = ({
  message,
  observeIntersection,
  canAutoLoad,
  isDownloading,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const playerRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line no-null/no-null
  const circleRef = useRef<SVGCircleElement>(null);

  const video = message.content.video!;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = Boolean(isLoadAllowed && isIntersecting);
  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'inline'),
    !shouldLoad,
    getMessageMediaFormat(message, 'inline'),
  );

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
    ApiMediaFormat.BlobUrl,
  );

  const [isPlayerReady, markPlayerReady] = useFlag();
  const hasThumb = Boolean(getMessageMediaThumbDataUri(message));
  const noThumb = !hasThumb || isPlayerReady;
  const thumbRef = useBlurredMediaThumbRef(message, noThumb);
  const thumbClassNames = useMediaTransition(!noThumb);

  const isTransferring = (isLoadAllowed && !isPlayerReady) || isDownloading;
  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;

  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring, undefined, wasLoadDisabled);

  const [isActivated, setIsActivated] = useState(false);

  const [getProgress, setProgress] = useSignal(0);
  const getThrottledProgress = useThrottledSignal(getProgress, PROGRESS_THROTTLE);

  useEffect(() => {
    if (!isActivated) {
      return;
    }

    const playerEl = playerRef.current!;
    setProgress(playerEl.currentTime / playerEl.duration);
  }, [setProgress, isActivated, getThrottledProgress]);

  useLayoutEffect(() => {
    if (!isActivated || !circleRef.current) {
      return;
    }

    const strokeDashOffset = PROGRESS_CIRCUMFERENCE - getThrottledProgress() * PROGRESS_CIRCUMFERENCE;
    circleRef.current.setAttribute('stroke-dashoffset', strokeDashOffset.toString());
  }, [isActivated, getThrottledProgress]);

  const shouldPlay = Boolean(mediaData && isIntersecting);

  const stopPlaying = useLastCallback(() => {
    if (!playerRef.current) {
      return;
    }

    setIsActivated(false);
    setProgress(0);
    safePlay(playerRef.current);
  });

  const capturePlaying = useLastCallback(() => {
    stopPrevious?.();
    stopPrevious = stopPlaying;
  });

  const handleClick = useLastCallback(() => {
    if (!mediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);

      return;
    }

    if (isDownloading) {
      getActions().cancelMessageMediaDownload({ message });
      return;
    }

    const playerEl = playerRef.current!;
    if (isActivated) {
      if (playerEl.paused) {
        safePlay(playerEl);
        stopCurrentAudio();
      } else {
        playerEl.pause();
      }
    } else {
      capturePlaying();
      // Pause is a workaround for iOS Safari – otherwise it stops video after several frames
      playerEl.pause();
      playerEl.currentTime = 0;
      safePlay(playerEl);
      stopCurrentAudio();

      setIsActivated(true);
    }
  });

  const handleTimeUpdate = useLastCallback((e: React.UIEvent<HTMLVideoElement>) => {
    const playerEl = e.currentTarget;

    setProgress(playerEl.currentTime / playerEl.duration);
  });

  return (
    <div
      ref={ref}
      className="RoundVideo media-inner"
      onClick={handleClick}
    >
      {mediaData && (
        <div className="video-wrapper">
          <OptimizedVideo
            canPlay={shouldPlay}
            ref={playerRef}
            src={mediaData}
            className="full-media"
            width={ROUND_VIDEO_DIMENSIONS_PX}
            height={ROUND_VIDEO_DIMENSIONS_PX}
            autoPlay
            disablePictureInPicture
            muted={!isActivated}
            loop={!isActivated}
            playsInline
            onEnded={isActivated ? stopPlaying : undefined}
            onTimeUpdate={isActivated ? handleTimeUpdate : undefined}
            onReady={markPlayerReady}
          />
        </div>
      )}
      <canvas
        ref={thumbRef}
        className={buildClassName('thumbnail', thumbClassNames)}
        style={`width: ${ROUND_VIDEO_DIMENSIONS_PX}px; height: ${ROUND_VIDEO_DIMENSIONS_PX}px`}
      />
      <div className="progress">
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
          </svg>
        )}
      </div>
      {shouldSpinnerRender && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={isDownloading ? downloadProgress : loadProgress} />
        </div>
      )}
      {!mediaData && !isLoadAllowed && (
        <i className="icon icon-download" />
      )}
      <div className="message-media-duration">
        {isActivated ? formatMediaDuration(playerRef.current!.currentTime) : formatMediaDuration(video.duration)}
        {(!isActivated || playerRef.current!.paused) && <i className="icon icon-muted" />}
      </div>
    </div>
  );
};

export default RoundVideo;
