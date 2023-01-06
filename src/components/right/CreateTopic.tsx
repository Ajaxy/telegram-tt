import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiChat } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { selectChat } from '../../global/selectors';
import { getTopicColors } from '../../util/forumColors';
import cycleRestrict from '../../util/cycleRestrict';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import TopicIcon from '../common/TopicIcon';
import InputText from '../ui/InputText';
import FloatingActionButton from '../ui/FloatingActionButton';
import Spinner from '../ui/Spinner';

import styles from './ManageTopic.module.scss';

const ICON_SIZE = 5 * REM;

type OwnProps = {
  isActive: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  createTopicPanel?: GlobalState['createTopicPanel'];
};

const CreateTopic: FC<OwnProps & StateProps> = ({
  isActive,
  chat,
  createTopicPanel,
  onClose,
}) => {
  const { createTopic, closeCreateTopicPanel } = getActions();
  const [title, setTitle] = useState('');
  const [iconColorIndex, setIconColorIndex] = useState(0);
  const lang = useLang();

  const isTouched = Boolean(title);
  const isLoading = Boolean(createTopicPanel?.isLoading);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handleIconClick = useCallback(() => {
    setIconColorIndex((prev) => cycleRestrict(getTopicColors().length, prev + 1));
  }, []);

  const handleCreateTopic = useCallback(() => {
    createTopic({
      chatId: chat!.id,
      title,
      iconColor: getTopicColors()[iconColorIndex],
    });
    closeCreateTopicPanel();
  }, [chat, closeCreateTopicPanel, createTopic, iconColorIndex, title]);

  const dummyTopic = useMemo(() => {
    return {
      id: 0,
      title,
      iconColor: getTopicColors()[iconColorIndex],
    };
  }, [iconColorIndex, title]);

  if (!chat?.isForum) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <div className="custom-scroll">
        <div className={buildClassName(styles.top, 'section')}>
          <span className={styles.heading}>{lang('CreateTopicTitle')}</span>
          <TopicIcon
            topic={dummyTopic}
            className={buildClassName(styles.icon, styles.clickable)}
            onClick={handleIconClick}
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
      </div>
      <FloatingActionButton
        isShown={isTouched}
        disabled={isLoading}
        onClick={handleCreateTopic}
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
    const { createTopicPanel } = global;
    return {
      chat: createTopicPanel?.chatId ? selectChat(global, createTopicPanel.chatId) : undefined,
      createTopicPanel,
    };
  },
)(CreateTopic));
