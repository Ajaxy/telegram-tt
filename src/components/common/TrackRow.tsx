import type { ElementRef } from '../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import type { ApiAudio, ApiVideo, ApiVoice } from '../../api/types';
import type { BufferedRange } from '../../hooks/useBuffering';
import type {
  AudioVariant, PlaybackCapabilities, PlaybackMediaType, ThemeKey,
} from '../../types';
import type { TrackKey } from '../../util/audioPlayback/mediaPool';
import type { LangFn } from '../../util/localization';
import type { Signal } from '../../util/signals';
import type { MenuItemContextAction } from '../ui/ListItem';

import { getMediaTransferState } from '../../global/helpers';
import { ensureAudioContext } from '../../util/audioPlayback/audioAnalyser';
import buildClassName from '../../util/buildClassName';
import { captureEvents } from '../../util/captureEvents';
import { formatMediaDuration } from '../../util/dates/duration';
import { formatCalendarDate, formatCompactTimestamp, secondsToDate } from '../../util/localization/dateFormat';
import {
  generateVoiceWaveform, getGeneratedVoiceWaveform, MAX_GENERATED_WAVEFORM_DURATION,
  releaseVoiceWaveformRequest, retainVoiceWaveformRequest,
} from '../../util/voiceWaveform';
import { decodeWaveform, interpolateArray } from '../../util/waveform';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';
import renderText from './helpers/renderText';
import { renderWaveform } from './helpers/waveform';

import useAppLayout from '../../hooks/useAppLayout';
import useAudioPlayback from '../../hooks/useAudioPlayback';
import useBuffering from '../../hooks/useBuffering';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

import Button from '../ui/Button';
import Link from '../ui/Link';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import ProgressSpinner from '../ui/ProgressSpinner';
import AnimatedFileSize from './AnimatedFileSize';
import AnimatedIcon from './AnimatedIcon';
import Icon from './icons/Icon';
import PlayingRing from './PlayingRing';
import PlayPauseIcon from './PlayPauseIcon';

import './Audio.scss';

type OwnProps = {
  theme: ThemeKey;
  variant: AudioVariant;
  className?: string;
  audio?: ApiAudio;
  mediaSource?: ApiVoice | ApiVideo;
  trackKey: TrackKey;
  mediaType: PlaybackMediaType;
  capabilities: PlaybackCapabilities;
  src?: string;
  originalDuration: number;
  coverBlobUrl?: string;
  senderTitle?: string;
  date?: number;
  isOwn?: boolean;
  isMediaUnread?: boolean;
  isViewOnceLocked?: boolean;
  noProgress?: boolean;
  noProgressUpdates?: boolean;
  withPlayingRing?: boolean;
  noAvatars?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  isDownloading?: boolean;
  canDownload?: boolean;
  uploadProgress?: number;
  downloadProgress?: number;
  isTranscribing?: boolean;
  isTranscribed?: boolean;
  isTranscriptionHidden?: boolean;
  isTranscriptionError?: boolean;
  autoPlay?: boolean;
  contextActions?: MenuItemContextAction[];
  onBeforePlay?: NoneToVoidFunction;
  onPause?: NoneToVoidFunction;
  onLockedClick?: NoneToVoidFunction;
  onCancelUpload?: NoneToVoidFunction;
  onDownloadClick?: NoneToVoidFunction;
  onDateClick?: NoneToVoidFunction;
  onTranscribe?: NoneToVoidFunction;
  onHideTranscription?: (isHidden: boolean) => void;
  onListened?: NoneToVoidFunction;
  onWaveformGenerated?: (waveform: number[]) => void;
};

const TINY_SCREEN_WIDTH_MQL = window.matchMedia('(max-width: 375px)');
const WITH_AVATAR_TINY_SCREEN_WIDTH_MQL = window.matchMedia('(max-width: 410px)');
const AVG_VOICE_DURATION = 10;
const PLAY_PAUSE_ICON_SIZE = 34;

