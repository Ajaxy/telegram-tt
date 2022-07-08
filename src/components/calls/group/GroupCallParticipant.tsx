import type { GroupCallParticipant as TypeGroupCallParticipant } from '../../../lib/secret-sauce';
import { THRESHOLD } from '../../../lib/secret-sauce';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { selectChat, selectUser } from '../../../global/selectors';
import useLang from '../../../hooks/useLang';
import { GROUP_CALL_DEFAULT_VOLUME, GROUP_CALL_VOLUME_MULTIPLIER } from '../../../config';

import Avatar from '../../common/Avatar';
import OutlinedMicrophoneIcon from './OutlinedMicrophoneIcon';

import './GroupCallParticipant.scss';

type OwnProps = {
  participant: TypeGroupCallParticipant;
  openParticipantMenu: (anchor: HTMLDivElement, participant: TypeGroupCallParticipant) => void;
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
};

const GroupCallParticipant: FC<OwnProps & StateProps> = ({
  openParticipantMenu,
  participant,
  user,
  chat,
}) => {
  // eslint-disable-next-line no-null/no-null
  const anchorRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const { isSelf, isMutedByMe, isMuted } = participant;
  const isSpeaking = (participant.amplitude || 0) > THRESHOLD;
  const isRaiseHand = Boolean(participant.raiseHandRating);

  const handleOnClick = () => {
    if (isSelf) return;
    openParticipantMenu(anchorRef.current!, participant);
  };

  const [aboutText, aboutColor] = useMemo(() => {
    if (isSelf) {
      return [lang('ThisIsYou'), 'blue'];
    }
    if (isMutedByMe) {
      return [lang('VoipGroupMutedForMe'), 'red'];
    }
    return isRaiseHand
      ? [lang('WantsToSpeak'), 'blue']
      : (!isMuted && isSpeaking ? [
        participant.volume && participant.volume !== GROUP_CALL_DEFAULT_VOLUME
          ? lang('SpeakingWithVolume',
            (participant.volume / GROUP_CALL_VOLUME_MULTIPLIER).toString())
            .replace('%%', '%') : lang('Speaking'),
        'green',
      ]
        : (participant.about ? [participant.about, ''] : [lang('Listening'), 'blue']));
  }, [isSpeaking, participant.volume, lang, isSelf, isMutedByMe, isRaiseHand, isMuted, participant.about]);

  if (!user && !chat) {
    return undefined;
  }

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}` : chat?.title;

  return (
    <div
      className={buildClassName(
        'GroupCallParticipant',
        participant.canSelfUnmute && 'can-self-unmute',
      )}
      onClick={handleOnClick}
      ref={anchorRef}
    >
      <Avatar user={user} chat={chat} size="medium" noVideo />
      <div className="info">
        <span className="name">{name}</span>
        <span className={buildClassName('about', aboutColor)}>{aboutText}</span>
      </div>
      <div className="microphone">
        <OutlinedMicrophoneIcon participant={participant} />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { participant }): StateProps => {
    return {
      user: participant.isUser ? selectUser(global, participant.id) : undefined,
      chat: !participant.isUser ? selectChat(global, participant.id) : undefined,
    };
  },
)(GroupCallParticipant));
