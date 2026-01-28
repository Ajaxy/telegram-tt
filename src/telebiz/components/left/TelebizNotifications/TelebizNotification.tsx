import { memo, useMemo } from '@teact';

import { type Notification, NotificationType } from '../../../services/types';

import TelebizNotificationChat from './TelebizNotificationChat';
import TelebizNotificationMessage from './TelebizNotificationMessage';
import TelebizNotificationOrganization from './TelebizNotificationOrganization';
import TelebizNotificationSystem from './TelebizNotificationSystem';

interface OwnProps {
  notification: Notification;
  className?: string;
  onClick?: (notificationId: string) => void;
  isSelected: boolean;
}

const TelebizNotification = ({
  notification, className, isSelected, onClick,
}: OwnProps) => {
  const renderNotificationMessage = useMemo(() => {
    switch (notification.type) {
      case NotificationType.REMINDER:
        return (
          <TelebizNotificationMessage
            notification={notification}
            className={className}
            isSelected={isSelected}
            onClick={onClick}
          />
        );
      case NotificationType.FOLLOWUP:
        return (
          <TelebizNotificationChat
            notification={notification}
            className={className}
            isSelected={isSelected}
            onClick={onClick}
          />
        );
      case NotificationType.INVITATION_RECEIVED:
      case NotificationType.INVITATION_APPROVED:
        return (
          <TelebizNotificationOrganization
            notification={notification}
            className={className}
            onClick={onClick}
          />
        );
      case NotificationType.SYSTEM:
        return (
          <TelebizNotificationSystem
            notification={notification}
            className={className}
            onClick={onClick}
          />
        );
      default:
        return undefined;
    }
  }, [notification, className, isSelected, onClick]);

  return (
    <>{renderNotificationMessage}</>
  );
};

export default memo(TelebizNotification);
