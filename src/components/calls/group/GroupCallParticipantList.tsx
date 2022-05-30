import type { GroupCallParticipant as TypeGroupCallParticipant } from '../../../lib/secret-sauce';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import useLang from '../../../hooks/useLang';
import { selectActiveGroupCall } from '../../../global/selectors/calls';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';

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

const GroupCallParticipantList: FC<OwnProps & StateProps> = ({
  participants,
  participantsCount,
  openParticipantMenu,
}) => {
  const {
    createGroupCallInviteLink,
    loadMoreGroupCallParticipants,
  } = getActions();

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
      <div className="invite-btn" onClick={createGroupCallInviteLink}>
        <div className="icon">
          <i className="icon-add-user" />
        </div>
        <div className="text">{lang('VoipGroupInviteMember')}</div>
      </div>

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
    const { participantsCount, participants } = selectActiveGroupCall(global) || {};

    return {
      participants,
      participantsCount: participantsCount || 0,
    };
  },
)(GroupCallParticipantList));
