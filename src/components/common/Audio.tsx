import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiAudio, ApiMessage, ApiVoice } from '../../api/types';
import type { BufferedRange } from '../../hooks/useBuffering';
import type { LangFn } from '../../hooks/useLang';
import type { ISettings } from '../../types';
import { ApiMediaFormat } from '../../api/types';
import { AudioOrigin } from '../../types';

import {
  getMediaDuration,
  getMediaTransferState,
  getMessageMediaFormat,
  getMessageMediaHash,
  getMessageWebPageAudio,
  hasMessageTtl,
  isMessageLocal,
  isOwnMessage,
} from '../../global/helpers';
import { makeTrackId } from '../../util/audioPlayer';
import buildClassName from '../../util/buildClassName';
import { captureEvents } from '../../util/captureEvents';
import { formatMediaDateTime, formatMediaDuration, formatPastTimeShort } from '../../util/dateFormat';
import { decodeWaveform, interpolateArray } from '../../util/waveform';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';
import { getFileSizeString } from './helpers/documentInfo';
import renderText from './helpers/renderText';
import { MAX_EMPTY_WAVEFORM_POINTS, renderWaveform } from './helpers/waveform';

import useAppLayout from '../../hooks/useAppLayout';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import useBuffering from '../../hooks/useBuffering';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../hooks/useShowTransition';

import Button from '../ui/Button';
import Link from '../ui/Link';
import ProgressSpinner from '../ui/ProgressSpinner';
import AnimatedIcon from './AnimatedIcon';
import Icon from './Icon';

import './Audio.scss';

type OwnProps = {
  theme: ISettings['theme'];
  message: ApiMessage;
  senderTitle?: string;
  uploadProgress?: number;
  origin: AudioOrigin;
  date?: number;
  noAvatars?: boolean;
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  isDownloading?: boolean;
  isTranscribing?: boolean;
  isTranscribed?: boolean;
  canDownload?: boolean;
  canTranscribe?: boolean;
  isTranscriptionHidden?: boolean;
  isTranscriptionError?: boolean;
  autoPlay?: boolean;
  onHideTranscription?: (isHidden: boolean) => void;
  onPlay?: (messageId: number, chatId: string) => void;
  onPause?: NoneToVoidFunction;
  onReadMedia?: () => void;
  onCancelUpload?: () => void;
  onDateClick?: (messageId: number, chatId: string) => void;
};

export const TINY_SCREEN_WIDTH_MQL = window.matchMedia('(max-width: 375px)');
export const WITH_AVATAR_TINY_SCREEN_WIDTH_MQL = window.matchMedia('(max-width: 410px)');
const AVG_VOICE_DURATION = 10;
// This is needed for browsers requiring user interaction before playing.
const PRELOAD = true;

