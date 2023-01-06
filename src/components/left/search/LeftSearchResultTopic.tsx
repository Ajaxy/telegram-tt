import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiTopic } from '../../../api/types';

import {
  selectChat,
} from '../../../global/selectors';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import ListItem from '../../ui/ListItem';
import TopicIcon from '../../common/TopicIcon';

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
    const chat = selectChat(global, chatId);
    const topic = chat?.topics?.[topicId];

    return {
      topic,
    };
  },
)(LeftSearchResultTopic));
