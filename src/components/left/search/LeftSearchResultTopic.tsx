import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiTopic } from '../../../api/types';

import { selectTopic } from '../../../global/selectors';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';

import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import TopicIcon from '../../common/TopicIcon';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: string;
  topicId: number;
  onClick: (id: number) => void;
};

type StateProps = {
  topic?: ApiTopic;
};

const TOPIC_ICON_SIZE = 2 * REM;

const LeftSearchResultTopic: FC<OwnProps & StateProps> = ({
  topicId,
  topic,
  onClick,
}) => {
  const handleClick = useCallback(() => {
    onClick(topicId);
  }, [topicId, onClick]);

  const buttonRef = useSelectWithEnter(handleClick);

  if (!topic) {
    return undefined;
  }

  return (
    <ListItem
      className="chat-item-clickable search-result"
      onClick={handleClick}
      buttonClassName="topic-item"
      buttonRef={buttonRef}
    >
      <TopicIcon
        size={TOPIC_ICON_SIZE}
        topic={topic}
        className="topic-icon"
        letterClassName="topic-icon-letter"
      />
      <div dir="auto" className="fullName">{renderText(topic.title)}</div>
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, topicId }): StateProps => {
    const topic = selectTopic(global, chatId, topicId);

    return {
      topic,
    };
  },
)(LeftSearchResultTopic));