const Audio: FC<OwnProps> = ({
  theme,
  message,
  senderTitle,
  uploadProgress,
  origin,
  date,
  noAvatars,
  className,
  isSelectable,
  isSelected,
  isDownloading,
  isTranscribing,
  isTranscriptionHidden,
  isTranscribed,
  isTranscriptionError,
  canDownload,
  canTranscribe,
  autoPlay,
  onHideTranscription,
  onPlay,
  onPause,
  onReadMedia,
  onCancelUpload,
  onDateClick,
}) => {
  const {
    cancelMessageMediaDownload, downloadMessageMedia, transcribeAudio, openOneTimeMediaModal,
  } = getActions();

  const {
    content: {
      audio: contentAudio, voice, video,
    }, isMediaUnread,
  } = message;
  const audio = contentAudio || getMessageWebPageAudio(message);
  const isVoice = Boolean(voice || video);
  const isSeeking = useRef<boolean>(false);
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const { isRtl } = lang;

  const { isMobile } = useAppLayout();
  const [isActivated, setIsActivated] = useState(false);
  const shouldLoad = isActivated || PRELOAD;
  const coverHash = getMessageMediaHash(message, 'pictogram');
  const coverBlobUrl = useMedia(coverHash, false, ApiMediaFormat.BlobUrl);
  const hasTtl = hasMessageTtl(message);
  const isInOneTimeModal = origin === AudioOrigin.OneTimeModal;
  const trackType = isVoice ? (hasTtl ? 'oneTimeVoice' : 'voice') : 'audio';

  const mediaData = useMedia(
    getMessageMediaHash(message, 'inline'),
    !shouldLoad,
    getMessageMediaFormat(message, 'inline'),
  );

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
    getMessageMediaFormat(message, 'download'),
  );

  const handleForcePlay = useLastCallback(() => {
    setIsActivated(true);
    onPlay?.(message.id, message.chatId);
  });

  const handleTrackChange = useLastCallback(() => {
    setIsActivated(false);
  });

  const {
    isBuffered, bufferedRanges, bufferingHandlers, checkBuffering,
  } = useBuffering();

  const noReset = isInOneTimeModal;
  const {
    isPlaying, playProgress, playPause, setCurrentTime, duration,
  } = useAudioPlayer(
    makeTrackId(message),
    getMediaDuration(message)!,
    trackType,
    mediaData,
    bufferingHandlers,
    undefined,
    checkBuffering,
    Boolean(isActivated || autoPlay),
    handleForcePlay,
    handleTrackChange,
    isMessageLocal(message) || hasTtl,
    undefined,
    onPause,
    noReset,
    hasTtl && !isInOneTimeModal,
  );

  const reversePlayProgress = 1 - playProgress;
  const isOwn = isOwnMessage(message);
  const isReverse = hasTtl && isInOneTimeModal;

  const waveformCanvasRef = useWaveformCanvas(
    theme,
    voice,
    (isMediaUnread && !isOwn && !isReverse) ? 1 : playProgress,
    isOwn,
    !noAvatars,
    isMobile,
    isReverse,
  );

  const withSeekline = isPlaying || (playProgress > 0 && playProgress < 1);

  useEffect(() => {
    setIsActivated(isPlaying);
  }, [isPlaying]);

  const isLoadingForPlaying = isActivated && !isBuffered;

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(
    message,
    uploadProgress || downloadProgress,
    isLoadingForPlaying || isDownloading,
    uploadProgress !== undefined,
  );

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring);

  const shouldRenderCross = shouldRenderSpinner && (isLoadingForPlaying || isUploading);

  const handleButtonClick = useLastCallback(() => {
    if (isUploading) {
      onCancelUpload?.();
      return;
    }

    if (hasTtl) {
      openOneTimeMediaModal({ message });
      onReadMedia?.();
      return;
    }

    if (!isPlaying) {
      onPlay?.(message.id, message.chatId);
    }

    getActions().setAudioPlayerOrigin({ origin });
    setIsActivated(!isActivated);
    playPause();
  });

  useEffect(() => {
    if (onReadMedia && isMediaUnread && (isPlaying || isDownloading)) {
      onReadMedia();
    }
  }, [isPlaying, isMediaUnread, onReadMedia, isDownloading]);

  const handleDownloadClick = useLastCallback(() => {
    if (isDownloading) {
      cancelMessageMediaDownload({ message });
    } else {
      downloadMessageMedia({ message });
    }
  });

  const handleSeek = useLastCallback((e: MouseEvent | TouchEvent) => {
    if (isSeeking.current && seekerRef.current) {
      const { width, left } = seekerRef.current.getBoundingClientRect();
      const clientX = e instanceof MouseEvent ? e.clientX : e.targetTouches[0].clientX;
      e.stopPropagation(); // Prevent Slide-to-Reply activation
      // Prevent track skipping while seeking near end
      setCurrentTime(Math.max(Math.min(duration * ((clientX - left) / width), duration - 0.1), 0.001));
    }
  });

  const handleStartSeek = useLastCallback((e: MouseEvent | TouchEvent) => {
    if (e instanceof MouseEvent && e.button === 2) return;
    isSeeking.current = true;
    handleSeek(e);
  });

  const handleStopSeek = useLastCallback(() => {
    isSeeking.current = false;
  });

  const handleDateClick = useLastCallback(() => {
    onDateClick!(message.id, message.chatId);
  });

  const handleTranscribe = useLastCallback(() => {
    transcribeAudio({ chatId: message.chatId, messageId: message.id });
  });

  useEffect(() => {
    if (!seekerRef.current || !withSeekline || isInOneTimeModal) return undefined;
    return captureEvents(seekerRef.current, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });
  }, [withSeekline, handleStartSeek, handleSeek, handleStopSeek, isInOneTimeModal]);

  function renderFirstLine() {
    if (isVoice) {
      return senderTitle || 'Voice';
    }

    const { title, fileName } = audio!;

    return title || fileName;
  }

  function renderSecondLine() {
    if (isVoice) {
      return (
        <div className="meta" dir={isRtl ? 'rtl' : undefined}>
          {formatMediaDuration((voice || video)!.duration)}
        </div>
      );
    }

    const { performer } = audio!;

    return (
      <div className="meta" dir={isRtl ? 'rtl' : undefined}>
        {formatMediaDuration(duration)}
        <span className="bullet">&bull;</span>
        {performer && <span className="performer" title={performer}>{renderText(performer)}</span>}
        {performer && senderTitle && <span className="bullet">&bull;</span>}
        {senderTitle && <span title={senderTitle}>{renderText(senderTitle)}</span>}
      </div>
    );
  }

  const fullClassName = buildClassName(
    'Audio',
    className,
    isInOneTimeModal && 'non-interactive',
    origin === AudioOrigin.Inline && 'inline',
    isOwn && origin === AudioOrigin.Inline && 'own',
    (origin === AudioOrigin.Search || origin === AudioOrigin.SharedMedia) && 'bigger',
    isSelected && 'audio-is-selected',
  );

  const buttonClassNames = ['toogle-play-wrapper'];
  if (shouldRenderCross) {
    buttonClassNames.push('loading');
  } else {
    buttonClassNames.push(isPlaying ? 'pause' : 'play');
  }

  const contentClassName = buildClassName('content', withSeekline && 'with-seekline');

  function renderWithTitle() {
    return (
      <div className={contentClassName}>
        <div className="content-row">
          <p className="title" dir="auto" title={renderFirstLine()}>{renderText(renderFirstLine())}</p>

          <div className="message-date">
            {Boolean(date) && (
              <Link
                className="date"
                onClick={handleDateClick}
              >
                {formatPastTimeShort(lang, date * 1000)}
              </Link>
            )}
          </div>
        </div>

        {withSeekline && (
          <div className="meta search-result" dir={isRtl ? 'rtl' : undefined}>
            <span className="duration with-seekline" dir="auto">
              {playProgress < 1 && `${formatMediaDuration(duration * playProgress, duration)}`}
            </span>
            {renderSeekline(playProgress, bufferedRanges, seekerRef)}
          </div>
        )}
        {!withSeekline && renderSecondLine()}
      </div>
    );
  }

  function renderTooglePlayWrapper() {
    return (
      <div className={buildClassName(...buttonClassNames)}>
        <Button
          round
          ripple={!isMobile}
          size="smaller"
          className="toggle-play"
          color={coverBlobUrl ? 'translucent-white' : 'primary'}
          ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
          onClick={handleButtonClick}
          isRtl={lang.isRtl}
          backgroundImage={coverBlobUrl}
          nonInteractive={isInOneTimeModal}
        >
          {!isInOneTimeModal && <Icon name="play" />}
          {!isInOneTimeModal && <Icon name="pause" />}
          {isInOneTimeModal && (
            <AnimatedIcon
              className="flame"
              tgsUrl={LOCAL_TGS_URLS.Flame}
              nonInteractive
              noLoop={false}
              size={40}
            />
          )}
        </Button>
        {hasTtl && !isInOneTimeModal && (
          <Icon name="view-once" />
        )}
      </div>
    );
  }

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : 'ltr'}>
      {isSelectable && (
        <div className="message-select-control">
          {isSelected && <i className="icon icon-select" />}
        </div>
      )}
      {renderTooglePlayWrapper()}
      {shouldRenderSpinner && (
        <div className={buildClassName('media-loading', spinnerClassNames, shouldRenderCross && 'interactive')}>
          <ProgressSpinner
            progress={transferProgress}
            transparent
            withColor
            size="m"
            onClick={shouldRenderCross ? handleButtonClick : undefined}
            noCross={!shouldRenderCross}
          />
        </div>
      )}
      {isInOneTimeModal && !shouldRenderSpinner && (
        <div className={buildClassName('media-loading')}>
          <ProgressSpinner
            progress={playProgress}
            transparent
            size="m"
            noCross
            rotationOffset={3 / 4}
          />
        </div>
      )}
      {audio && canDownload && !isUploading && (
        <Button
          round
          size="tiny"
          className="download-button"
          ariaLabel={isDownloading ? 'Cancel download' : 'Download'}
          onClick={handleDownloadClick}
        >
          <i className={buildClassName('icon', isDownloading ? 'icon-close' : 'icon-arrow-down')} />
        </Button>
      )}
      {origin === AudioOrigin.Search && renderWithTitle()}
      {origin !== AudioOrigin.Search && audio && renderAudio(
        lang,
        audio,
        duration,
        isPlaying,
        playProgress,
        bufferedRanges,
        seekerRef,
        (isDownloading || isUploading),
        date,
        transferProgress,
        onDateClick ? handleDateClick : undefined,
      )}
      {origin === AudioOrigin.SharedMedia && (voice || video) && renderWithTitle()}
      {(origin === AudioOrigin.Inline || isInOneTimeModal) && voice && (
        renderVoice(
          voice,
          seekerRef,
          waveformCanvasRef,
          hasTtl ? reversePlayProgress : playProgress,
          isMediaUnread,
          isTranscribing,
          isTranscriptionHidden,
          isTranscribed,
          isTranscriptionError,
          canTranscribe ? handleTranscribe : undefined,
          onHideTranscription,
          origin,
        )
      )}
    </div>
  );
};

