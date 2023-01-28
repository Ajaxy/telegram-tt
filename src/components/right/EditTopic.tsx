import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiChat, ApiSticker, ApiTopic } from '../../api/types';
import type { TabState } from '../../global/types';

import { DEFAULT_TOPIC_ICON_STICKER_ID, GENERAL_TOPIC_ID } from '../../config';
import { selectChat, selectIsCurrentUserPremium, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import TopicIcon from '../common/TopicIcon';
import InputText from '../ui/InputText';
import FloatingActionButton from '../ui/FloatingActionButton';
import Spinner from '../ui/Spinner';
import Loading from '../ui/Loading';
import CustomEmojiPicker from '../middle/composer/CustomEmojiPicker';
import Transition from '../ui/Transition';

import styles from './ManageTopic.module.scss';

const ICON_SIZE = 5 * REM;
const RESET_ICON_ID = '0';

export type OwnProps = {
  isActive: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  topic?: ApiTopic;
  editTopicPanel?: TabState['editTopicPanel'];
  isCurrentUserPremium?: boolean;
};

const EditTopic: FC<OwnProps & StateProps> = ({
  isActive,
  chat,
  topic,
  editTopicPanel,
  isCurrentUserPremium,
  onClose,
}) => {
  const { editTopic, openPremiumModal } = getActions();
  const [title, setTitle] = useState('');
  const [iconEmojiId, setIconEmojiId] = useState<string | undefined>(undefined);
  const lang = useLang();

  const isLoading = Boolean(editTopicPanel?.isLoading);
  const isGeneral = topic?.id === GENERAL_TOPIC_ID;

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (topic?.title || topic?.iconEmojiId) {
      setTitle(topic.title);
      setIconEmojiId(topic.iconEmojiId);
    }
  }, [topic]);

  const isTouched = useMemo(() => {
    return title !== topic?.title || iconEmojiId !== topic?.iconEmojiId;
  }, [iconEmojiId, title, topic?.iconEmojiId, topic?.title]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
  }, []);

  const handleEditTopic = useCallback(() => {
    editTopic({
      chatId: chat!.id,
      title,
      topicId: topic!.id,
      iconEmojiId,
    });
  }, [chat, editTopic, iconEmojiId, title, topic]);

  const handleCustomEmojiSelect = useCallback((emoji: ApiSticker) => {
    if (!emoji.isFree && !isCurrentUserPremium && emoji.id !== DEFAULT_TOPIC_ICON_STICKER_ID) {
      openPremiumModal({ initialSection: 'animated_emoji' });
      return;
    }

    if (emoji.id === DEFAULT_TOPIC_ICON_STICKER_ID) {
      setIconEmojiId(RESET_ICON_ID);
      return;
    }

    setIconEmojiId(emoji.id);
  }, [isCurrentUserPremium, openPremiumModal]);

  const dummyTopic = useMemo(() => {
    return {
      ...topic!,
      title,
      iconEmojiId,
    };
  }, [iconEmojiId, title, topic]);

  if (!chat?.isForum) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        {!topic && <Loading />}
        {topic && (
          <>
            <div className={buildClassName(styles.section, styles.top)}>
              <span className={styles.heading}>{lang('CreateTopicTitle')}</span>
              <Transition
                name="zoom-fade"
                activeKey={Number(dummyTopic.iconEmojiId) || 0}
                shouldCleanup
                direction={1}
                className={styles.iconWrapper}
              >
                <TopicIcon
                  topic={dummyTopic}
                  className={styles.icon}
                  size={ICON_SIZE}
                  noLoopLimit
                />
              </Transition>
              <InputText
                value={title}
                onChange={handleTitleChange}
                label={lang('lng_forum_topic_title')}
                disabled={isLoading}
                teactExperimentControlled
              />
            </div>
            {!isGeneral && (
              <div className={buildClassName(styles.section, styles.bottom)}>
                <CustomEmojiPicker
                  loadAndPlay={isActive}
                  onCustomEmojiSelect={handleCustomEmojiSelect}
                  className={styles.iconPicker}
                  withDefaultTopicIcons
                />
              </div>
            )}
          </>
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
    const { editTopicPanel } = selectTabState(global);
    const chat = editTopicPanel?.chatId ? selectChat(global, editTopicPanel.chatId) : undefined;
    const topic = editTopicPanel?.topicId ? chat?.topics?.[editTopicPanel?.topicId] : undefined;
    return {
      chat,
      topic,
      editTopicPanel,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(EditTopic));
