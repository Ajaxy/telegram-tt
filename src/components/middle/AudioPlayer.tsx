import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { AudioOrigin } from '../../types';
import { GlobalActions } from '../../global/types';
import {
  ApiAudio, ApiChat, ApiMessage, ApiUser,
} from '../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
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
};

type DispatchProps = Pick<GlobalActions, 'focusMessage' | 'closeAudioPlayer'>;

const AudioPlayer: FC<OwnProps & StateProps & DispatchProps> = ({
  message, origin = AudioOrigin.Inline, className, noUi, sender, focusMessage, closeAudioPlayer, chat,
}) => {
  const lang = useLang();
  const { audio, voice } = getMessageContent(message);
  const isVoice = Boolean(voice);
  const senderName = sender ? getSenderTitle(lang, sender) : undefined;
  const mediaData = mediaLoader.getFromMemory(getMessageMediaHash(message, 'inline')!) as (string | undefined);
  const mediaMetadata = useMessageMediaMetadata(message, sender, chat);
  const { playPause, stop, isPlaying } = useAudioPlayer(
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
        className={buildClassName('toggle-play', isPlaying ? 'pause' : 'play')}
        onClick={playPause}
        ariaLabel={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        <i className="icon-play" />
        <i className="icon-pause" />
      </Button>

      <div className="AudioPlayer-content" onClick={handleClick}>
        {audio ? renderAudio(audio) : renderVoice(lang('AttachAudio'), senderName)}
        <RippleEffect />
      </div>

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

    return {
      sender,
      chat,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['focusMessage', 'closeAudioPlayer']),
)(AudioPlayer);