const TrackRow = ({
  theme,
  variant,
  className,
  audio,
  mediaSource,
  trackKey,
  mediaType,
  capabilities,
  src,
  originalDuration,
  coverBlobUrl,
  senderTitle,
  date,
  isOwn,
  isMediaUnread,
  isViewOnceLocked,
  noProgress,
  noProgressUpdates,
  withPlayingRing,
  noAvatars,
  isSelectable,
  isSelected,
  isDownloading,
  canDownload,
  uploadProgress,
  downloadProgress,
  isTranscribing,
  isTranscriptionHidden,
  isTranscribed,
  isTranscriptionError,
  autoPlay,
  contextActions,
  onBeforePlay,
  onPause,
  onLockedClick,
  onCancelUpload,
  onDownloadClick,
  onDateClick,
  onTranscribe,
  onHideTranscription,
  onListened,
  onWaveformGenerated,
}: OwnProps) => {
  const isVoice = Boolean(mediaSource);
  const containerRef = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();
  const isSeekingRef = useRef<boolean>(false);
  const wasPlayingBeforeSeekRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number>(0);
  const seekerRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const { isMobile } = useAppLayout();
  const [isActivated, setIsActivated] = useState(false);
  const isInOneTimeModal = variant === 'oneTimeModal';
  const shouldRenderWithTitle = variant === 'search' || variant === 'attachment';

  const handleTrackChange = useLastCallback(() => {
    setIsActivated(false);
  });

  const isReverse = isInOneTimeModal && !capabilities.canSeek;
  const withWaveform = variant === 'inline' || isInOneTimeModal || isTranscribed;
  const isWaveformFilled = isMediaUnread && !isOwn && !isReverse;

  const {
    isPlaying, isCurrent, playProgress, getFrameProgress, duration, audioElement,
    play, pause, playPause, setCurrentTime, previewProgress,
  } = useAudioPlayback({
    trackKey,
    mediaType,
    capabilities,
    src,
    originalDuration,
    shouldPlay: Boolean(isActivated || autoPlay),
    noProgressUpdates,
    withFrameProgress: Boolean(withWaveform && mediaSource && !isWaveformFilled),
    onTrackChange: handleTrackChange,
    onPause,
  });

  const { isBuffered, bufferedRanges } = useBuffering(false, undefined, undefined, audioElement);

  const reversePlayProgress = 1 - playProgress;

  const generatedWaveform = useGeneratedVoiceWaveform(mediaSource, withWaveform, onWaveformGenerated);
  const waveformCanvasRef = useWaveformCanvas(
    theme,
    mediaSource,
    getFrameProgress,
    isWaveformFilled,
    isOwn,
    !noAvatars,
    isMobile,
    isReverse,
    generatedWaveform,
  );

  const withSeekline = !noProgress && (isPlaying || (playProgress > 0 && playProgress < 1));

  useEffect(() => {
    setIsActivated(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    if (onListened && isMediaUnread && isPlaying) {
      onListened();
    }
  }, [isPlaying, isMediaUnread, onListened]);

  const isLoadingForPlaying = isActivated && !isBuffered;

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(
    uploadProgress || downloadProgress,
    isLoadingForPlaying || isDownloading,
    uploadProgress !== undefined,
  );

  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransitionDeprecated(isTransferring);

  const {
    shouldRender: shouldRenderRing,
    transitionClassNames: ringClassNames,
  } = useShowTransitionDeprecated(Boolean(withPlayingRing) && (isPlaying || isCurrent) && !isInOneTimeModal);

  const shouldRenderCross = shouldRenderSpinner && (isLoadingForPlaying || isUploading);

  const handleButtonClick = useLastCallback(() => {
    if (isUploading) {
      onCancelUpload?.();
      return;
    }

    if (isViewOnceLocked) {
      onLockedClick?.();
      return;
    }

    if (!isPlaying) {
      if (withPlayingRing) ensureAudioContext();
      onBeforePlay?.();
    }

    setIsActivated(!isActivated);
    playPause();
  });

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(containerRef, !contextActions);

  const getTriggerElement = useLastCallback(() => containerRef.current);
  const getRootElement = useLastCallback(() => containerRef.current!.closest('.custom-scroll') || document.body);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleSeek = useLastCallback((e: MouseEvent | TouchEvent) => {
    if (isSeekingRef.current && seekerRef.current) {
      const { width, left } = seekerRef.current.getBoundingClientRect();
      const clientX = e instanceof MouseEvent ? e.clientX : e.targetTouches[0].clientX;
      e.stopPropagation(); // Prevent Slide-to-Reply activation
      // Prevent track skipping while seeking near end
      const time = Math.max(Math.min(duration * ((clientX - left) / width), duration - 0.1), 0.001);
      pendingSeekTimeRef.current = time;
      previewProgress(time / duration);
    }
  });

  const handleStartSeek = useLastCallback((e: MouseEvent | TouchEvent) => {
    if (!duration || (e instanceof MouseEvent && e.button !== 0)) return;
    isSeekingRef.current = true;

    if (audioElement && !audioElement.paused) {
      wasPlayingBeforeSeekRef.current = true;
      pause();
    }

    handleSeek(e);
  });

  const handleStopSeek = useLastCallback(() => {
    if (!isSeekingRef.current) return;
    isSeekingRef.current = false;

    setCurrentTime(pendingSeekTimeRef.current);

    if (wasPlayingBeforeSeekRef.current) {
      wasPlayingBeforeSeekRef.current = false;
      play();
    }
  });

  useEffect(() => {
    const seeker = seekerRef.current;
    if (!seeker || !withSeekline || isInOneTimeModal) return undefined;

    const releaseEvents = captureEvents(seeker, {
      onCapture: handleStartSeek,
      onRelease: handleStopSeek,
      onClick: handleStopSeek,
      onDrag: handleSeek,
    });
    seeker.addEventListener('touchend', handleStopSeek, { passive: true });
    seeker.addEventListener('touchcancel', handleStopSeek, { passive: true });

    return () => {
      releaseEvents();
      seeker.removeEventListener('touchend', handleStopSeek);
      seeker.removeEventListener('touchcancel', handleStopSeek);
    };
  }, [withSeekline, handleStartSeek, handleSeek, handleStopSeek, isInOneTimeModal]);

  function renderFirstLine() {
    if (isVoice) {
      return senderTitle || lang('AttachAudio');
    }

    const { title, fileName } = audio!;

    return title || fileName;
  }

  function renderSecondLine() {
    if (isVoice) {
      return (
        <div className="meta" dir={lang.isRtl ? 'rtl' : undefined}>
          {formatMediaDuration(mediaSource.duration)}
        </div>
      );
    }

    const { performer } = audio!;

    return (
      <div className="meta" dir={lang.isRtl ? 'rtl' : undefined}>
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
    variant === 'inline' && 'inline',
    isOwn && variant === 'inline' && 'own',
    (shouldRenderWithTitle || variant === 'sharedMedia') && 'bigger',
    isSelected && 'audio-is-selected',
    contextMenuAnchor && 'has-menu-open',
  );

  const buttonClassNames = ['toogle-play-wrapper'];
  if (shouldRenderCross) {
    buttonClassNames.push('loading');
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
                onClick={onDateClick}
              >
                {formatCompactTimestamp(lang, secondsToDate(date))}
              </Link>
            )}
          </div>
        </div>

        {withSeekline && (
          <div className="meta search-result" dir={lang.isRtl ? 'rtl' : undefined}>
            <span className="duration with-seekline" dir="auto">
              {playProgress < 1 && formatMediaDuration(duration * playProgress, duration)}
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
          ariaLabel={lang(isPlaying ? 'AudioPause' : 'AudioPlay')}
          onClick={handleButtonClick}
          isRtl={lang.isRtl}
          backgroundImage={coverBlobUrl}
          nonInteractive={isInOneTimeModal}
        >
          {!isInOneTimeModal && (
            <PlayPauseIcon isPlaying={isPlaying} size={PLAY_PAUSE_ICON_SIZE} className="play-pause-morph" />
          )}
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
        {shouldRenderRing && (
          <PlayingRing
            withCutout={Boolean(audio && canDownload && !isUploading)}
            isPaused={!isPlaying}
            className={ringClassNames}
          />
        )}
        {isViewOnceLocked && (
          <Icon name="view-once" />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={fullClassName}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={contextActions ? handleContextMenu : undefined}
    >
      {isSelectable && (
        <div className="message-select-control no-selection">
          {isSelected && <Icon name="check" className="message-select-control-icon" />}
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
          ariaLabel={lang(isDownloading ? 'ContextCancelDownload' : 'AccActionDownload')}
          onClick={onDownloadClick}
          iconName={isDownloading ? 'close' : 'arrow-down'}
        />
      )}
      {shouldRenderWithTitle && renderWithTitle()}
      {!shouldRenderWithTitle && audio && renderAudio(
        lang,
        audio,
        duration,
        !noProgress && isPlaying,
        noProgress ? 0 : playProgress,
        bufferedRanges,
        seekerRef,
        (isDownloading || isUploading),
        date,
        transferProgress,
        onDateClick,
      )}
      {variant === 'sharedMedia' && mediaSource && renderWithTitle()}
      {withWaveform && mediaSource && (
        renderVoice(
          mediaSource,
          seekerRef,
          waveformCanvasRef,
          (isViewOnceLocked || isReverse) ? reversePlayProgress : playProgress,
          isMediaUnread,
          isTranscribing,
          isTranscriptionHidden,
          isTranscribed,
          isTranscriptionError,
          onTranscribe,
          onHideTranscription,
          variant,
        )
      )}
      {contextActions && contextMenuAnchor !== undefined && (
        <Menu
          ref={menuRef}
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getMenuElement={getMenuElement}
          getLayout={getLayout}
          className="shared-media-context-menu with-menu-transitions"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal
        >
          {contextActions.map((action) => (
            ('isSeparator' in action) ? (
              <MenuSeparator key={action.key || 'separator'} />
            ) : (
              <MenuItem
                key={action.title}
                icon={action.icon}
                destructive={action.destructive}
                disabled={!action.handler}
                onClick={action.handler}
              >
                {action.title}
              </MenuItem>
            )
          ))}
        </Menu>
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
  seekerRef: ElementRef<HTMLDivElement>,
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
        <AnimatedFileSize className="meta" size={audio.size} progress={progress} />
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
                {formatCalendarDate(lang, secondsToDate(date), { isShort: true, withTime: true })}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function renderVoice(
  media: ApiVoice | ApiVideo,
  seekerRef: ElementRef<HTMLDivElement>,
  waveformCanvasRef: ElementRef<HTMLCanvasElement>,
  playProgress: number,
  isMediaUnread?: boolean,
  isTranscribing?: boolean,
  isTranscriptionHidden?: boolean,
  isTranscribed?: boolean,
  isTranscriptionError?: boolean,
  onClickTranscribe?: VoidFunction,
  onHideTranscription?: (isHidden: boolean) => void,
  variant?: AudioVariant,
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

          <Button onClick={() => {
            if ((isTranscribed || isTranscriptionError) && onHideTranscription) {
              onHideTranscription(!isTranscriptionHidden);
            } else if (!isTranscribing) {
              onClickTranscribe();
            }
          }}
          >
            <Icon
              name={(isTranscribed || isTranscriptionError) ? 'down' : 'transcribe'}
              className={buildClassName(
                'transcribe-icon',
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
                  stroke="currentColor"
                  stroke-dashoffset="1"
                  stroke-dasharray="32,68"
                />
              </svg>
            )}
          </Button>
        )}
      </div>
      <p
        className={buildClassName('voice-duration', variant !== 'oneTimeModal' && isMediaUnread && 'unread')}
        dir="auto"
      >
        {playProgress === 0 || playProgress === 1
          ? formatMediaDuration(media.duration) : formatMediaDuration(media.duration * playProgress)}
      </p>
    </div>
  );
}

function useWaveformCanvas(
  theme: ThemeKey,
  media: ApiVoice | ApiVideo | undefined,
  getProgress: Signal<number>,
  isFilled = false,
  isOwn = false,
  withAvatar = false,
  isMobile = false,
  isReverse = false,
  generatedWaveform?: number[],
) {
  const canvasRef = useRef<HTMLCanvasElement>();
  const dpr = useDevicePixelRatio();

  const { data: spikes, peak } = useMemo(() => {
    if (!media) {
      return undefined;
    }

    const { duration } = media;
    const { MIN_SPIKES, MAX_SPIKES } = getSeeklineSpikeAmounts(isMobile, withAvatar);
    const durationFactor = Math.min(duration / AVG_VOICE_DURATION, 1);
    const spikesCount = Math.round(MIN_SPIKES + (MAX_SPIKES - MIN_SPIKES) * durationFactor);

    const waveform = media.waveform?.length ? media.waveform : generatedWaveform;
    // An empty waveform keeps the same spikes count, so the width stays stable once the real one is generated
    if (!waveform) {
      return {
        data: new Array(spikesCount).fill(0),
        peak: 0,
      };
    }

    const decodedWaveform = decodeWaveform(new Uint8Array(waveform));

    return interpolateArray(decodedWaveform, spikesCount);
  }, [generatedWaveform, isMobile, media, withAvatar]) || {};

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

    const progress = isFilled ? 1 : getProgress();

    renderWaveform(canvas, spikes, isReverse ? 1 - progress : progress, {
      peak,
      fillStyle,
      progressFillStyle,
      dpr,
    });
  }, [isOwn, peak, getProgress, isFilled, spikes, theme, isReverse, dpr]);

  return canvasRef;
}

function useGeneratedVoiceWaveform(
  media?: ApiVoice | ApiVideo,
  isEnabled?: boolean,
  onWaveformGenerated?: (waveform: number[]) => void,
) {
  const voice = (
    isEnabled && media?.mediaType === 'voice' && !media.waveform?.length
    && media.duration <= MAX_GENERATED_WAVEFORM_DURATION
  ) ? media : undefined;
  const generatedWaveform = voice && getGeneratedVoiceWaveform(voice);
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (!voice) return undefined;

    if (generatedWaveform) {
      onWaveformGenerated?.(generatedWaveform);
      return undefined;
    }

    const { id } = voice;
    retainVoiceWaveformRequest(id);
    let isCancelled = false;
    generateVoiceWaveform(voice).then((waveform) => {
      if (!isCancelled && waveform) forceUpdate();
    });

    return () => {
      isCancelled = true;
      releaseVoiceWaveformRequest(id);
    };
  }, [voice, generatedWaveform, onWaveformGenerated]);

  return generatedWaveform;
}

function renderSeekline(
  playProgress: number,
  bufferedRanges: BufferedRange[],
  seekerRef: ElementRef<HTMLDivElement>,
) {
  return (
    <div
      className="seekline"
      ref={seekerRef}
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

export default memo(TrackRow);
