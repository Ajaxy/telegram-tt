import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getDispatch } from '../../lib/teact/teactn';

import {
  ApiAudio, ApiMediaFormat, ApiMessage, ApiVoice,
} from '../../api/types';
import { AudioOrigin, ISettings } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { formatMediaDateTime, formatMediaDuration, formatPastTimeShort } from '../../util/dateFormat';
import {
  getMediaDuration,
  getMediaTransferState,
  getMessageMediaFormat,
  getMessageMediaHash,
  isMessageLocal,
  isOwnMessage,
} from '../../modules/helpers';
import { renderWaveformToDataUri } from './helpers/waveform';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';
import { getFileSizeString } from './helpers/documentInfo';
import { decodeWaveform, interpolateArray } from '../../util/waveform';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useShowTransition from '../../hooks/useShowTransition';
import useBuffering from '../../hooks/useBuffering';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import useLang, { LangFn } from '../../hooks/useLang';
import { captureEvents } from '../../util/captureEvents';
import useMedia from '../../hooks/useMedia';
import { makeTrackId } from '../../util/audioPlayer';
import { getTranslation } from '../../util/langProvider';

import Button from '../ui/Button';
import ProgressSpinner from '../ui/ProgressSpinner';
import Link from '../ui/Link';

import './Audio.scss';

type OwnProps = {
  theme: ISettings['theme'];
  message: ApiMessage;
  senderTitle?: string;
  uploadProgress?: number;
  origin: AudioOrigin;
  date?: number;
  lastSyncTime?: number;
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  isDownloading: boolean;
  onPlay: (messageId: number, chatId: number) => void;
  onReadMedia?: () => void;
  onCancelUpload?: () => void;
  onDateClick?: (messageId: number, chatId: number) => void;
};

const AVG_VOICE_DURATION = 10;
const MIN_SPIKES = IS_SINGLE_COLUMN_LAYOUT ? 20 : 25;
const MAX_SPIKES = IS_SINGLE_COLUMN_LAYOUT ? 50 : 75;
// This is needed for browsers requiring user interaction before playing.
const PRELOAD = true;

