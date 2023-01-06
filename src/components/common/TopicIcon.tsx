import React, { memo } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ApiTopic } from '../../api/types';

import CustomEmoji from './CustomEmoji';
import TopicDefaultIcon from './TopicDefaultIcon';

type OwnProps = {
  topic: ApiTopic;
  className?: string;
  letterClassName?: string;
  size?: number;
  noLoopLimit?: true;
  observeIntersection?: ObserveFn;
};

const LOOP_LIMIT = 2;

const TopicIcon: FC<OwnProps> = ({
  topic,
  className,
  letterClassName,
  size,
  noLoopLimit,
  observeIntersection,
}) => {
  if (topic.iconEmojiId) {
    return (
      <CustomEmoji
        documentId={topic.iconEmojiId}
        className={className}
        size={size}
        observeIntersectionForPlaying={observeIntersection}
        loopLimit={!noLoopLimit ? LOOP_LIMIT : undefined}
      />
    );
  }

  return (
    <TopicDefaultIcon
      iconColor={topic.iconColor}
      title={topic.title}
      topicId={topic.id}
      className={className}
      letterClassName={letterClassName}
    />
  );
};

export default memo(TopicIcon);
