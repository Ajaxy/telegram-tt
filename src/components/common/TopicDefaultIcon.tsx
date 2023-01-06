import React, { memo } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';

import { GENERAL_TOPIC_ID } from '../../config';
import { getFirstLetters } from '../../util/textFormat';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';
import { getTopicDefaultIcon } from '../../util/forumColors';

import styles from './TopicDefaultIcon.module.scss';

type OwnProps = {
  className?: string;
  letterClassName?: string;
  topicId: number;
  iconColor?: number;
  title: string;
  onClick?: NoneToVoidFunction;
};

const TopicDefaultIcon: FC<OwnProps> = ({
  className,
  letterClassName,
  topicId,
  iconColor,
  title,
  onClick,
}) => {
  const iconSrc = getTopicDefaultIcon(iconColor);

  if (topicId === GENERAL_TOPIC_ID) {
    return (
      <i className={buildClassName(styles.root, className, 'icon-hashtag', 'general-forum-icon')} onClick={onClick} />
    );
  }
  return (
    <div className={buildClassName(styles.root, className)} onClick={onClick}>
      <img className={styles.icon} src={iconSrc} alt="" draggable={false} />
      <div className={buildClassName(styles.title, letterClassName, 'topic-icon-letter')}>
        {renderText(getFirstLetters(title, 1))}
      </div>
    </div>
  );
};

export default memo(TopicDefaultIcon);
