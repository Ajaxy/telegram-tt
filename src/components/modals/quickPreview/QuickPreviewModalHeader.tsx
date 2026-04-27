import type { FC } from '@teact';
import { memo } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiTypingStatus, ApiUpdateConnectionStateType } from '../../../api/types';
import type { ThreadId } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getIsSavedDialog } from '../../../global/helpers';
import { selectChat } from '../../../global/selectors';
import {
  selectThreadLocalStateParam,
  selectThreadMessagesCount,
  selectThreadReadState,
} from '../../../global/selectors/threads';
import { isUserId } from '../../../util/entities/ids';

import useConnectionStatus from '../../../hooks/useConnectionStatus';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GroupChatInfo from '../../common/GroupChatInfo';
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
  typingStatusByPeerId?: Record<string, ApiTypingStatus>;
  isSavedDialog?: boolean;
  messagesCount?: number;
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
  typingStatusByPeerId,
  isSavedDialog,
  messagesCount,
  unreadCount,
  hasUnreadMark,
  onClose,
}) => {
  const lang = useLang();
  const { markChatMessagesRead } = getActions();
  const {
    connectionStatusText,
  } = useConnectionStatus(lang, connectionState, isSyncing || isFetchingDifference, true);

  const handleMarkAsRead = useLastCallback(() => {
    markChatMessagesRead({ id: chatId });
  });

  const savedMessagesStatus = isSavedDialog
    ? (messagesCount !== undefined
      ? lang('Messages', { count: messagesCount }, { pluralValue: messagesCount }) : lang('SavedMessages'))
    : undefined;
  const realChatId = isSavedDialog && threadId ? String(threadId) : chatId;
  const displayChatId = chat?.isMonoforum ? chat.linkedMonoforumId! : realChatId;

  return (
    <div className={styles.root}>
      {Boolean(unreadCount || hasUnreadMark) && (
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={lang('ChatListContextMarkAsRead')}
          onClick={handleMarkAsRead}
          className={styles.markAsReadButton}
          iconName="readchats"
        />
      )}
      <Button
        round
        color="translucent"
        size="tiny"
        ariaLabel={lang('Close')}
        onClick={onClose}
        className={styles.closeButton}
        iconName="close"
      />
      <div className="modal-title">
        <div className={styles.chatInfoOverride}>
          {isUserId(displayChatId) ? (
            <PrivateChatInfo
              key={displayChatId}
              userId={displayChatId}
              typingStatusByPeerId={typingStatusByPeerId}
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
              typingStatusByPeerId={typingStatusByPeerId}
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
    const typingStatusByPeerId = selectThreadLocalStateParam(
      global,
      chatId,
      threadId || MAIN_THREAD_ID,
      'typingStatusByPeerId',
    );
    const isSavedDialog = getIsSavedDialog(chatId, threadId || MAIN_THREAD_ID, global.currentUserId);
    const messagesCount = isSavedDialog && threadId
      ? selectThreadMessagesCount(global, chatId, threadId)
      : undefined;
    const readState = selectThreadReadState(global, chatId, threadId || MAIN_THREAD_ID);
    const unreadCount = readState?.unreadCount;

    return {
      chat,
      connectionState: global.connectionState,
      isSyncing: global.isSyncing,
      isFetchingDifference: global.isFetchingDifference,
      typingStatusByPeerId,
      isSavedDialog,
      messagesCount,
      unreadCount,
      hasUnreadMark: readState?.hasUnreadMark,
    };
  },
)(QuickPreviewModalHeader));
