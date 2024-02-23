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

import {
  getMessageMediaFormat, getMessageMediaHash, getMessageMediaThumbDataUri, hasMessageTtl,
} from '../../../global/helpers';
import { stopCurrentAudio } from '../../../util/audioPlayer';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dateFormat';
import safePlay from '../../../util/safePlay';
import { ROUND_VIDEO_DIMENSIONS_PX } from '../../common/helpers/mediaDimensions';

import { useThrottledSignal } from '../../../hooks/useAsyncResolvers';
import useFlag from '../../../hooks/useFlag';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useMediaTransition from '../../../hooks/useMediaTransition';
import useMediaWithLoadProgress from '../../../hooks/useMediaWithLoadProgress';
import usePrevious from '../../../hooks/usePrevious';
import useShowTransition from '../../../hooks/useShowTransition';
import useSignal from '../../../hooks/useSignal';
import useBlurredMediaThumbRef from './hooks/useBlurredMediaThumbRef';

import Icon from '../../common/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';
import Button from '../../ui/Button';
import OptimizedVideo from '../../ui/OptimizedVideo';
import ProgressSpinner from '../../ui/ProgressSpinner';

import './RoundVideo.scss';

type OwnProps = {
  message: ApiMessage;
  className?: string;
  canAutoLoad?: boolean;
  isDownloading?: boolean;
  origin?: 'oneTimeModal';
  observeIntersection?: ObserveFn;
  onStop?: NoneToVoidFunction;
  onReadMedia?: NoneToVoidFunction;
};

const PROGRESS_CENTER = ROUND_VIDEO_DIMENSIONS_PX / 2;
const PROGRESS_MARGIN = 6;
const PROGRESS_CIRCUMFERENCE = (PROGRESS_CENTER - PROGRESS_MARGIN) * 2 * Math.PI;
const PROGRESS_THROTTLE = 16; // Min period needed for `playerEl.currentTime` to update

let stopPrevious: NoneToVoidFunction;

const RoundVideo: FC<OwnProps> = ({
  message,
  className,
  canAutoLoad,
  isDownloading,
  origin,
  observeIntersection,
  onStop,
  onReadMedia,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const playerRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line no-null/no-null
  const circleRef = useRef<SVGCircleElement>(null);

  const video = message.content.video!;

  const { cancelMessageMediaDownload, openOneTimeMediaModal } = getActions();

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
  const hasTtl = hasMessageTtl(message);
  const isInOneTimeModal = origin === 'oneTimeModal';
  const shouldRenderSpoiler = hasTtl && !isInOneTimeModal;
  const hasThumb = Boolean(getMessageMediaThumbDataUri(message));
  const noThumb = !hasThumb || isPlayerReady || shouldRenderSpoiler;
  const thumbRef = useBlurredMediaThumbRef(message, noThumb);
  const thumbClassNames = useMediaTransition(!noThumb);
  const thumbDataUri = getMessageMediaThumbDataUri(message);
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

  const tooglePlaying = useLastCallback(() => {
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

  useEffect(() => {
    if (!isInOneTimeModal) {
      return;
    }
    tooglePlaying();
  }, [isInOneTimeModal]);

  const handleClick = useLastCallback(() => {
    if (!mediaData) {
      setIsLoadAllowed((isAllowed) => !isAllowed);

      return;
    }

    if (isDownloading) {
      cancelMessageMediaDownload({ message });
      return;
    }

    if (hasTtl && !isInOneTimeModal) {
      openOneTimeMediaModal({ message });
      onReadMedia?.();
      return;
    }

    tooglePlaying();
  });

  const handleTimeUpdate = useLastCallback((e: React.UIEvent<HTMLVideoElement>) => {
    const playerEl = e.currentTarget;
    setProgress(playerEl.currentTime / playerEl.duration);
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
        >
          <Icon name="play" />
        </Button>
        <Icon name="view-once" />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={buildClassName('RoundVideo', 'media-inner', isInOneTimeModal && 'non-interactive', className)}
      onClick={handleClick}
    >
      {mediaData && (
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
          <OptimizedVideo
            canPlay={shouldPlay}
            ref={playerRef}
            src={mediaData}
            className="full-media"
            width={ROUND_VIDEO_DIMENSIONS_PX}
            height={ROUND_VIDEO_DIMENSIONS_PX}
            autoPlay={!shouldRenderSpoiler}
            disablePictureInPicture
            muted={!isActivated}
            loop={!isActivated}
            playsInline
            onEnded={isActivated ? onStop ?? stopPlaying : undefined}
            onTimeUpdate={isActivated ? handleTimeUpdate : undefined}
            onReady={markPlayerReady}
          />
        </div>
      )}
      {!shouldRenderSpoiler && (
        <canvas
          ref={thumbRef}
          className={buildClassName('thumbnail', thumbClassNames)}
          style={`width: ${ROUND_VIDEO_DIMENSIONS_PX}px; height: ${ROUND_VIDEO_DIMENSIONS_PX}px`}
        />
      )}
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
      {shouldRenderSpoiler && !shouldSpinnerRender && renderPlayWrapper()}
      {!mediaData && !isLoadAllowed && (
        <i className="icon icon-download" />
      )}
      {!isInOneTimeModal && (
        <div className="message-media-duration">
          {isActivated ? formatMediaDuration(playerRef.current!.currentTime) : formatMediaDuration(video.duration)}
          {(!isActivated || playerRef.current!.paused) && <Icon name="muted" />}
        </div>
      )}
    </div>
  );
};

export default RoundVideo;
