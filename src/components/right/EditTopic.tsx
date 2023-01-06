import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiChat, ApiTopic } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { selectChat } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import TopicIcon from '../common/TopicIcon';
import InputText from '../ui/InputText';
import FloatingActionButton from '../ui/FloatingActionButton';
import Spinner from '../ui/Spinner';
import Loading from '../ui/Loading';

import styles from './ManageTopic.module.scss';

const ICON_SIZE = 5 * REM;

type OwnProps = {
  isActive: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  topic?: ApiTopic;
  editTopicPanel?: GlobalState['editTopicPanel'];
};

const EditTopic: FC<OwnProps & StateProps> = ({
  isActive,
  chat,
  topic,
  editTopicPanel,
  onClose,
}) => {
  const { editTopic, closeEditTopicPanel } = getActions();
  const [title, setTitle] = useState('');
  const [isTouched, setIsTouched] = useState(false);
  const lang = useLang();

  const isLoading = Boolean(editTopicPanel?.isLoading);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (topic?.title) {
      setTitle(topic.title);
      setIsTouched(false);
    }
  }, [topic?.title]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setIsTouched(newTitle !== topic?.title);
  }, [topic?.title]);

  const handleEditTopic = useCallback(() => {
    editTopic({
      chatId: chat!.id,
      title,
      topicId: topic!.id,
    });
    closeEditTopicPanel();
  }, [chat, closeEditTopicPanel, editTopic, title, topic]);

  const dummyTopic = useMemo(() => {
    return {
      ...topic!,
      title,
    };
  }, [title, topic]);

  if (!chat?.isForum) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <div className="custom-scroll">
        {!topic && <Loading />}
        {topic && (
          <div className={buildClassName(styles.top, 'section')}>
            <span className={styles.heading}>{lang('CreateTopicTitle')}</span>
            <TopicIcon
              topic={dummyTopic}
              className={styles.icon}
              size={ICON_SIZE}
            />
            <InputText
              value={title}
              onChange={handleTitleChange}
              label={lang('lng_forum_topic_title')}
              disabled={isLoading}
              teactExperimentControlled
            />
          </div>
        )}
      </div>
      <FloatingActionButton
        isShown={isTouched}
        disabled={isLoading}
        onClick={handleEditTopic}
        ariaLabel={lang('Save')}
      >
        {isLoading ? (
          <Spinner color="white" />
        ) : (
          <i className="icon-check" />
        )}
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const { editTopicPanel } = global;
    const chat = editTopicPanel?.chatId ? selectChat(global, editTopicPanel.chatId) : undefined;
    const topic = editTopicPanel?.topicId ? chat?.topics?.[editTopicPanel?.topicId] : undefined;
    return {
      chat,
      topic,
      editTopicPanel,
    };
  },
)(EditTopic));
