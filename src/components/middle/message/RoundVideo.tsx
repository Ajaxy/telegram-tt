import React, {
  FC,
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';

import { ROUND_VIDEO_DIMENSIONS } from '../../common/helpers/mediaDimensions';
import { formatMediaDuration } from '../../../util/dateFormat';
import { getMessageMediaFormat, getMessageMediaHash } from '../../../modules/helpers';
import { ObserveFn, useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithDownloadProgress from '../../../hooks/useMediaWithDownloadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import useTransitionForMedia from '../../../hooks/useTransitionForMedia';
import usePrevious from '../../../hooks/usePrevious';
import useBuffering from '../../../hooks/useBuffering';
import buildClassName from '../../../util/buildClassName';
import { stopCurrentAudio } from '../../../util/audioPlayer';
import useHeavyAnimationCheckForVideo from '../../../hooks/useHeavyAnimationCheckForVideo';
import useVideoCleanup from '../../../hooks/useVideoCleanup';
import usePauseOnInactive from './hooks/usePauseOnInactive';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';
import safePlay from '../../../util/safePlay';
import { fastRaf } from '../../../util/schedulers';

import ProgressSpinner from '../../ui/ProgressSpinner';

import './RoundVideo.scss';

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  shouldAutoLoad?: boolean;
  shouldAutoPlay?: boolean;
  lastSyncTime?: number;
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
  shouldAutoLoad,
  shouldAutoPlay,
  lastSyncTime,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const playingProgressRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const playerRef = useRef<HTMLVideoElement>(null);

  const video = message.content.video!;

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isDownloadAllowed, setIsDownloadAllowed] = useState(shouldAutoLoad && shouldAutoPlay);
  const shouldDownload = Boolean(isDownloadAllowed && isIntersecting && lastSyncTime);
  const { mediaData, downloadProgress } = useMediaWithDownloadProgress(
    getMessageMediaHash(message, 'inline'),
    !shouldDownload,
    getMessageMediaFormat(message, 'inline'),
    lastSyncTime,
  );
  const thumbRef = useBlurredMediaThumbRef(message, mediaData);

  const { isBuffered, bufferingHandlers } = useBuffering();
  const isTransferring = isDownloadAllowed && !isBuffered;
  const wasDownloadDisabled = usePrevious(isDownloadAllowed) === false;
  const {
    shouldRender: shouldSpinnerRender,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring || !isBuffered, undefined, wasDownloadDisabled);
  const { shouldRenderThumb, transitionClassNames } = useTransitionForMedia(mediaData, 'slow');

  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!isActivated) {
      return;
    }

    const circumference = 94 * 2 * Math.PI;
    const strokeDashOffset = circumference - progress * circumference;

    const playerEl = playerRef.current!;
    const playingProgressEl = playingProgressRef.current!;
    const svgEl = playingProgressEl.firstElementChild;

    if (!svgEl) {
      playingProgressEl.innerHTML = `<svg width="200px" height="200px">
          <circle cx="100" cy="100" r="94" class="progress-circle" transform="rotate(-90, 100, 100)"
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

  useHeavyAnimationCheckForVideo(playerRef, shouldPlay);
  usePauseOnInactive(playerRef, Boolean(mediaData));
  useVideoCleanup(playerRef, [mediaData]);

  const handleClick = useCallback(() => {
    if (!mediaData) {
      setIsDownloadAllowed((isAllowed) => !isAllowed);

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
  }, [capturePlaying, isActivated, mediaData]);

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
      {(shouldRenderThumb || mediaData) && (
        <div className="thumbnail-wrapper">
          <canvas
            ref={thumbRef}
            className="thumbnail"
            // @ts-ignore teact feature
            style={`width: ${ROUND_VIDEO_DIMENSIONS}px; height: ${ROUND_VIDEO_DIMENSIONS}px`}
          />
        </div>
      )}
      {mediaData && (
        <div className="video-wrapper">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={playerRef}
            className={videoClassName}
            width={ROUND_VIDEO_DIMENSIONS}
            height={ROUND_VIDEO_DIMENSIONS}
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
          <ProgressSpinner progress={downloadProgress} />
        </div>
      )}
      {!mediaData && !isDownloadAllowed && (
        <i className="icon-large-play" />
      )}
      <div className="message-media-duration">
        {isActivated ? formatMediaDuration(playerRef.current!.currentTime) : formatMediaDuration(video.duration)}
        {(!isActivated || playerRef.current!.paused) && <i className="icon-muted-chat" />}
      </div>
    </div>
  );
};

export default RoundVideo;
