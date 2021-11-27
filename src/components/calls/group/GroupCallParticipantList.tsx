import { GroupCallParticipant as TypeGroupCallParticipant } from '../../../lib/secret-sauce';
import React, { FC, memo, useMemo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';

import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';
import { selectActiveGroupCall } from '../../../modules/selectors/calls';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { selectChat } from '../../../modules/selectors';

import GroupCallParticipant from './GroupCallParticipant';
import InfiniteScroll from '../../ui/InfiniteScroll';

type OwnProps = {
  openParticipantMenu: (anchor: HTMLDivElement, participant: TypeGroupCallParticipant) => void;
};

type StateProps = {
  participantsCount: number;
  participants?: Record<string, TypeGroupCallParticipant>;
  canInvite?: boolean;
};

type DispatchProps = Pick<GlobalActions, 'createGroupCallInviteLink' | 'loadMoreGroupCallParticipants'>;

const GroupCallParticipantList: FC<OwnProps & StateProps & DispatchProps> = ({
  createGroupCallInviteLink,
  loadMoreGroupCallParticipants,
  participants,
  participantsCount,
  openParticipantMenu,
  canInvite,
}) => {
  const lang = useLang();

  const participantsIds = useMemo(() => {
    return Object.keys(participants || {});
  }, [participants]);

  const [viewportIds, getMore] = useInfiniteScroll(
    loadMoreGroupCallParticipants,
    participantsIds,
    participantsIds.length >= participantsCount,
  );

  return (
    <div className="participants">
      {canInvite && (
        <div className="invite-btn" onClick={createGroupCallInviteLink}>
          <div className="icon">
            <i className="icon-add-user" />
          </div>
          <div className="text">{lang('VoipGroupInviteMember')}</div>
        </div>
      )}

      <InfiniteScroll
        items={viewportIds}
        onLoadMore={getMore}
      >
        {viewportIds?.map(
          (participantId) => (
            participants![participantId] && (
              <GroupCallParticipant
                key={participantId}
                openParticipantMenu={openParticipantMenu}
                participant={participants![participantId]}
              />
            )
          ),
        )}
      </InfiniteScroll>

    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { participantsCount, participants, chatId } = selectActiveGroupCall(global) || {};
    const chat = chatId && selectChat(global, chatId);

    return {
      participants,
      participantsCount: participantsCount || 0,
      canInvite: !!chat && !!chat.username,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'createGroupCallInviteLink',
    'loadMoreGroupCallParticipants',
  ]),
)(GroupCallParticipantList));
