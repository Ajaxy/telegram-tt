import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { GroupCallParticipant as TypeGroupCallParticipant } from '../../../lib/secret-sauce';

import { selectActiveGroupCall } from '../../../global/selectors/calls';
import buildClassName from '../../../util/buildClassName';
import { compareFields } from '../../../util/iteratees';

import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useLastCallback from '../../../hooks/useLastCallback';

import InfiniteScroll from '../../ui/InfiniteScroll';
import GroupCallParticipant from './GroupCallParticipant';

import styles from './GroupCallParticipantList.module.scss';

type OwnProps = {
  panelOffset: number;
  isLandscape: boolean;
};

type StateProps = {
  participantsCount: number;
  participants?: Record<string, TypeGroupCallParticipant>;
  canInvite?: boolean;
};

const GroupCallParticipantList: FC<OwnProps & StateProps> = ({
  panelOffset,
  participants,
  participantsCount,
  isLandscape,
}) => {
  const {
    loadMoreGroupCallParticipants,
  } = getActions();

  const orderedParticipantIds = useMemo(() => {
    return Object.values(participants || {}).sort(compareParticipants).map((participant) => participant.id);
  }, [participants]);

  const handleLoadMoreGroupCallParticipants = useLastCallback(() => {
    loadMoreGroupCallParticipants();
  });

  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMoreGroupCallParticipants,
    orderedParticipantIds,
    orderedParticipantIds.length >= participantsCount,
  );

  return (
    <InfiniteScroll
      items={viewportIds}
      onLoadMore={getMore}
      style={`transform: translateY(${panelOffset}px);`}
      className={buildClassName(styles.root, !isLandscape && styles.portrait)}
    >
      {participants && viewportIds?.map(
        (participantId) => (
          participants[participantId] && (
            <GroupCallParticipant
              key={participantId}
              teactOrderKey={orderedParticipantIds.indexOf(participantId)}
              participant={participants[participantId]}
            />
          )
        ),
      )}
    </InfiniteScroll>
  );
};

function compareParticipants(a: TypeGroupCallParticipant, b: TypeGroupCallParticipant) {
  return compareFields(!a.isMuted, !b.isMuted)
        || compareFields(a.presentation, b.presentation)
        || compareFields(a.video, b.video)
        || compareFields(a.raiseHandRating, b.raiseHandRating);
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { participantsCount, participants } = selectActiveGroupCall(global) || {};

    return {
      participants,
      participantsCount: participantsCount || 0,
    };
  },
)(GroupCallParticipantList));
