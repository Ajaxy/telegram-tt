import React, { memo } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { ApiTopic } from '../../api/types';

import CustomEmoji from './CustomEmoji';
import TopicDefaultIcon from './TopicDefaultIcon';

type OwnProps = {
  topic: Pick<ApiTopic, 'iconEmojiId' | 'iconColor' | 'title' | 'id'>;
  className?: string;
  letterClassName?: string;
  size?: number;
  noLoopLimit?: true;
  observeIntersection?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const LOOP_LIMIT = 2;

const TopicIcon: FC<OwnProps> = ({
  topic,
  className,
  letterClassName,
  size,
  noLoopLimit,
  observeIntersection,
  onClick,
}) => {
  if (topic.iconEmojiId) {
    return (
      <CustomEmoji
        documentId={topic.iconEmojiId}
        className={className}
        size={size}
        observeIntersectionForPlaying={observeIntersection}
        loopLimit={!noLoopLimit ? LOOP_LIMIT : undefined}
        onClick={onClick}
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
      onClick={onClick}
    />
  );
};

export default memo(TopicIcon);
