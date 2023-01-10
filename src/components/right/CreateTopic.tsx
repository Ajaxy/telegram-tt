import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiChat, ApiSticker } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { DEFAULT_TOPIC_ICON_STICKER_ID } from '../../config';
import { selectChat, selectIsCurrentUserPremium } from '../../global/selectors';
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
import CustomEmojiPicker from '../middle/composer/CustomEmojiPicker';
import Transition from '../ui/Transition';

import styles from './ManageTopic.module.scss';

const ICON_SIZE = 5 * REM;

export type OwnProps = {
  isActive: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  createTopicPanel?: GlobalState['createTopicPanel'];
  isCurrentUserPremium?: boolean;
};

const CreateTopic: FC<OwnProps & StateProps> = ({
  isActive,
  chat,
  createTopicPanel,
  isCurrentUserPremium,
  onClose,
}) => {
  const { createTopic, openPremiumModal } = getActions();
  const [title, setTitle] = useState('');
  const [iconColorIndex, setIconColorIndex] = useState(0);
  const [iconEmojiId, setIconEmojiId] = useState<string | undefined>(undefined);
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
      iconEmojiId,
    });
  }, [chat, createTopic, iconColorIndex, iconEmojiId, title]);

  const handleCustomEmojiSelect = useCallback((emoji: ApiSticker) => {
    if (!emoji.isFree && !isCurrentUserPremium) {
      openPremiumModal({ initialSection: 'animated_emoji' });
      return;
    }

    if (emoji.id === DEFAULT_TOPIC_ICON_STICKER_ID) {
      setIconEmojiId(undefined);
      return;
    }

    setIconEmojiId(emoji.id);
  }, [isCurrentUserPremium, openPremiumModal]);

  const dummyTopic = useMemo(() => {
    return {
      id: 0,
      title,
      iconColor: getTopicColors()[iconColorIndex],
      iconEmojiId,
    };
  }, [iconColorIndex, iconEmojiId, title]);

  if (!chat?.isForum) {
    return undefined;
  }

  return (
    <div className={styles.root}>
      <div className={buildClassName(styles.content, 'custom-scroll')}>
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
              className={buildClassName(styles.icon, styles.clickable)}
              onClick={handleIconClick}
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
        <div className={buildClassName(styles.section, styles.bottom)}>
          <CustomEmojiPicker
            loadAndPlay={isActive}
            onCustomEmojiSelect={handleCustomEmojiSelect}
            className={styles.iconPicker}
            withDefaultTopicIcons
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
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(CreateTopic));
