import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import {
  ApiAudio, ApiMessage, ApiVoice,
} from '../../api/types';
import { ISettings } from '../../types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import { formatMediaDateTime, formatMediaDuration, formatPastTimeShort } from '../../util/dateFormat';
import {
  getMediaDuration,
  getMediaTransferState,
  getMessageKey,
  getMessageMediaFormat,
  getMessageMediaHash,
  isMessageLocal,
  isOwnMessage,
} from '../../modules/helpers';
import { renderWaveformToDataUri } from './helpers/waveform';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';
import { decodeWaveform, interpolateArray } from '../../util/waveform';
import useMediaWithDownloadProgress from '../../hooks/useMediaWithDownloadProgress';
import useShowTransition from '../../hooks/useShowTransition';
import useBuffering from '../../hooks/useBuffering';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import useLang, { LangFn } from '../../hooks/useLang';

import Button from '../ui/Button';
import ProgressSpinner from '../ui/ProgressSpinner';
import Link from '../ui/Link';

import './Audio.scss';

type OwnProps = {
  message: ApiMessage;
  senderTitle?: string;
  uploadProgress?: number;
  renderingFor?: 'searchResult' | 'sharedMedia';
  date?: number;
  lastSyncTime?: number;
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  onPlay: (messageId: number, chatId: number) => void;
  onReadMedia?: () => void;
  onCancelUpload?: () => void;
  onDateClick?: (messageId: number, chatId: number) => void;
};

type StateProps = {
  theme: ISettings['theme'];
};

interface ISeekMethods {
  handleStartSeek: (e: React.MouseEvent<HTMLElement>) => void;
  handleSeek: (e: React.MouseEvent<HTMLElement>) => void;
  handleStopSeek: () => void;
}

const AVG_VOICE_DURATION = 30;
const MIN_SPIKES = IS_MOBILE_SCREEN ? 20 : 25;
const MAX_SPIKES = IS_MOBILE_SCREEN ? 50 : 75;
// This is needed for browsers requiring user interaction before playing.
const PRELOAD = true;

