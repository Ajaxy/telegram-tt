import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiGroupCall } from '../../../api/types';

import { selectChat, selectTabState } from '../../../global/selectors';
import { selectChatGroupCall } from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useOldLang from '../../../hooks/useOldLang';
import useHeaderPane, { type PaneState } from '../../middle/hooks/useHeaderPane';

import AvatarList from '../../common/AvatarList';
import Button from '../../ui/Button';

import './GroupCallTopPane.scss';

type OwnProps = {
  chatId: string;
  className?: string;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  groupCall?: ApiGroupCall;
  isActive: boolean;
};

const PREVIEW_AVATARS_COUNT = 3;

const GroupCallTopPane: FC<OwnProps & StateProps> = ({
  chatId,
  isActive,
  className,
  groupCall,
  onPaneStateChange,
}) => {
  const {
    requestMasterAndJoinGroupCall,
  } = getActions();

  const lang = useOldLang();

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

    return Object.values(participants)
      .slice(0, PREVIEW_AVATARS_COUNT)
      .map(({ id }) => usersById[id] || chatsById[id])
      .filter(Boolean);
  }, [participants]);

  const renderingParticipantCount = useCurrentOrPrev(groupCall?.participantsCount, true);
  const renderingFetchedParticipants = useCurrentOrPrev(fetchedParticipants, true);

  const isRendering = Boolean(groupCall && isActive);

  const { ref, shouldRender } = useHeaderPane({
    isOpen: isRendering,
    onStateChange: onPaneStateChange,
  });

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={buildClassName(
        'GroupCallTopPane',
        className,
      )}
      onClick={handleJoinGroupCall}
    >
      <div className="info">
        <span className="title">{lang('VoipGroupVoiceChat')}</span>
        <span className="participants">{lang('Participants', renderingParticipantCount ?? 0, 'i')}</span>
      </div>
      {Boolean(renderingFetchedParticipants?.length) && (
        <AvatarList size="small" peers={renderingFetchedParticipants} className="avatars" />
      )}
      <Button round className="join">
        {lang('VoipChatJoin')}
      </Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
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
