import type { FC } from '../../lib/teact/teact';
import React, { useMemo, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiAudio, ApiChat, ApiMessage, ApiPeer,
} from '../../api/types';
import type { AudioOrigin } from '../../types';

import { PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION } from '../../config';
import {
  getMediaDuration, getMessageContent, getMessageMediaHash, getSenderTitle, isMessageLocal,
} from '../../global/helpers';
import { selectChat, selectSender, selectTabState } from '../../global/selectors';
import { makeTrackId } from '../../util/audioPlayer';
import buildClassName from '../../util/buildClassName';
import * as mediaLoader from '../../util/mediaLoader';
import { clearMediaSession } from '../../util/mediaSession';
import { IS_IOS, IS_TOUCH_ENV } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';

import useAppLayout from '../../hooks/useAppLayout';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMessageMediaMetadata from '../../hooks/useMessageMediaMetadata';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import RangeSlider from '../ui/RangeSlider';
import RippleEffect from '../ui/RippleEffect';

import './AudioPlayer.scss';

type OwnProps = {
  message: ApiMessage;
  origin?: AudioOrigin;
  className?: string;
  noUi?: boolean;
};

type StateProps = {
  sender?: ApiPeer;
  chat?: ApiChat;
  volume: number;
  playbackRate: number;
  isPlaybackRateActive?: boolean;
  isMuted: boolean;
};

const PLAYBACK_RATES: Record<number, number> = {
  0.5: 0.66,
  0.75: 0.8,
  1: 1,
  1.5: 1.4,
  2: 1.8,
  2.5: 2.3,
  3: 2.7,
};
const PLAYBACK_RATE_VALUES = Object.keys(PLAYBACK_RATES).sort().map(Number);

const REGULAR_PLAYBACK_RATE = 1;
const DEFAULT_FAST_PLAYBACK_RATE = 2;

const AudioPlayer: FC<OwnProps & StateProps> = ({
  message,
  className,
  noUi,
  sender,
  chat,
  volume,
  playbackRate,
  isPlaybackRateActive,
  isMuted,
}) => {
  const {
    setAudioPlayerVolume,
    setAudioPlayerPlaybackRate,
    setAudioPlayerMuted,
    focusMessage,
    closeAudioPlayer,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const { isMobile } = useAppLayout();
  const { audio, voice, video } = getMessageContent(message);
  const isVoice = Boolean(voice || video);
  const shouldRenderPlaybackButton = isVoice || (audio?.duration || 0) > PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION;
  const senderName = sender ? getSenderTitle(lang, sender) : undefined;
  const mediaData = mediaLoader.getFromMemory(getMessageMediaHash(message, 'inline')!) as (string | undefined);
  const mediaMetadata = useMessageMediaMetadata(message, sender, chat);

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
  } = useAudioPlayer(
    makeTrackId(message),
    getMediaDuration(message)!,
    isVoice ? 'voice' : 'audio',
    mediaData,
    undefined,
    mediaMetadata,
    undefined,
    true,
    undefined,
    undefined,
    isMessageLocal(message),
    true,
  );

  const {
    isContextMenuOpen,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const handleClick = useLastCallback(() => {
    focusMessage({ chatId: message.chatId, messageId: message.id });
  });

  const handleClose = useLastCallback(() => {
    if (isPlaying) {
      playPause();
    }
    closeAudioPlayer();
    clearMediaSession();
    stop();
  });

  const handleVolumeChange = useLastCallback((value: number) => {
    setAudioPlayerVolume({ volume: value / 100 });

    setVolume(value / 100);
  });

  const handleVolumeClick = useLastCallback(() => {
    if (IS_TOUCH_ENV && !IS_IOS) return;
    toggleMuted();
    setAudioPlayerMuted({ isMuted: !isMuted });
  });

  const updatePlaybackRate = useLastCallback((newRate: number, isActive = true) => {
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

  const volumeIcon = useMemo(() => {
    if (volume === 0 || isMuted) return 'icon-muted';
    if (volume < 0.3) return 'icon-volume-1';
    if (volume < 0.6) return 'icon-volume-2';
    return 'icon-volume-3';
  }, [volume, isMuted]);

  if (noUi) {
    return undefined;
  }

  return (
    <div className={buildClassName('AudioPlayer', className)} dir={lang.isRtl ? 'rtl' : undefined} ref={ref}>
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
        disabled={isFirst()}
        onClick={requestPreviousTrack}
        ariaLabel="Previous track"
      >
        <i className="icon icon-skip-previous" />
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
        <i className="icon icon-play" />
        <i className="icon icon-pause" />
      </Button>
      <Button
        round
        ripple={!isMobile}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={isLast()}
        onClick={requestNextTrack}
        ariaLabel="Next track"
      >
        <i className="icon icon-skip-next" />
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
          <i className={buildClassName('icon', volumeIcon)} />
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
        <i className="icon icon-close" />
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
      // eslint-disable-next-line react/jsx-no-bind
      onClick={() => onClick(rate)}
      icon={isSelected ? 'check' : undefined}
      customIcon={!isSelected ? <i className="icon icon-placeholder" /> : undefined}
    >
      {rate}X
    </MenuItem>
  );
}

export default withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const sender = selectSender(global, message);
    const chat = selectChat(global, message.chatId);
    const {
      volume, playbackRate, isMuted, isPlaybackRateActive,
    } = selectTabState(global).audioPlayer;

    return {
      sender,
      chat,
      volume,
      playbackRate,
      isPlaybackRateActive,
      isMuted,
    };
  },
)(AudioPlayer);