const Audio: FC<OwnProps> = ({
  theme,
  message,
  senderTitle,
  uploadProgress,
  origin,
  date,
  lastSyncTime,
  className,
  isSelectable,
  isSelected,
  isDownloading,
  onPlay,
  onReadMedia,
  onCancelUpload,
  onDateClick,
}) => {
  const { content: { audio, voice, video }, isMediaUnread } = message;
  const isVoice = Boolean(voice || video);
  const isSeeking = useRef<boolean>(false);
  const playStateBeforeSeeking = useRef<boolean>(false);
  // eslint-disable-next-line no-null/no-null
  const seekerRef = useRef<HTMLElement>(null);
  const lang = useLang();
  const { isRtl } = lang;
  const dispatch = getDispatch();

  const [isActivated, setIsActivated] = useState(false);
  const shouldLoad = (isActivated || PRELOAD) && lastSyncTime;
  const coverHash = getMessageMediaHash(message, 'pictogram');
  const coverBlobUrl = useMedia(coverHash, false, ApiMediaFormat.BlobUrl);

  const mediaData = useMedia(
    getMessageMediaHash(message, 'inline'),
    !shouldLoad,
    getMessageMediaFormat(message, 'inline'),
  );

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMessageMediaHash(message, 'download'),
    !isDownloading,
  );

  const handleForcePlay = useCallback(() => {
    setIsActivated(true);
    onPlay(message.id, message.chatId);
  }, [message, onPlay]);

  const handleTrackChange = useCallback(() => {
    setIsActivated(false);
  }, []);

  const {
    isBuffered, bufferedProgress, bufferingHandlers, checkBuffering,
  } = useBuffering();

  const {
    isPlaying, playProgress, playPause, play, pause, setCurrentTime, duration,
  } = useAudioPlayer(
    makeTrackId(message),
    getMediaDuration(message)!,
    isVoice ? 'voice' : 'audio',
    origin,
    mediaData,
    bufferingHandlers,
    undefined,
    checkBuffering,
    isActivated,
    handleForcePlay,
    handleTrackChange,
    isMessageLocal(message),
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
  );

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring);

  const shouldRenderCross = shouldRenderSpinner && (isLoadingForPlaying || isUploading);

  const handleButtonClick = useCallback(() => {
    if (isUploading) {
      onCancelUpload?.();
      return;
    }

    if (!isPlaying) {
      onPlay(message.id, message.chatId);
    }

    setIsActivated(!isActivated);
    playPause();
  }, [isPlaying, isUploading, message.id, message.chatId, onCancelUpload, onPlay, playPause, isActivated]);

  useEffect(() => {
    if (onReadMedia && isMediaUnread && (isPlaying || isDownloading)) {
      onReadMedia();
    }
  }, [isPlaying, isMediaUnread, onReadMedia, isDownloading]);

  const handleDownloadClick = useCallback(() => {
    if (isDownloading) {
      dispatch.cancelMessageMediaDownload({ message });
    } else {
      dispatch.downloadMessageMedia({ message });
    }
  }, [dispatch, isDownloading, message]);

  const handleSeek = useCallback((e: MouseEvent | TouchEvent) => {
    if (isSeeking.current && seekerRef.current) {
      const { width, left } = seekerRef.current.getBoundingClientRect();
      const clientX = e instanceof MouseEvent ? e.clientX : e.targetTouches[0].clientX;
      e.stopPropagation(); // Prevent Slide-to-Reply activation
      // Prevent track skipping while seeking near end
      setCurrentTime(Math.max(Math.min(duration * ((clientX - left) / width), duration - 0.1), 0.001));
    }
  }, [duration, setCurrentTime]);

  const handleStartSeek = useCallback((e: MouseEvent | TouchEvent) => {
    if (e instanceof MouseEvent && e.button === 2) return;
    isSeeking.current = true;
    playStateBeforeSeeking.current = isPlaying;
    pause();
    handleSeek(e);
  }, [handleSeek, pause, isPlaying]);

  const handleStopSeek = useCallback(() => {
    isSeeking.current = false;
    if (playStateBeforeSeeking.current) play();
  }, [play]);

  const handleDateClick = useCallback(() => {
    onDateClick!(message.id, message.chatId);
  }, [onDateClick, message.id, message.chatId]);

  useEffect(() => {
    if (!seekerRef.current || !withSeekline) return undefined;
    return captureEvents(seekerRef.current, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });
  }, [withSeekline, handleStartSeek, handleSeek, handleStopSeek]);

  function getFirstLine() {
    if (isVoice) {
      return senderTitle || 'Voice';
    }

    const { title, fileName } = audio!;

    return title || fileName;
  }

  function getSecondLine() {
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

  const isOwn = isOwnMessage(message);
  const renderedWaveform = useMemo(
    () => voice && renderWaveform(
      voice,
      (isMediaUnread && !isOwn) ? 1 : playProgress,
      isOwn,
      theme,
      seekerRef,
    ),
    [voice, isMediaUnread, isOwn, playProgress, theme],
  );

  const fullClassName = buildClassName(
    'Audio',
    className,
    isOwn && origin === AudioOrigin.Inline && 'own',
    (origin === AudioOrigin.Search || origin === AudioOrigin.SharedMedia) && 'bigger',
    isSelected && 'audio-is-selected',
  );

  const buttonClassNames = ['toggle-play'];
  if (shouldRenderCross) {
    buttonClassNames.push('loading');
  } else if (isPlaying) {
    buttonClassNames.push('pause');
  } else if (!isPlaying) {
    buttonClassNames.push('play');
  }

  const contentClassName = buildClassName('content', withSeekline && 'with-seekline');

  function renderWithTitle() {
    return (
      <>
        <div className={contentClassName}>
          <div className="content-row">
            <p className="title" dir="auto" title={getFirstLine()}>{renderText(getFirstLine())}</p>

            <div className="message-date">
              {date && (
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
              {renderSeekline(playProgress, bufferedProgress, seekerRef)}
            </div>
          )}
          {!withSeekline && getSecondLine()}
        </div>
      </>
    );
  }

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : 'ltr'}>
      {isSelectable && (
        <div className="message-select-control">
          {isSelected && <i className="icon-select" />}
        </div>
      )}
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        size="smaller"
        color={coverBlobUrl ? 'translucent-white' : 'primary'}
        className={buttonClassNames.join(' ')}
        ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        onClick={handleButtonClick}
        isRtl={lang.isRtl}
        backgroundImage={coverBlobUrl}
      >
        <i className="icon-play" />
        <i className="icon-pause" />
      </Button>
      {shouldRenderSpinner && (
        <div className={buildClassName('media-loading', spinnerClassNames, shouldRenderCross && 'interactive')}>
          <ProgressSpinner
            progress={transferProgress}
            transparent
            size="m"
            onClick={shouldRenderCross ? handleButtonClick : undefined}
            noCross={!shouldRenderCross}
          />
        </div>
      )}
      {audio && !isUploading && (
        <Button
          round
          size="tiny"
          className="download-button"
          ariaLabel={isDownloading ? 'Cancel download' : 'Download'}
          onClick={handleDownloadClick}
        >
          <i className={isDownloading ? 'icon-close' : 'icon-arrow-down'} />
        </Button>
      )}
      {origin === AudioOrigin.Search && renderWithTitle()}
      {origin !== AudioOrigin.Search && audio && renderAudio(
        lang, audio, duration, isPlaying, playProgress, bufferedProgress, seekerRef, (isDownloading || isUploading),
        date, transferProgress, onDateClick ? handleDateClick : undefined,
      )}
      {origin === AudioOrigin.SharedMedia && (voice || video) && renderWithTitle()}
      {origin === AudioOrigin.Inline && voice && renderVoice(voice, renderedWaveform, playProgress, isMediaUnread)}
    </div>
  );
};

