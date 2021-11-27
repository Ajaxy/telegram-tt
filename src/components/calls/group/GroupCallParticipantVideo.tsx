import { getUserStreams, GroupCallParticipant as TypeGroupCallParticipant, THRESHOLD } from '../../../lib/secret-sauce';
import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { selectChat, selectUser } from '../../../modules/selectors';
import useLang from '../../../hooks/useLang';
import { ENABLE_THUMBNAIL_VIDEO } from '../../../config';

import Avatar from '../../common/Avatar';

import './GroupCallParticipantVideo.scss';

type OwnProps = {
  participant: TypeGroupCallParticipant;
  type: 'video' | 'presentation';
  onClick?: (id: string, type: 'video' | 'presentation') => void;
  isFullscreen?: boolean;
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
  currentUserId?: string;
  isActive?: boolean;
};

const GroupCallParticipantVideo: FC<OwnProps & StateProps> = ({
  type,
  onClick,
  user,
  chat,
  isActive,
  isFullscreen,
}) => {
  const lang = useLang();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(user?.id || chat!.id, type);
    }
  }, [chat, onClick, type, user?.id]);

  if (!user && !chat) return undefined;

  const streams = getUserStreams(user?.id || chat!.id);

  return (
    <div
      className={buildClassName('GroupCallParticipantVideo', isActive && 'active')}
      onClick={handleClick}
    >
      {isFullscreen && (
        <button className="back-button">
          <i className="icon-arrow-left" />
          {lang('Back')}
        </button>
      )}
      <Avatar user={user} chat={chat} className="thumbnail-avatar" />
      {ENABLE_THUMBNAIL_VIDEO && (
        <div className="thumbnail-wrapper">
          <video className="thumbnail" muted autoPlay playsInline srcObject={streams?.[type]} />
        </div>
      )}
      <video className="video" muted autoPlay playsInline srcObject={streams?.[type]} />
      <div className="info">
        <i className="icon-microphone-alt" />
        <span className="name">{user?.firstName || chat?.title}</span>
        {type === 'presentation' && <i className="last-icon icon-active-sessions" />}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { participant }): StateProps => {
    return {
      currentUserId: global.currentUserId,
      user: participant.isUser ? selectUser(global, participant.id) : undefined,
      chat: !participant.isUser ? selectChat(global, participant.id) : undefined,
      isActive: (participant.amplitude || 0) > THRESHOLD,
    };
  },
)(GroupCallParticipantVideo));
