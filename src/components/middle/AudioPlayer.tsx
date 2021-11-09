import React, { FC, useCallback, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { AudioOrigin } from '../../types';
import { GlobalActions } from '../../global/types';
import {
  ApiAudio, ApiChat, ApiMessage, ApiUser,
} from '../../api/types';

import { IS_IOS, IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../util/environment';

import * as mediaLoader from '../../util/mediaLoader';
import {
  getMediaDuration, getMessageContent, getMessageMediaHash, getSenderTitle,
} from '../../modules/helpers';
import { selectChat, selectSender } from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useMessageMediaMetadata from '../../hooks/useMessageMediaMetadata';
import { makeTrackId } from '../../util/audioPlayer';
import { clearMediaSession } from '../../util/mediaSession';

import RippleEffect from '../ui/RippleEffect';
import Button from '../ui/Button';
import RangeSlider from '../ui/RangeSlider';

import './AudioPlayer.scss';

type OwnProps = {
  message: ApiMessage;
  origin?: AudioOrigin;
  className?: string;
  noUi?: boolean;
};

type StateProps = {
  sender?: ApiChat | ApiUser;
  chat?: ApiChat;
  volume: number;
  playbackRate: number;
  isMuted: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'focusMessage' |
  'closeAudioPlayer' |
  'setAudioPlayerVolume' |
  'setAudioPlayerPlaybackRate' |
  'setAudioPlayerMuted'
)>;

const FAST_PLAYBACK_RATE = 1.8;

const AudioPlayer: FC<OwnProps & StateProps & DispatchProps> = ({
  message,
  origin = AudioOrigin.Inline,
  className,
  noUi,
  sender,
  chat,
  volume,
  playbackRate,
  isMuted,
  setAudioPlayerVolume,
  setAudioPlayerPlaybackRate,
  setAudioPlayerMuted,
  focusMessage,
  closeAudioPlayer,
}) => {
  const lang = useLang();
  const { audio, voice, video } = getMessageContent(message);
  const isVoice = Boolean(voice || video);
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
    origin,
    mediaData,
    undefined,
    mediaMetadata,
    undefined,
    true,
    undefined,
    undefined,
    true,
    true,
  );

  const handleClick = useCallback(() => {
    focusMessage({ chatId: message.chatId, messageId: message.id });
  }, [focusMessage, message.chatId, message.id]);

  const handleClose = useCallback(() => {
    if (isPlaying) {
      playPause();
    }
    closeAudioPlayer();
    clearMediaSession();
    stop();
  }, [closeAudioPlayer, isPlaying, playPause, stop]);

  const handleVolumeChange = useCallback((value: number) => {
    setAudioPlayerVolume({ volume: value / 100 });
    setAudioPlayerMuted({ isMuted: false });

    setVolume(value / 100);
  }, [setAudioPlayerMuted, setAudioPlayerVolume, setVolume]);

  const handleVolumeClick = useCallback(() => {
    if (IS_TOUCH_ENV && !IS_IOS) return;
    toggleMuted();
    setAudioPlayerMuted({ isMuted: !isMuted });
  }, [isMuted, setAudioPlayerMuted, toggleMuted]);

  const handlePlaybackClick = useCallback(() => {
    if (playbackRate === 1) {
      setPlaybackRate(FAST_PLAYBACK_RATE);
      setAudioPlayerPlaybackRate({ playbackRate: FAST_PLAYBACK_RATE });
    } else {
      setPlaybackRate(1);
      setAudioPlayerPlaybackRate({ playbackRate: 1 });
    }
  }, [playbackRate, setAudioPlayerPlaybackRate, setPlaybackRate]);

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
    <div className={buildClassName('AudioPlayer', className)} dir={lang.isRtl ? 'rtl' : undefined}>
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={isFirst}
        onClick={requestPreviousTrack}
        ariaLabel="Previous track"
      >
        <i className="icon-skip-previous" />
      </Button>
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        color="translucent"
        size="smaller"
        className={buildClassName('toggle-play', 'player-button', isPlaying ? 'pause' : 'play')}
        onClick={playPause}
        ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <i className="icon-play" />
        <i className="icon-pause" />
      </Button>
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        color="translucent"
        size="smaller"
        className="player-button"
        disabled={isLast}
        onClick={requestNextTrack}
        ariaLabel="Next track"
      >
        <i className="icon-skip-next" />
      </Button>

      <div className="AudioPlayer-content" onClick={handleClick}>
        {audio ? renderAudio(audio) : renderVoice(lang('AttachAudio'), senderName)}
        <RippleEffect />
      </div>

      <Button
        round
        className="player-button volume-button"
        color="translucent"
        size="smaller"
        ariaLabel="Volume"
        withClickPropagation
      >
        <i className={volumeIcon} onClick={handleVolumeClick} />
        {!IS_IOS && (
          <>
            <div className="volume-slider-spacer" />
            <div className="volume-slider">
              <RangeSlider value={isMuted ? 0 : volume * 100} onChange={handleVolumeChange} />
            </div>
          </>
        )}
      </Button>

      {isVoice && (
        <Button
          round
          className={buildClassName('playback-button', playbackRate !== 1 && 'applied')}
          color="translucent"
          size="smaller"
          ariaLabel="Playback Rate"
          ripple={!IS_SINGLE_COLUMN_LAYOUT}
          onClick={handlePlaybackClick}
        >
          <span className="playback-button-inner">2Х</span>
        </Button>
      )}

      <Button
        round
        className="player-close"
        color="translucent"
        size="smaller"
        onClick={handleClose}
        ariaLabel="Close player"
      >
        <i className="icon-close" />
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

export default withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const sender = selectSender(global, message);
    const chat = selectChat(global, message.chatId);
    const { volume, playbackRate, isMuted } = global.audioPlayer;

    return {
      sender,
      chat,
      volume,
      playbackRate,
      isMuted,
    };
  },
  (setGlobal, actions): DispatchProps => pick(
    actions,
    ['focusMessage', 'closeAudioPlayer', 'setAudioPlayerVolume', 'setAudioPlayerPlaybackRate', 'setAudioPlayerMuted'],
  ),
)(AudioPlayer);
