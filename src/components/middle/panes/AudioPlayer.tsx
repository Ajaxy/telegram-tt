import type { FC } from '../../../lib/teact/teact';
import { useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAudio, ApiChat, ApiMessage, ApiPeer,
  MediaContent,
} from '../../../api/types';
import type { IconName } from '../../../types/icons';

import { PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION } from '../../../config';
import {
  getMessageContent, isMessageLocal,
} from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChat, selectChatMessage, selectSender, selectTabState,
} from '../../../global/selectors';
import { selectMessageMediaDuration } from '../../../global/selectors/media';
import { makeTrackId } from '../../../util/audioPlayer';
import { IS_IOS, IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import * as mediaLoader from '../../../util/mediaLoader';
import { clearMediaSession } from '../../../util/mediaSession';
import renderText from '../../common/helpers/renderText';

import useMessageMediaHash from '../../../hooks/media/useMessageMediaHash';
import useAppLayout from '../../../hooks/useAppLayout';
import useAudioPlayer from '../../../hooks/useAudioPlayer';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLastCallback from '../../../hooks/useLastCallback';
import useMessageMediaMetadata from '../../../hooks/useMessageMediaMetadata';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransition from '../../../hooks/useShowTransition';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import RangeSlider from '../../ui/RangeSlider';
import RippleEffect from '../../ui/RippleEffect';

import './AudioPlayer.scss';

type OwnProps = {
  className?: string;
  noUi?: boolean;
  isFullWidth?: boolean;
  isHidden?: boolean;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  message?: ApiMessage;
  sender?: ApiPeer;
  chat?: ApiChat;
  mediaDuration?: number;
  volume: number;
  playbackRate: number;
  isPlaybackRateActive?: boolean;
  isMuted: boolean;
  timestamp?: number;
};

const PLAYBACK_RATES: Record<number, number> = {
  0.5: 0.66,
  0.75: 0.8,
  1: 1,
  1.5: 1.4,
  2: 1.8,
};
const PLAYBACK_RATE_VALUES = Object.keys(PLAYBACK_RATES).sort().map(Number);

const REGULAR_PLAYBACK_RATE = 1;
const DEFAULT_FAST_PLAYBACK_RATE = 2;

const AudioPlayer: FC<OwnProps & StateProps> = ({
  message,
  mediaDuration,
  className,
  noUi,
  sender,
  chat,
  volume,
  playbackRate,
  isPlaybackRateActive,
  isMuted,
  isFullWidth,
  timestamp,
  onPaneStateChange,
}) => {
  const {
    setAudioPlayerVolume,
    setAudioPlayerPlaybackRate,
    setAudioPlayerMuted,
    focusMessage,
    closeAudioPlayer,
  } = getActions();

  const lang = useOldLang();

  const { isMobile } = useAppLayout();
  const renderingMessage = useCurrentOrPrev(message);

  const { audio, voice, video } = renderingMessage ? getMessageContent(renderingMessage) : {} satisfies MediaContent;
  const isVoice = Boolean(voice || video);
  const shouldRenderPlaybackButton = isVoice || (audio?.duration || 0) > PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION;
  const senderName = sender ? getPeerTitle(lang, sender) : undefined;

  const mediaHash = useMessageMediaHash(renderingMessage, 'inline');
  const mediaData = mediaHash && mediaLoader.getFromMemory(mediaHash);
  const mediaMetadata = useMessageMediaMetadata(renderingMessage, sender, chat);

  const {
    playPause,
    stop,
    isPlaying,
    requestNextTrack,
    requestPreviousTrack,
    isFirst,
    isLast,
    setVolume,
    toggleMuted,
    setPlaybackRate,
    setCurrentTime,
  } = useAudioPlayer(
    message && makeTrackId(message),
    mediaDuration || 0,
    isVoice ? 'voice' : 'audio',
    mediaData,
    undefined,
    mediaMetadata,
    undefined,
    true,
    undefined,
    undefined,
    message && isMessageLocal(message),
    true,
  );

  const isOpen = Boolean(message);
  const {
    ref: transitionRef,
  } = useShowTransition({
    isOpen,
    shouldForceOpen: isFullWidth, // Use pane animation instead
  });

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    isDisabled: !isFullWidth,
    ref: transitionRef,
    onStateChange: onPaneStateChange,
  });

  const {
    isContextMenuOpen,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(transitionRef, !shouldRender);

  useEffect(() => {
    if (timestamp) {
      setCurrentTime(timestamp);
    }
  }, [timestamp, setCurrentTime]);

  useEffect(() => {
    if (isPlaying && message?.isDeleting) {
      playPause();
    }
  }, [isPlaying, message?.isDeleting, playPause]);

  const handleClick = useLastCallback(() => {
    const { chatId, id } = renderingMessage!;
    focusMessage({ chatId, messageId: id });
  });

  const handleClose = useLastCallback(() => {
    if (!stop) {
      return;
    }
    if (isPlaying) {
      playPause();
    }
    closeAudioPlayer();
    clearMediaSession();
    stop();
  });

  const handleVolumeChange = useLastCallback((value: number) => {
    if (!setVolume) {
      return;
    }
    setAudioPlayerVolume({ volume: value / 100 });
    setVolume(value / 100);
  });

  const handleVolumeClick = useLastCallback(() => {
    if (IS_TOUCH_ENV && !IS_IOS) return;
    if (!toggleMuted) {
      return;
    }
    toggleMuted();
    setAudioPlayerMuted({ isMuted: !isMuted });
  });

  const updatePlaybackRate = useLastCallback((newRate: number, isActive = true) => {
    if (!setPlaybackRate) {
      return;
    }
    const rate = PLAYBACK_RATES[newRate];
    const shouldBeActive = newRate !== REGULAR_PLAYBACK_RATE && isActive;
    setAudioPlayerPlaybackRate({ playbackRate: rate, isPlaybackRateActive: shouldBeActive });
    setPlaybackRate(shouldBeActive ? rate : REGULAR_PLAYBACK_RATE);
  });

  const handlePlaybackClick = useLastCallback(() => {
    handleContextMenuClose();
    const oldRate = Number(Object.entries(PLAYBACK_RATES).find(([, rate]) => rate === playbackRate)?.[0])
      || REGULAR_PLAYBACK_RATE;
    const newIsActive = !isPlaybackRateActive;

    updatePlaybackRate(
      newIsActive && oldRate === REGULAR_PLAYBACK_RATE ? DEFAULT_FAST_PLAYBACK_RATE : oldRate,
      newIsActive,
    );
  });

  const PlaybackRateButton = useLastCallback(() => {
    const displayRate = Object.entries(PLAYBACK_RATES).find(([, rate]) => rate === playbackRate)?.[0]
      || REGULAR_PLAYBACK_RATE;
    const text = `${playbackRate === REGULAR_PLAYBACK_RATE ? DEFAULT_FAST_PLAYBACK_RATE : displayRate}Х`;
    return (
      <div className="playback-wrapper">
        {isContextMenuOpen && <div className="playback-backdrop" onClick={handleContextMenuClose} />}

        <Button
          round
          className={buildClassName(
            'playback-button', isPlaybackRateActive && 'applied', isContextMenuOpen && 'on-top',
          )}
          color="translucent"
          size="smaller"
          ariaLabel="Playback Rate"
          ripple={!isMobile}
          onMouseEnter={handleContextMenu}
          onClick={handlePlaybackClick}
          onMouseDown={handleBeforeContextMenu}
          onContextMenu={handleContextMenu}
        >
          <span className={buildClassName(
            'playback-button-inner',
            text.length === 4 && 'small',
            text.length === 5 && 'tiny',
          )}
          >
            {text}
          </span>
        </Button>
      </div>
    );
  });

  const volumeIcon: IconName = useMemo(() => {
    if (volume === 0 || isMuted) return 'muted';
    if (volume < 0.3) return 'volume-1';
    if (volume < 0.6) return 'volume-2';
    return 'volume-3';
  }, [volume, isMuted]);

  if (noUi || !shouldRender) {
    return undefined;
  }

  return (
    <div
      className={buildClassName('AudioPlayer', isFullWidth ? 'full-width-player' : 'mini-player', className)}
      dir={lang.isRtl ? 'rtl' : undefined}
      ref={ref}
    >
      <div className="AudioPlayer-content" onClick={handleClick}>
        {audio ? renderAudio(audio) : renderVoice(lang('AttachAudio'), senderName)}
        <RippleEffect />
      </div>

      <Button
        round
        ripple={!isMobile}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={isFirst?.()}
        onClick={requestPreviousTrack}
        ariaLabel="Previous track"
      >
        <Icon name="skip-previous" />
      </Button>
      <Button
        round
        ripple={!isMobile}
        color="translucent"
        size="smaller"
        className={buildClassName('toggle-play', 'player-button', isPlaying ? 'pause' : 'play')}
        onClick={playPause}
        ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <Icon name="play" />
        <Icon name="pause" />
      </Button>
      <Button
        round
        ripple={!isMobile}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={isLast?.()}
        onClick={requestNextTrack}
        ariaLabel="Next track"
      >
        <Icon name="skip-next" />
      </Button>

      <div className="volume-button-wrapper">
        <Button
          round
          className="player-button volume-button"
          color="translucent"
          size="smaller"
          ariaLabel="Volume"
          onClick={handleVolumeClick}
          ripple={!isMobile}
        >
          <Icon name={volumeIcon} />
        </Button>

        {!IS_IOS && (
          <div className="volume-slider-wrapper">
            <div className="volume-slider-spacer" />
            <div className="volume-slider">
              <RangeSlider bold value={isMuted ? 0 : volume * 100} onChange={handleVolumeChange} />
            </div>
          </div>
        )}
      </div>

      {shouldRenderPlaybackButton && (
        <DropdownMenu
          forceOpen={isContextMenuOpen}
          positionX="right"
          positionY="top"
          className="playback-rate-menu"
          trigger={PlaybackRateButton}
          onClose={handleContextMenuClose}
          onHide={handleContextMenuHide}
          onMouseEnterBackdrop={handleContextMenuClose}
        >
          {PLAYBACK_RATE_VALUES.map((rate) => {
            return renderPlaybackRateMenuItem(rate, playbackRate, updatePlaybackRate, isPlaybackRateActive);
          })}
        </DropdownMenu>
      )}

      <Button
        round
        className="player-close"
        color="translucent"
        size="smaller"
        onClick={handleClose}
        ariaLabel="Close player"
      >
        <Icon name="close" />
      </Button>
    </div>
  );
};

