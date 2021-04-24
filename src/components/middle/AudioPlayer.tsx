import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiAudio, ApiMessage } from '../../api/types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import * as mediaLoader from '../../util/mediaLoader';
import {
  getMediaDuration, getMessageAudio, getMessageKey, getMessageMediaHash, getSenderTitle,
} from '../../modules/helpers';
import { selectSender } from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';
import useAudioPlayer from '../../hooks/useAudioPlayer';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import RippleEffect from '../ui/RippleEffect';
import Button from '../ui/Button';

import './AudioPlayer.scss';

type OwnProps = {
  message: ApiMessage;
  className?: string;
  noUi?: boolean;
};

type StateProps = {
  senderName?: string;
};

type DispatchProps = Pick<GlobalActions, 'focusMessage' | 'closeAudioPlayer'>;

const AudioPlayer: FC<OwnProps & StateProps & DispatchProps> = ({
  message, className, noUi, senderName, focusMessage, closeAudioPlayer,
}) => {
  const mediaData = mediaLoader.getFromMemory(getMessageMediaHash(message, 'inline')!) as (string | undefined);
  const { playPause, isPlaying } = useAudioPlayer(
    getMessageKey(message), getMediaDuration(message)!, mediaData, undefined, undefined, true,
  );

  const handleClick = useCallback(() => {
    focusMessage({ chatId: message.chatId, messageId: message.id });
  }, [focusMessage, message.chatId, message.id]);

  const handleClose = useCallback(() => {
    if (isPlaying) {
      playPause();
    }
    closeAudioPlayer();
  }, [closeAudioPlayer, isPlaying, playPause]);

  const lang = useLang();

  if (noUi) {
    return undefined;
  }

  const audio = getMessageAudio(message);

  return (
    <div className={buildClassName('AudioPlayer', className)}>
      <Button
        round
        ripple={!IS_MOBILE_SCREEN}
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
      <div className="title">{renderText(title || fileName)}</div>
      {performer && (
        <div className="subtitle">{renderText(performer)}</div>
      )}
    </>
  );
}

function renderVoice(subtitle: string, senderName?: string) {
  return (
    <>
      <div className="title">{senderName && renderText(senderName)}</div>
      <div className="subtitle">{subtitle}</div>
    </>
  );
}

export default withGlobal<OwnProps>(
  (global, { message }) => {
    const sender = selectSender(global, message);
    const senderName = sender ? getSenderTitle(sender) : undefined;

    return { senderName };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['focusMessage', 'closeAudioPlayer']),
)(AudioPlayer);
