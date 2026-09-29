import { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiTopic } from '../../../api/types';

import { selectTopic } from '../../../global/selectors';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { preventMessageInputBlurWithBubbling } from '../helpers/preventMessageInputBlur';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import TopicIcon from '../../common/TopicIcon';

type OwnProps = {
  chatId: string;
  topicId: number;
};

type StateProps = {
  topic?: ApiTopic;
};

const TOPIC_ICON_SIZE = 1.25 * REM;

const TopicSeparator = ({ chatId, topicId, topic }: OwnProps & StateProps) => {
  const { openThread } = getActions();

  const lang = useLang();

  const handleClick = useLastCallback(() => {
    openThread({ chatId, threadId: topicId });
  });

  return (
    <div className="sticky-topic">
      <button
        type="button"
        className="topic-pill"
        dir="auto"
        onMouseDown={preventMessageInputBlurWithBubbling}
        onClick={handleClick}
      >
        {topic && <TopicIcon topic={topic} size={TOPIC_ICON_SIZE} className="topic-pill-icon" />}
        <span className="topic-pill-title">{topic ? renderText(topic.title) : lang('Loading')}</span>
        <Icon name="next-link" className="topic-pill-chevron" />
      </button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, topicId }): Complete<StateProps> => {
    return {
      topic: selectTopic(global, chatId, topicId),
    };
  },
)(TopicSeparator));
