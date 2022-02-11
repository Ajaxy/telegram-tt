import React, {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getDispatch } from '../../../lib/teact/teactn';

import { ApiMediaFormat, ApiMessage } from '../../../api/types';

import { ROUND_VIDEO_DIMENSIONS_PX } from '../../common/helpers/mediaDimensions';
import { getMessageMediaFormat, getMessageMediaHash } from '../../../modules/helpers';
import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { stopCurrentAudio } from '../../../util/audioPlayer';
import safePlay from '../../../util/safePlay';
import { fastRaf } from '../../../util/schedulers';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import useMediaTransition from '../../../hooks/useMediaTransition';
import usePrevious from '../../../hooks/usePrevious';
import useBuffering from '../../../hooks/useBuffering';
import useVideoCleanup from '../../../hooks/useVideoCleanup';
import useVideoAutoPause from './hooks/useVideoAutoPause';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './RoundVideo.scss';

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  canAutoLoad?: boolean;
  lastSyncTime?: number;
  isDownloading?: boolean;
};

let currentOnRelease: NoneToVoidFunction;

function createCapture(onRelease: NoneToVoidFunction) {
  return () => {
    if (currentOnRelease) {
      currentOnRelease();
    }

    currentOnRelease = onRelease;
  };
}

const RoundVideo: FC<OwnProps> = ({
  message,
  observeIntersection,
  canAutoLoad,
  lastSyncTime,
  isDownloading,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const playingProgressRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const playerRef = useRef<HTMLVideoElement>(null);

  const video = message.content.video!;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isLoadAllowed, setIsLoadAllowed] = useState(canAutoLoad);
  const shouldLoad = Boolean(isLoadAllowed && isIntersecting && lastSyncTime);
  const { mediaData, loadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'inline'),
    !shouldLoad,
    getMessageMediaFormat(message, 'inline'),
    lastSyncTime,
  );

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
    ApiMediaFormat.BlobUrl,
    lastSyncTime,
  );
  const thumbRef = useBlurredMediaThumbRef(message, mediaData);

  const { isBuffered, bufferingHandlers } = useBuffering();
  const isTransferring = (isLoadAllowed && !isBuffered) || isDownloading;
  const wasLoadDisabled = usePrevious(isLoadAllowed) === false;

  const transitionClassNames = useMediaTransition(mediaData);
  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring || !isBuffered, undefined, wasLoadDisabled);

  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!isActivated) {
      return;
    }

    const svgCenter = ROUND_VIDEO_DIMENSIONS_PX / 2;
    const svgMargin = 6;
    const circumference = (svgCenter - svgMargin) * 2 * Math.PI;
    const strokeDashOffset = circumference - progress * circumference;

    const playerEl = playerRef.current!;
    const playingProgressEl = playingProgressRef.current!;
    const svgEl = playingProgressEl.firstElementChild;

    if (!svgEl) {
      playingProgressEl.innerHTML = `
        <svg width="${ROUND_VIDEO_DIMENSIONS_PX}px" height="${ROUND_VIDEO_DIMENSIONS_PX}px">
          <circle cx="${svgCenter}" cy="${svgCenter}" r="${svgCenter - svgMargin}" class="progress-circle"
            transform="rotate(-90, ${svgCenter}, ${svgCenter})"
            stroke-dasharray="${circumference} ${circumference}"
            stroke-dashoffset="${circumference}"
          />
        </svg>`;
    } else {
      (svgEl.firstElementChild as SVGElement).setAttribute('stroke-dashoffset', strokeDashOffset.toString());
    }

    setProgress(playerEl.currentTime / playerEl.duration);
  }, [isActivated, progress]);

  const shouldPlay = Boolean(mediaData && isIntersecting);

  const stopPlaying = () => {
    setIsActivated(false);
    setProgress(0);
    safePlay(playerRef.current!);

    fastRaf(() => {
      playingProgressRef.current!.innerHTML = '';
    });
  };

  const capturePlaying = createCapture(stopPlaying);

  useEffect(() => {
    if (!playerRef.current) {
      return;
    }

    if (shouldPlay) {
      safePlay(playerRef.current);
    } else {
      playerRef.current.pause();
    }
  }, [shouldPlay]);

  useVideoAutoPause(playerRef, shouldPlay);
  useVideoCleanup(playerRef, [mediaData]);

  const handleClick = useCallback(() => {
    if (!mediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);

      return;
    }

    if (isDownloading) {
      getDispatch().cancelMessageMediaDownload({ message });
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
  }, [capturePlaying, isActivated, isDownloading, mediaData, message]);

  const handleTimeUpdate = useCallback((e: React.UIEvent<HTMLVideoElement>) => {
    const playerEl = e.currentTarget;

    setProgress(playerEl.currentTime / playerEl.duration);
  }, []);

  const videoClassName = buildClassName('full-media', transitionClassNames);

  return (
    <div
      ref={ref}
      className="RoundVideo media-inner"
      onClick={handleClick}
    >
      <div className="thumbnail-wrapper">
        <canvas
          ref={thumbRef}
          className="thumbnail"
          style={`width: ${ROUND_VIDEO_DIMENSIONS_PX}px; height: ${ROUND_VIDEO_DIMENSIONS_PX}px`}
        />
      </div>
      {mediaData && (
        <div className="video-wrapper">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={playerRef}
            className={videoClassName}
            width={ROUND_VIDEO_DIMENSIONS_PX}
            height={ROUND_VIDEO_DIMENSIONS_PX}
            autoPlay
            muted={!isActivated}
            loop={!isActivated}
            playsInline
            onEnded={isActivated ? stopPlaying : undefined}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...bufferingHandlers}
            onTimeUpdate={isActivated ? handleTimeUpdate : undefined}
          >
            <source src={mediaData} />
          </video>
        </div>
      )}
      <div className="progress" ref={playingProgressRef} />
      {shouldSpinnerRender && (
        <div className={`media-loading ${spinnerClassNames}`}>
          <ProgressSpinner progress={isDownloading ? downloadProgress : loadProgress} />
        </div>
      )}
      {!mediaData && !isLoadAllowed && (
        <i className="icon-download" />
      )}
      <div className="message-media-duration">
        {isActivated ? formatMediaDuration(playerRef.current!.currentTime) : formatMediaDuration(video.duration)}
        {(!isActivated || playerRef.current!.paused) && <i className="icon-muted" />}
      </div>
    </div>
  );
};

export default RoundVideo;
