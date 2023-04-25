import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiGroupCall } from '../../../api/types';

import { selectChatGroupCall } from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';
import { selectChat, selectTabState } from '../../../global/selectors';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Avatar from '../../common/Avatar';

import './GroupCallTopPane.scss';

type OwnProps = {
  chatId: string;
  hasPinnedOffset: boolean;
  className?: string;
};

type StateProps = {
  groupCall?: ApiGroupCall;
  isActive: boolean;
};

const GroupCallTopPane: FC<OwnProps & StateProps> = ({
  chatId,
  isActive,
  className,
  groupCall,
  hasPinnedOffset,
}) => {
  const {
    requestMasterAndJoinGroupCall,
    subscribeToGroupCallUpdates,
  } = getActions();

  const lang = useLang();

  const handleJoinGroupCall = useCallback(() => {
    requestMasterAndJoinGroupCall({
      chatId,
    });
  }, [requestMasterAndJoinGroupCall, chatId]);

  const participants = groupCall?.participants;

  const fetchedParticipants = useMemo(() => {
    if (!participants) {
      return [];
    }

    // No need for expensive global updates on users and chats, so we avoid them
    const usersById = getGlobal().users.byId;
    const chatsById = getGlobal().chats.byId;

    return Object.values(participants).filter((_, i) => i < 3).map(({ id, isUser }) => {
      if (isUser) {
        if (!usersById[id]) {
          return undefined;
        }
        return { user: usersById[id] };
      } else {
        if (!chatsById[id]) {
          return undefined;
        }
        return { chat: chatsById[id] };
      }
    }).filter(Boolean);
  }, [participants]);

  useEffect(() => {
    if (!groupCall?.id) return undefined;
    if (!isActive && groupCall.isLoaded) return undefined;

    subscribeToGroupCallUpdates({
      id: groupCall.id,
      subscribed: true,
    });

    return () => {
      subscribeToGroupCallUpdates({
        id: groupCall.id,
        subscribed: false,
      });
    };
  }, [groupCall?.id, groupCall?.isLoaded, isActive, subscribeToGroupCallUpdates]);

  if (!groupCall) return undefined;

  return (
    <div
      className={buildClassName(
        'GroupCallTopPane',
        hasPinnedOffset && 'has-pinned-offset',
        !isActive && 'is-hidden',
        className,
      )}
      onClick={handleJoinGroupCall}
    >
      <div className="info">
        <span className="title">{lang('VoipGroupVoiceChat')}</span>
        <span className="participants">{lang('Participants', groupCall.participantsCount || 0, 'i')}</span>
      </div>
      <div className="avatars">
        {fetchedParticipants.map((p) => {
          if (!p) return undefined;

          return (
            <Avatar
              key={p.user ? p.user.id : p.chat.id}
              chat={p.chat}
              user={p.user}
            />
          );
        })}
      </div>
      <Button round className="join">
        {lang('VoipChatJoin')}
      </Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const groupCall = selectChatGroupCall(global, chatId);
    const activeGroupCallId = selectTabState(global).isMasterTab ? global.groupCalls.activeGroupCallId : undefined;

    return {
      groupCall,
      isActive: activeGroupCallId !== groupCall?.id && Boolean(
        groupCall
          ? groupCall.participantsCount > 0 && groupCall.isLoaded
          : chat && chat.isCallNotEmpty && chat.isCallActive,
      ),
    };
  },
)(GroupCallTopPane));
