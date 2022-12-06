import type { FC } from '../../../lib/teact/teact';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';

import { ROUND_VIDEO_DIMENSIONS_PX } from '../../common/helpers/mediaDimensions';
import { getMessageMediaFormat, getMessageMediaHash, getMessageMediaThumbDataUri } from '../../../global/helpers';
import { formatMediaDuration } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import { stopCurrentAudio } from '../../../util/audioPlayer';
import safePlay from '../../../util/safePlay';
import { fastRaf } from '../../../util/schedulers';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../../hooks/useShowTransition';
import useMediaTransition from '../../../hooks/useMediaTransition';
import usePrevious from '../../../hooks/usePrevious';
import useFlag from '../../../hooks/useFlag';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import ProgressSpinner from '../../ui/ProgressSpinner';
import OptimizedVideo from '../../ui/OptimizedVideo';

import './RoundVideo.scss';

type OwnProps = {
  message: ApiMessage;
  observeIntersection: ObserveFn;
  canAutoLoad?: boolean;
  lastSyncTime?: number;
  isDownloading?: boolean;
};

let stopPrevious: NoneToVoidFunction;

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

  const stopPlaying = useCallback(() => {
    if (!playerRef.current) {
      return;
    }

    setIsActivated(false);
    setProgress(0);
    safePlay(playerRef.current);

    fastRaf(() => {
      playingProgressRef.current!.innerHTML = '';
    });
  }, []);

  const capturePlaying = useCallback(() => {
    stopPrevious?.();
    stopPrevious = stopPlaying;
  }, [stopPlaying]);

  const handleClick = useCallback(() => {
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
  }, [capturePlaying, isActivated, isDownloading, mediaData, message]);

  const handleTimeUpdate = useCallback((e: React.UIEvent<HTMLVideoElement>) => {
    const playerEl = e.currentTarget;

    setProgress(playerEl.currentTime / playerEl.duration);
  }, []);

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