function renderAudio(audio: ApiAudio) {
  const { title, performer, fileName } = audio;

  return (
    <>
      <div className="title" dir="auto">{renderText(title || fileName)}</div>
      {performer && (
        <div className="subtitle" dir="auto">{renderText(performer)}</div>
      )}
    </>
  );
}

function renderVoice(subtitle: string, senderName?: string) {
  return (
    <>
      <div className="title" dir="auto">{senderName && renderText(senderName)}</div>
      <div className="subtitle" dir="auto">{subtitle}</div>
    </>
  );
}

function renderPlaybackRateMenuItem(
  rate: number, currentRate: number, onClick: (rate: number) => void,
  isPlaybackRateActive?: boolean,
) {
  const isSelected = (currentRate === PLAYBACK_RATES[rate] && isPlaybackRateActive)
    || (rate === REGULAR_PLAYBACK_RATE && !isPlaybackRateActive);
  return (
    <MenuItem
      key={rate}

      onClick={() => onClick(rate)}
      icon={isSelected ? 'check' : undefined}
      customIcon={!isSelected ? <Icon name="placeholder" /> : undefined}
    >
      {rate}
      X
    </MenuItem>
  );
}

export default withGlobal<OwnProps>(
  (global, { isHidden }): Complete<StateProps> => {
    const { audioPlayer } = selectTabState(global);
    const { chatId, messageId } = audioPlayer;
    const message = !isHidden && chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;

    const sender = message && selectSender(global, message);
    const chat = message && selectChat(global, message.chatId);
    const {
      volume, playbackRate, isMuted, isPlaybackRateActive, timestamp,
    } = selectTabState(global).audioPlayer;

    const mediaDuration = message ? selectMessageMediaDuration(global, message) : undefined;

    return {
      message,
      sender,
      chat,
      volume,
      playbackRate,
      isPlaybackRateActive,
      isMuted,
      timestamp,
      mediaDuration,
    };
  },
)(AudioPlayer);
