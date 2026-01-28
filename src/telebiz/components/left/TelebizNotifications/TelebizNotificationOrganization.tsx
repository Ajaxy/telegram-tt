import { memo, useCallback, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { type Notification, NotificationStatus } from '../../../services/types';
import { TelebizSettingsScreens } from '../types';

import buildClassName from '../../../../util/buildClassName';
import { formatPastDatetime } from '../../../../util/dates/dateFormat';

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
}

const TelebizNotificationOrganization = ({
  notification, className, onClick,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const {
    openTelebizSettingsScreen,
    markTelebizNotificationRead,
  } = getActions();

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() =>
    ref.current?.closest('.TelebizNotifications-module__notification'));

  const lang = useLang();

  const handleClick = useCallback(() => {
    if (notification.status === NotificationStatus.UNREAD) {
      markTelebizNotificationRead({ notificationId: notification.id });
    }

    onClick?.(notification.id.toString());

    openTelebizSettingsScreen({
      screen: TelebizSettingsScreens.Organizations,
    });
  }, [notification, markTelebizNotificationRead, onClick, openTelebizSettingsScreen]);

  return (
    <ListItem
      key={notification.id}
      className={buildClassName(styles.notification, className)}
      buttonClassName={styles.notificationButton}
      ref={ref}
      onContextMenu={handleContextMenu}
      leftElement={(
        <TelebizNotificationAvatar notification={notification} />
      )}
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
          {notification.message}
        </div>
        <div className={styles.notificationTime}>
          {formatPastDatetime(lang, new Date(notification.created_at).getTime() / 1000)}
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

export default memo(TelebizNotificationOrganization);
