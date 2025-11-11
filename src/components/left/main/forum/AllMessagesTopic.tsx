import { memo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import { type ApiMessage, MAIN_THREAD_ID } from '../../../../api/types';

import { selectChatLastMessage } from '../../../../global/selectors';
import { IS_OPEN_IN_NEW_TAB_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import { createLocationHash } from '../../../../util/routing';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import LastMessageMeta from '../../../common/LastMessageMeta';
import ListItem from '../../../ui/ListItem';

import styles from './Topic.module.scss';

type OwnProps = {
  chatId: string;
  isSelected: boolean;
  style?: string;
};

type StateProps = {
  lastMessage?: ApiMessage;
};

const AllMessagesTopic = ({
  chatId, isSelected, style, lastMessage,
}: OwnProps & StateProps) => {
  const { openThread, openQuickPreview } = getActions();

  const lang = useLang();

  const handleOpenTopic = useLastCallback((e: React.MouseEvent) => {
    if (e.altKey) {
      e.preventDefault();
      openQuickPreview({ id: chatId });
      return;
    }

    openThread({ chatId, threadId: MAIN_THREAD_ID, shouldReplaceHistory: true });
  });

  return (
    <ListItem
      className={buildClassName(
        styles.root,
        'Chat',
        isSelected && 'selected',
        'chat-item-clickable',
      )}
      onClick={handleOpenTopic}
      style={style}
      href={IS_OPEN_IN_NEW_TAB_SUPPORTED ? `#${createLocationHash(chatId, 'thread', MAIN_THREAD_ID)}` : undefined}
    >
      <div className="info">
        <div className="info-row">
          <div className={buildClassName('title')}>
            <h3 dir="auto" className="fullName">{lang('BotForumAllTopicTitle')}</h3>
          </div>
          <div className="separator" />
          {lastMessage && (
            <LastMessageMeta
              message={lastMessage}
            />
          )}
        </div>
        <div className="subtitle">
          <span className="last-message">
            {lang('BotForumAllTopicDescription')}
          </span>
        </div>
      </div>
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const lastMessage = selectChatLastMessage(global, chatId, 'all');
    return {
      lastMessage,
    };
  },
)(AllMessagesTopic));
