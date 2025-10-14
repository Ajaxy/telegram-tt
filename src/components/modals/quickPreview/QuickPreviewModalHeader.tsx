import type { FC } from '@teact';
import { memo } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiTypingStatus, ApiUpdateConnectionStateType } from '../../../api/types';
import type { ThreadId } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getIsSavedDialog } from '../../../global/helpers';
import { selectChat, selectThreadParam, selectTopic } from '../../../global/selectors';
import { isUserId } from '../../../util/entities/ids';

import useConnectionStatus from '../../../hooks/useConnectionStatus';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import GroupChatInfo from '../../common/GroupChatInfo';
import Icon from '../../common/icons/Icon';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import Button from '../../ui/Button';

import styles from './QuickPreviewModalHeader.module.scss';

type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  onClose: VoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  connectionState?: ApiUpdateConnectionStateType;
  isSyncing?: boolean;
  isFetchingDifference?: boolean;
  typingStatus?: ApiTypingStatus;
  isSavedDialog?: boolean;
  unreadCount?: number;
  hasUnreadMark?: boolean;
};

const EMOJI_STATUS_SIZE = 22;

const QuickPreviewModalHeader: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  chat,
  connectionState,
  isSyncing,
  isFetchingDifference,
  typingStatus,
  isSavedDialog,
  unreadCount,
  hasUnreadMark,
  onClose,
}) => {
  const lang = useLang();
  const oldLang = useOldLang();
  const { markChatMessagesRead } = getActions();
  const {
    connectionStatusText,
  } = useConnectionStatus(oldLang, connectionState, isSyncing || isFetchingDifference, true);

  const handleMarkAsRead = useLastCallback(() => {
    markChatMessagesRead({ id: chatId });
  });

  const savedMessagesStatus = isSavedDialog ? lang('SavedMessages') : undefined;
  const realChatId = isSavedDialog ? String(MAIN_THREAD_ID) : chatId;
  const displayChatId = chat?.isMonoforum ? chat.linkedMonoforumId! : realChatId;

  return (
    <div className={styles.root}>
      {Boolean(unreadCount || hasUnreadMark) && (
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={lang('ChatListContextMaskAsRead')}
          onClick={handleMarkAsRead}
          className={styles.markAsReadButton}
        >
          <Icon name="readchats" />
        </Button>
      )}
      <Button
        round
        color="translucent"
        size="smaller"
        ariaLabel={lang('Close')}
        onClick={onClose}
        className={styles.closeButton}
      >
        <Icon name="close" />
      </Button>
      <div className="modal-title">
        <div className={styles.chatInfoOverride}>
          {isUserId(displayChatId) ? (
            <PrivateChatInfo
              key={displayChatId}
              userId={displayChatId}
              typingStatus={typingStatus}
              status={connectionStatusText || savedMessagesStatus}
              withDots={Boolean(connectionStatusText)}
              withFullInfo={false}
              withMediaViewer={false}
              withStory={false}
              withUpdatingStatus
              isSavedDialog={isSavedDialog}
              emojiStatusSize={EMOJI_STATUS_SIZE}
              noRtl
            />
          ) : (
            <GroupChatInfo
              key={displayChatId}
              chatId={displayChatId}
              threadId={!isSavedDialog ? threadId : undefined}
              typingStatus={typingStatus}
              withMonoforumStatus={chat?.isMonoforum}
              status={connectionStatusText || savedMessagesStatus}
              withDots={Boolean(connectionStatusText)}
              withMediaViewer={false}
              withFullInfo={false}
              withUpdatingStatus
              withStory={false}
              isSavedDialog={isSavedDialog}
              emojiStatusSize={EMOJI_STATUS_SIZE}
              noRtl
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const typingStatus = selectThreadParam(global, chatId, threadId || MAIN_THREAD_ID, 'typingStatus');
    const isSavedDialog = getIsSavedDialog(chatId, threadId || MAIN_THREAD_ID, global.currentUserId);
    const unreadCount = chat?.isForum && threadId
      ? selectTopic(global, chatId, threadId)?.unreadCount
      : chat?.unreadCount;

    return {
      chat,
      connectionState: global.connectionState,
      isSyncing: global.isSyncing,
      isFetchingDifference: global.isFetchingDifference,
      typingStatus,
      isSavedDialog,
      unreadCount,
      hasUnreadMark: chat?.hasUnreadMark,
    };
  },
)(QuickPreviewModalHeader));
