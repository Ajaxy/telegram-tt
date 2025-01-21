import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiTopic } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { getTopicColorCssVariable } from '../../util/forumColors';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

import Icon from './icons/Icon';
import TopicIcon from './TopicIcon';

import styles from './TopicChip.module.scss';

import blankSrc from '../../assets/blank.png';

type OwnProps = {
  topic?: ApiTopic;
  className?: string;
  onClick?: NoneToVoidFunction;
};

const TOPIC_ICON_SIZE = 1.125 * REM;

const TopicChip: FC<OwnProps> = ({
  topic,
  className,
  onClick,
}) => {
  const lang = useOldLang();
  return (
    <div
      className={buildClassName(styles.root, className)}
      style={`--topic-button-accent-color: var(${getTopicColorCssVariable(topic?.iconColor)})`}
      onClick={onClick}
    >
      {topic
        ? <TopicIcon topic={topic} size={TOPIC_ICON_SIZE} />
        : <img src={blankSrc} alt="" draggable={false} />}
      {topic?.title ? renderText(topic.title) : lang('Loading')}
      {topic?.isClosed && <Icon name="lock" />}
      <Icon name="next" />
    </div>
  );
};

export default memo(TopicChip);