function getSeeklineSpikeAmounts(isMobile?: boolean, withAvatar?: boolean) {
  return {
    MIN_SPIKES: isMobile ? (TINY_SCREEN_WIDTH_MQL.matches ? 16 : 20) : 25,
    MAX_SPIKES: isMobile
      ? (TINY_SCREEN_WIDTH_MQL.matches
        ? 35
        : (withAvatar && WITH_AVATAR_TINY_SCREEN_WIDTH_MQL.matches ? 40 : 45))
      : 75,
  };
}

function renderAudio(
  lang: LangFn,
  audio: ApiAudio,
  duration: number,
  isPlaying: boolean,
  playProgress: number,
  bufferedRanges: BufferedRange[],
  seekerRef: React.Ref<HTMLElement>,
  showProgress?: boolean,
  date?: number,
  progress?: number,
  handleDateClick?: NoneToVoidFunction,
) {
  const {
    title, performer, fileName,
  } = audio;
  const showSeekline = isPlaying || (playProgress > 0 && playProgress < 1);
  const { isRtl } = lang;

  return (
    <div className="content">
      <p className="title" dir="auto" title={title}>{renderText(title || fileName)}</p>
      {showSeekline && (
        <div className="meta" dir={isRtl ? 'rtl' : undefined}>
          <span className="duration with-seekline" dir="auto">
            {formatMediaDuration(duration * playProgress, duration)}
          </span>
          {renderSeekline(playProgress, bufferedRanges, seekerRef)}
        </div>
      )}
      {!showSeekline && showProgress && (
        <div className="meta" dir={isRtl ? 'rtl' : undefined}>
          {progress ? `${getFileSizeString(audio!.size * progress)} / ` : undefined}{getFileSizeString(audio!.size)}
        </div>
      )}
      {!showSeekline && !showProgress && (
        <div className="meta" dir={isRtl ? 'rtl' : undefined}>
          <span className="duration" dir="auto">{formatMediaDuration(duration)}</span>
          {performer && (
            <>
              <span className="bullet">&bull;</span>
              <span className="performer" dir="auto" title={performer}>{renderText(performer)}</span>
            </>
          )}
          {Boolean(date) && (
            <>
              <span className="bullet">&bull;</span>
              <Link className="date" onClick={handleDateClick}>
                {formatMediaDateTime(lang, date * 1000, true)}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function renderVoice(
  voice: ApiVoice,
  seekerRef: React.Ref<HTMLDivElement>,
  waveformCanvasRef: React.Ref<HTMLCanvasElement>,
  playProgress: number,
  isMediaUnread?: boolean,
  isTranscribing?: boolean,
  isTranscriptionHidden?: boolean,
  isTranscribed?: boolean,
  isTranscriptionError?: boolean,
  onClickTranscribe?: VoidFunction,
  onHideTranscription?: (isHidden: boolean) => void,
  origin?: AudioOrigin,
) {
  return (
    <div className="content">
      <div className="waveform-wrapper">
        <div
          className="waveform"
          draggable={false}
          ref={seekerRef}
        >
          <canvas ref={waveformCanvasRef} />
        </div>
        {onClickTranscribe && (
          // eslint-disable-next-line react/jsx-no-bind
          <Button onClick={() => {
            if ((isTranscribed || isTranscriptionError) && onHideTranscription) {
              onHideTranscription(!isTranscriptionHidden);
            } else if (!isTranscribing) {
              onClickTranscribe();
            }
          }}
          >
            <i className={buildClassName(
              'transcribe-icon',
              'icon',
              (isTranscribed || isTranscriptionError) ? 'icon-down' : 'icon-transcribe',
              (isTranscribed || isTranscriptionError) && !isTranscriptionHidden && 'transcribe-shown',
            )}
            />
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
                  stroke="var(--accent-color)"
                  stroke-dashoffset="1"
                  stroke-dasharray="32,68"
                />
              </svg>
            )}
          </Button>
        )}
      </div>
      <p
        className={buildClassName('voice-duration', origin !== AudioOrigin.OneTimeModal && isMediaUnread && 'unread')}
        dir="auto"
      >
        {playProgress === 0 || playProgress === 1
          ? formatMediaDuration(voice.duration) : formatMediaDuration(voice.duration * playProgress)}
      </p>
    </div>
  );
}

function useWaveformCanvas(
  theme: ISettings['theme'],
  voice?: ApiVoice,
  playProgress = 0,
  isOwn = false,
  withAvatar = false,
  isMobile = false,
  isReverse = false,
) {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: spikes, peak } = useMemo(() => {
    if (!voice) {
      return undefined;
    }

    const { waveform, duration } = voice;
    if (!waveform) {
      return {
        data: new Array(Math.min(duration, MAX_EMPTY_WAVEFORM_POINTS)).fill(0),
        peak: 0,
      };
    }

    const { MIN_SPIKES, MAX_SPIKES } = getSeeklineSpikeAmounts(isMobile, withAvatar);
    const durationFactor = Math.min(duration / AVG_VOICE_DURATION, 1);
    const spikesCount = Math.round(MIN_SPIKES + (MAX_SPIKES - MIN_SPIKES) * durationFactor);
    const decodedWaveform = decodeWaveform(new Uint8Array(waveform));

    return interpolateArray(decodedWaveform, spikesCount);
  }, [isMobile, voice, withAvatar]) || {};

  useLayoutEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !spikes || peak === undefined) {
      return;
    }

    const fillColor = theme === 'dark' ? '#494A78' : '#ADD3F7';
    const fillOwnColor = theme === 'dark' ? '#B7ABED' : '#AEDFA4';
    const progressFillColor = theme === 'dark' ? '#8774E1' : '#3390EC';
    const progressFillOwnColor = theme === 'dark' ? '#FFFFFF' : '#4FAE4E';

    const fillStyle = isOwn ? fillOwnColor : fillColor;
    const progressFillStyle = isOwn ? progressFillOwnColor : progressFillColor;

    renderWaveform(canvas, spikes, isReverse ? 1 - playProgress : playProgress, {
      peak,
      fillStyle,
      progressFillStyle,
    });
  }, [isOwn, peak, playProgress, spikes, theme, isReverse]);

  return canvasRef;
}

function renderSeekline(
  playProgress: number,
  bufferedRanges: BufferedRange[],
  seekerRef: React.Ref<HTMLElement>,
) {
  return (
    <div
      className="seekline"
      ref={seekerRef as React.Ref<HTMLDivElement>}
    >
      {bufferedRanges.map(({ start, end }) => (
        <div
          className="seekline-buffered-progress"
          style={`left: ${start * 100}%; right: ${100 - end * 100}%`}
        />
      ))}
      <span className="seekline-play-progress">
        <i
          className="seekline-play-progress-inner"
          style={`transform: translateX(${playProgress * 100}%)`}
        />
      </span>
      <span className="seekline-thumb">
        <i
          className="seekline-thumb-inner"
          style={`transform: translateX(${playProgress * 100}%)`}
        />
      </span>
    </div>
  );
}

export default memo(Audio);
