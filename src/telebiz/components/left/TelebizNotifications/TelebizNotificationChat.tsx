import { memo, useCallback, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat } from '../../../../api/types';
import { type Notification, NotificationStatus, NotificationType } from '../../../services/types';

import { selectChat } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatPastDatetime } from '../../../../util/dates/dateFormat';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';

import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import ListItem from '../../../../components/ui/ListItem';
import TelebizNotificationAvatar from './TelebizNotificationAvatar';
import TelebizNotificationContextMenu from './TelebizNotificationContextMenu';

import styles from './TelebizNotifications.module.scss';

interface OwnProps {
  notification: Notification;
  className?: string;
  onClick?: (notificationId: string) => void;
  isSelected: boolean;
}

interface StateProps {
  chat?: ApiChat;
}

const TelebizNotificationChat = ({
  notification, className, isSelected, onClick, chat,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const {
    openChat,
    markTelebizNotificationRead,
  } = getActions();

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() =>
    ref.current?.closest('.TelebizNotifications-module__notification'));

  const lang = useLang();

  const notificationTime = useMemo(() => {
    switch (notification.type) {
      case NotificationType.REMINDER:
        return new Date(notification.metadata?.original_remind_at).getTime() / 1000;
      default:
        return new Date(notification.created_at).getTime() / 1000;
    }
  }, [notification]);

  const handleClick = useCallback(() => {
    if (notification.status === NotificationStatus.UNREAD) {
      markTelebizNotificationRead({ notificationId: notification.id });
    }

    onClick?.(notification.id.toString());

    if (chat?.id) {
      openChat({
        id: chat?.id,
        tabId: getCurrentTabId(),
      });
    }
  }, [notification, markTelebizNotificationRead, onClick, openChat, chat?.id]);

  return (
    <ListItem
      key={notification.id}
      className={buildClassName(styles.notification, className, isSelected && styles.selected)}
      buttonClassName={styles.notificationButton}
      ref={ref}
      onContextMenu={handleContextMenu}
      leftElement={<TelebizNotificationAvatar notification={notification} />}
      rightElement={
        notification.status === NotificationStatus.UNREAD
          ? (
            <div className={styles.unreadContainer}>
              <div className={styles.unreadIndicator}></div>
            </div>
          ) : undefined
      }
      onClick={handleClick}
    >
      <div className={styles.notificationContent}>
        <div className={styles.notificationTitle}>
          {notification.title}
        </div>
        <div className={styles.notificationMessage}>
          <span className={styles.messageSummary}>
            {notification.message}
          </span>
        </div>
        <div className={styles.notificationTime}>
          {formatPastDatetime(lang, notificationTime)}
          {chat?.title && (
            <span className={styles.notificationChatTitle}>
              {' \u2022 '}
              {chat.title}
            </span>
          )}
        </div>
      </div>
      <TelebizNotificationContextMenu
        notification={notification}
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { notification }): Complete<StateProps> => {
    const chatId = notification.metadata?.chat_id;
    const chatData = chatId ? selectChat(global, chatId) : undefined;
    return {
      chat: chatData,
    };
  },
)(TelebizNotificationChat));
