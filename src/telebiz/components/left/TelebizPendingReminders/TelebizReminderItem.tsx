import { memo, useCallback, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat, ApiMessage } from '../../../../api/types';
import type { Reminder } from '../../../services/types';

import { selectChat, selectChatMessage } from '../../../../global/selectors';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';
import { formatDateTime } from '../../../util/dates';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useEnsureMessage from '../../../../hooks/useEnsureMessage';
import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Avatar from '../../../../components/common/Avatar';
import Icon from '../../../../components/common/icons/Icon';
import MessageSummary from '../../../../components/common/MessageSummary';
import ListItem from '../../../../components/ui/ListItem';
import TelebizReminderContextMenu from './TelebizReminderContextMenu';

import styles from './TelebizPendingReminders.module.scss';

interface OwnProps {
  reminder: Reminder;
  onEdit?: (reminder: Reminder) => void;
}

interface StateProps {
  message?: ApiMessage;
  chat?: ApiChat;
}

const TelebizReminderItem = ({
  reminder,
  message,
  chat,
  onEdit,
}: OwnProps & StateProps) => {
  const { focusMessage } = getActions();
  const lang = useTelebizLang();
  const ref = useRef<HTMLDivElement>();

  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const messageId = reminder.message_id ? Number(reminder.message_id) : undefined;
  const chatId = reminder.chat_id;

  useEnsureMessage(chatId, messageId, message);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current?.closest('.custom-scroll'));

  const handleClick = useCallback(() => {
    if (chat?.id && messageId) {
      focusMessage({
        chatId: chat.id,
        messageId,
        tabId: getCurrentTabId(),
      });
    }
  }, [focusMessage, chat?.id, messageId]);

  const handleEdit = useLastCallback(() => {
    onEdit?.(reminder);
  });

  const formattedDate = useMemo(() => {
    return formatDateTime(reminder.remind_at);
  }, [reminder.remind_at]);

  return (
    <ListItem
      ref={ref}
      className={styles.reminderItem}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div className={styles.reminderIcon}>
        <Avatar peer={chat} size="medium" className={styles.notificationAvatarImage} />
      </div>
      <div className={styles.reminderContent}>
        <div className={styles.reminderTitle}>
          {chat?.title || lang('PendingReminders.UnknownChat')}
        </div>
        {reminder.description && (
          <div className={styles.reminderDescription}>
            {reminder.description}
          </div>
        )}
        <div className={styles.reminderMessage}>
          {message ? (
            <MessageSummary
              message={message}
              noEmoji
              inChatList
            />
          ) : (
            <span className={styles.messageLoading}>{lang('PendingReminders.LoadingMessage')}</span>
          )}
        </div>
        <div className={styles.reminderTime}>
          <Icon name="calendar" className={styles.calendarIcon} />
          {formattedDate}
        </div>
      </div>
      <TelebizReminderContextMenu
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        onEdit={handleEdit}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { reminder }): Complete<StateProps> => {
    const messageId = reminder.message_id ? Number(reminder.message_id) : undefined;
    const message = messageId
      ? selectChatMessage(global, reminder.chat_id, messageId)
      : undefined;
    const chat = selectChat(global, reminder.chat_id);
    return {
      message,
      chat,
    };
  },
)(TelebizReminderItem));
