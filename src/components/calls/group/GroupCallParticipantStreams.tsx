import { GroupCallParticipant } from '../../../lib/secret-sauce';
import React, {
  FC, memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';
import GroupCallParticipantVideo from './GroupCallParticipantVideo';
import { selectActiveGroupCall } from '../../../modules/selectors/calls';
import buildClassName from '../../../util/buildClassName';

type OwnProps = {
  onDoubleClick?: VoidFunction;
};

type StateProps = {
  participants?: Record<string, GroupCallParticipant>;
};

type SelectedVideo = {
  type: 'video' | 'presentation';
  id: string;
};

const GroupCallParticipantStreams: FC<OwnProps & StateProps> = ({
  participants,
  onDoubleClick,
}) => {
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | undefined>(undefined);
  const presentationParticipants = useMemo(() => {
    return Object.values(participants || {}).filter((l) => l.hasPresentationStream);
  }, [participants]);
  const videoParticipants = useMemo(() => {
    return Object.values(participants || {}).filter((l) => l.hasVideoStream);
  }, [participants]);

  const totalVideoCount = videoParticipants.length + presentationParticipants.length;
  // TODO replace with more adequate solution.
  // There's a max of 30 videos or so right now
  const columnCount = totalVideoCount <= 2 ? 1 : (
    totalVideoCount <= 6 ? 2 : (
      totalVideoCount <= 9 ? 3 : 4
    )
  );

  const shouldSpanLastVideo = totalVideoCount === 3 || (columnCount === 2 && totalVideoCount % 2 !== 0);

  const handleClickVideo = useCallback((id: string, type: 'video' | 'presentation') => {
    if (!selectedVideo || (id !== selectedVideo.id || type !== selectedVideo.type)) {
      setSelectedVideo({
        id,
        type,
      });
    } else {
      setSelectedVideo(undefined);
    }
  }, [selectedVideo]);

  return (
    <div className="streams" onDoubleClick={onDoubleClick}>
      <div
        className={buildClassName(
          'videos',
          shouldSpanLastVideo && 'span-last-video',
        )}
        style={`--column-count: ${selectedVideo ? 1 : columnCount}`}
      >
        {selectedVideo && (
          <GroupCallParticipantVideo
            key={selectedVideo.id}
            isFullscreen
            onClick={handleClickVideo}
            participant={participants![selectedVideo.id]}
            type={selectedVideo.type}
          />
        )}

        {!selectedVideo ? presentationParticipants.map((participant) => (
          <GroupCallParticipantVideo
            key={participant.id}
            onClick={handleClickVideo}
            participant={participant}
            type="presentation"
          />
        )) : undefined}
        {!selectedVideo ? videoParticipants.map((participant) => (
          <GroupCallParticipantVideo
            key={participant.id}
            onClick={handleClickVideo}
            participant={participant}
            type="video"
          />
        )) : undefined}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { participants } = selectActiveGroupCall(global) || {};
    return {
      participants,
    };
  },
)(GroupCallParticipantStreams));