function renderAudio(
  lang: LangFn,
  audio: ApiAudio,
  duration: number,
  isPlaying: boolean,
  playProgress: number,
  bufferedProgress: number,
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
  const { isRtl } = getTranslation;

  return (
    <div className="content">
      <p className="title" dir="auto" title={title}>{renderText(title || fileName)}</p>
      {showSeekline && (
        <div className="meta" dir={isRtl ? 'rtl' : undefined}>
          <span className="duration with-seekline" dir="auto">
            {formatMediaDuration(duration * playProgress, duration)}
          </span>
          {renderSeekline(playProgress, bufferedProgress, seekerRef)}
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
          <span className="bullet">&bull;</span>
          <span className="performer" dir="auto" title={performer}>{renderText(performer || 'Unknown')}</span>
          {date && (
            <>
              <span className="bullet">&bull;</span>
              <Link className="date" onClick={handleDateClick}>{formatMediaDateTime(lang, date * 1000, true)}</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function renderVoice(voice: ApiVoice, renderedWaveform: any, playProgress: number, isMediaUnread?: boolean) {
  return (
    <div className="content">
      {renderedWaveform}
      <p className={buildClassName('voice-duration', isMediaUnread && 'unread')} dir="auto">
        {playProgress === 0 ? formatMediaDuration(voice.duration) : formatMediaDuration(voice.duration * playProgress)}
      </p>
    </div>
  );
}

function renderWaveform(
  voice: ApiVoice,
  playProgress = 0,
  isOwn = false,
  theme: ISettings['theme'],
  seekerRef: React.Ref<HTMLElement>,
) {
  const { waveform, duration } = voice;

  if (!waveform) {
    return undefined;
  }

  const fillColor = theme === 'dark' ? '#494A78' : '#ADD3F7';
  const fillOwnColor = theme === 'dark' ? '#B7ABED' : '#AEDFA4';
  const progressFillColor = theme === 'dark' ? '#8774E1' : '#3390EC';
  const progressFillOwnColor = theme === 'dark' ? '#FFFFFF' : '#4FAE4E';
  const durationFactor = Math.min(duration / AVG_VOICE_DURATION, 1);
  const spikesCount = Math.round(MIN_SPIKES + (MAX_SPIKES - MIN_SPIKES) * durationFactor);
  const decodedWaveform = decodeWaveform(new Uint8Array(waveform));
  const { data: spikes, peak } = interpolateArray(decodedWaveform, spikesCount);
  const { src, width, height } = renderWaveformToDataUri(spikes, playProgress, {
    peak,
    fillStyle: isOwn ? fillOwnColor : fillColor,
    progressFillStyle: isOwn ? progressFillOwnColor : progressFillColor,
  });

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      className="waveform"
      draggable={false}
      ref={seekerRef as React.Ref<HTMLImageElement>}
    />
  );
}

function renderSeekline(
  playProgress: number,
  bufferedProgress: number,
  seekerRef: React.Ref<HTMLElement>,
) {
  return (
    <div
      className="seekline no-selection"
      ref={seekerRef as React.Ref<HTMLDivElement>}
    >
      <span className="seekline-buffered-progress">
        <i
          // @ts-ignore
          style={`transform: translateX(${bufferedProgress * 100}%)`}
        />
      </span>
      <span className="seekline-play-progress">
        <i
          // @ts-ignore
          style={`transform: translateX(${playProgress * 100}%)`}
        />
      </span>
      <span className="seekline-thumb">
        <i
          // @ts-ignore
          style={`transform: translateX(${playProgress * 100}%)`}
        />
      </span>
    </div>
  );
}

export default memo(Audio);
