import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';

import { getHasAdminRight } from '../../../global/helpers';
import { selectAnimatedEmoji, selectChat } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import Button from '../../ui/Button';

import styles from './EmptyForum.module.scss';

type OwnProps = {
  chatId: string;
};

type StateProps = {
  animatedEmoji?: ApiSticker;
  canManageTopics?: boolean;
};

const ICON_SIZE = 7 * REM;

const EmptyForum: FC<OwnProps & StateProps> = ({
  chatId, animatedEmoji, canManageTopics,
}) => {
  const { openCreateTopicPanel } = getActions();

  const lang = useOldLang();
  const { isMobile } = useAppLayout();

  const handleCreateTopic = useCallback(() => {
    openCreateTopicPanel({ chatId });
  }, [chatId, openCreateTopicPanel]);

  return (
    <div className={styles.root}>
      <div className={styles.sticker}>
        {animatedEmoji && <AnimatedIconFromSticker sticker={animatedEmoji} size={ICON_SIZE} />}
      </div>
      <h3 className={styles.title} dir="auto">{lang('ChatList.EmptyTopicsTitle')}</h3>
      <p className={buildClassName(styles.description, styles.centered)} dir="auto">
        {lang('ChatList.EmptyTopicsDescription')}
      </p>
      {canManageTopics && (
        <Button
          ripple={!isMobile}
          fluid
          onClick={handleCreateTopic}
          isRtl={lang.isRtl}
        >
          <div className={styles.buttonText}>
            {lang('ChatList.EmptyTopicsCreate')}
          </div>
        </Button>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global, { chatId }): Complete<StateProps> => {
  const chat = selectChat(global, chatId);
  const canManageTopics = chat && (chat.isCreator || getHasAdminRight(chat, 'manageTopics'));

  return {
    animatedEmoji: selectAnimatedEmoji(global, '🐣'),
    canManageTopics,
  };
})(EmptyForum));