const Audio: FC<OwnProps & StateProps> = ({
  theme,
  message,
  senderTitle,
  uploadProgress,
  renderingFor,
  date,
  lastSyncTime,
  className,
  isSelectable,
  isSelected,
  onPlay,
  onReadMedia,
  onCancelUpload,
  onDateClick,
}) => {
  const { content: { audio, voice }, isMediaUnread } = message;
  const isVoice = Boolean(voice);
  const isSeeking = useRef<boolean>(false);
  const lang = useLang();

  const [isActivated, setIsActivated] = useState(false);
  const shouldDownload = (isActivated || PRELOAD) && lastSyncTime;

  const { mediaData, downloadProgress } = useMediaWithDownloadProgress(
    getMessageMediaHash(message, 'inline'),
    !shouldDownload,
    getMessageMediaFormat(message, 'inline'),
  );

  function handleForcePlay() {
    setIsActivated(true);
    onPlay(message.id, message.chatId);
  }

  const {
    isBuffered, bufferedProgress, bufferingHandlers, checkBuffering,
  } = useBuffering();

  const {
    isPlaying, playProgress, playPause, setCurrentTime, duration,
  } = useAudioPlayer(
    getMessageKey(message),
    getMediaDuration(message)!,
    mediaData,
    bufferingHandlers,
    checkBuffering,
    isActivated,
    handleForcePlay,
    isMessageLocal(message),
  );

  useEffect(() => {
    setIsActivated(isPlaying);
  }, [isPlaying]);

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(message, uploadProgress || downloadProgress, isActivated && !isBuffered);

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isTransferring);

  const handleButtonClick = useCallback(() => {
    if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload();
      }

      return;
    }

    if (!isPlaying) {
      onPlay(message.id, message.chatId);
    }

    setIsActivated(!isActivated);
    playPause();
  }, [isPlaying, isUploading, message.id, message.chatId, onCancelUpload, onPlay, playPause, isActivated]);

  useEffect(() => {
    if (isPlaying && onReadMedia && isMediaUnread) {
      onReadMedia();
    }
  }, [isPlaying, isMediaUnread, onReadMedia]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (isSeeking.current) {
      const seekBar = e.currentTarget.closest('.seekline,.waveform');
      if (seekBar) {
        const { width, left } = seekBar.getBoundingClientRect();
        setCurrentTime(duration * ((e.clientX - left) / width));
      }
    }
  }, [duration, setCurrentTime]);

  const handleStartSeek = useCallback((e: React.MouseEvent<HTMLElement>) => {
    isSeeking.current = true;
    handleSeek(e);
  }, [handleSeek]);

  const handleStopSeek = useCallback(() => {
    isSeeking.current = false;
  }, []);

  const handleDateClick = useCallback(() => {
    onDateClick!(message.id, message.chatId);
  }, [onDateClick, message.id, message.chatId]);

  function getFirstLine() {
    if (isVoice) {
      return senderTitle || 'Voice';
    }

    const { title, fileName } = audio!;

    return title || fileName;
  }

  function getSecondLine() {
    if (isVoice) {
      return formatMediaDuration(voice!.duration);
    }

    const { performer } = audio!;

    return (
      <>
        {performer && renderText(performer)}
        {performer && senderTitle && <span>&bull;</span>}
        {senderTitle && renderText(senderTitle)}
      </>
    );
  }

  const seekHandlers = { handleStartSeek, handleSeek, handleStopSeek };
  const isOwn = isOwnMessage(message);
  const renderedWaveform = useMemo(
    () => voice && renderWaveform(voice, playProgress, isOwn, seekHandlers, theme),
    [voice, playProgress, isOwn, seekHandlers, theme],
  );

  const fullClassName = buildClassName(
    'Audio media-inner',
    className,
    isOwn && !renderingFor && 'own',
    renderingFor && 'bigger',
    isSelected && 'audio-is-selected',
  );

  const buttonClassNames = ['toggle-play'];
  if (shouldRenderSpinner) {
    buttonClassNames.push('loading');
  } else if (isPlaying) {
    buttonClassNames.push('pause');
  } else if (!isPlaying) {
    buttonClassNames.push('play');
  }

  const showSeekline = isPlaying || (playProgress > 0 && playProgress < 1);
  const contentClassName = buildClassName('content', showSeekline && 'with-seekline');

  function renderSearchResult() {
    return (
      <>
        <div className={contentClassName}>
          <div className="content-row">
            <p className="title" dir="auto">{renderText(getFirstLine())}</p>

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

          {showSeekline && renderSeekline(playProgress, bufferedProgress, seekHandlers)}
          {!showSeekline && (
            <p className="duration" dir="auto">
              {playProgress > 0 ? `${formatMediaDuration(duration * playProgress)} / ` : undefined}
              {getSecondLine()}
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className={fullClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      {isSelectable && (
        <div className="message-select-control">
          {isSelected && <i className="icon-select" />}
        </div>
      )}
      <Button
        round
        ripple={!IS_MOBILE_SCREEN}
        size={renderingFor ? 'smaller' : 'tiny'}
        className={buttonClassNames.join(' ')}
        ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
        onClick={handleButtonClick}
        isRtl={lang.isRtl}
      >
        <i className="icon-play" />
        <i className="icon-pause" />
      </Button>
      {shouldRenderSpinner && (
        <div className={buildClassName('media-loading', spinnerClassNames)}>
          <ProgressSpinner
            progress={transferProgress}
            transparent
            size={renderingFor ? 'm' : 's'}
            onClick={handleButtonClick}
          />
        </div>
      )}
      {renderingFor === 'searchResult' && renderSearchResult()}
      {renderingFor !== 'searchResult' && audio && renderAudio(
        lang, audio, isPlaying, playProgress, bufferedProgress, seekHandlers, date,
        onDateClick ? handleDateClick : undefined,
      )}
      {renderingFor !== 'searchResult' && voice && renderVoice(voice, renderedWaveform, isMediaUnread)}
    </div>
  );
};

function renderAudio(
  lang: LangFn,
  audio: ApiAudio,
  isPlaying: boolean,
  playProgress: number,
  bufferedProgress: number,
  seekHandlers: ISeekMethods,
  date?: number,
  handleDateClick?: () => void,
) {
  const {
    title, performer, duration, fileName,
  } = audio;
  const showSeekline = isPlaying || (playProgress > 0 && playProgress < 1);

  return (
    <div className="content">
      <p className="title" dir="auto">{renderText(title || fileName)}</p>
      {showSeekline && renderSeekline(playProgress, bufferedProgress, seekHandlers)}
      {!showSeekline && (
        <div className="meta" dir="auto">
          <span className="performer">{renderText(performer || 'Unknown')}</span>
          {date && (
            <>
              {' '}
              &bull;
              {' '}
              <Link className="date" onClick={handleDateClick}>{formatMediaDateTime(lang, date * 1000)}</Link>
            </>
          )}
        </div>
      )}
      <p className="duration" dir="auto">
        {playProgress > 0 ? `${formatMediaDuration(duration * playProgress)} / ` : undefined}
        {formatMediaDuration(duration)}
      </p>
    </div>
  );
}

function renderVoice(voice: ApiVoice, renderedWaveform: any, isMediaUnread?: boolean) {
  return (
    <div className="content">
      {renderedWaveform}
      <p className="voice-duration" dir="auto">
        {formatMediaDuration(voice.duration)}
        {isMediaUnread && <span>&bull;</span>}
      </p>
    </div>
  );
}

function renderWaveform(
  voice: ApiVoice,
  playProgress = 0,
  isOwn = false,
  { handleStartSeek, handleSeek, handleStopSeek }: ISeekMethods,
  theme: ISettings['theme'],
) {
  const { waveform, duration } = voice;

  if (!waveform) {
    return undefined;
  }

  const fillColor = theme === 'dark' ? '#494B75' : '#CBCBCB';
  const fillOwnColor = theme === 'dark' ? '#C69C85' : '#B0DEA6';
  const progressFillColor = theme === 'dark' ? '#868DF5' : '#54a3e6';
  const progressFillOwnColor = theme === 'dark' ? '#FFFFFF' : '#53ad53';
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
      onMouseDown={handleStartSeek}
      onMouseMove={handleSeek}
      onMouseUp={handleStopSeek}
    />
  );
}

function renderSeekline(
  playProgress: number,
  bufferedProgress: number,
  { handleStartSeek, handleSeek, handleStopSeek }: ISeekMethods,
) {
  return (
    <div
      className="seekline no-selection"
      onMouseDown={handleStartSeek}
      onMouseMove={handleSeek}
      onMouseUp={handleStopSeek}
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

export default memo(withGlobal<OwnProps>((global) => ({ theme: global.settings.byKey.theme }))(Audio));
