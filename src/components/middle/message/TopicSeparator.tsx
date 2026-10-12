import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiTopic } from '../../../api/types';

import { selectChat, selectTopic, selectTopicsInfo } from '../../../global/selectors';
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
  chatTitle?: string;
  areTopicsLoaded: boolean;
};

const TOPIC_ICON_SIZE = 1.25 * REM;

const TopicSeparator = ({
  chatId, topicId, topic, chatTitle, areTopicsLoaded,
}: OwnProps & StateProps) => {
  const { openThread, loadTopicById } = getActions();

  const lang = useLang();

  const isTopicMissing = !topic && areTopicsLoaded;
  const title = topic ? topic.title : isTopicMissing ? chatTitle : undefined;

  useEffect(() => {
    if (isTopicMissing) {
      loadTopicById({ chatId, topicId });
    }
  }, [chatId, topicId, isTopicMissing]);

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
        <span className="topic-pill-title">{title ? renderText(title) : lang('Loading')}</span>
        <Icon name="next-link" className="topic-pill-chevron" />
      </button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, topicId }): Complete<StateProps> => {
    const topicsInfo = selectTopicsInfo(global, chatId);

    return {
      topic: selectTopic(global, chatId, topicId),
      chatTitle: selectChat(global, chatId)?.title,
      areTopicsLoaded: Boolean(topicsInfo?.listedTopicIds && !topicsInfo.isCache),
    };
  },
)(TopicSeparator));
