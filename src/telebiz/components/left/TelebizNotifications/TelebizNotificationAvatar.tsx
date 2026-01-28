import { memo, useMemo } from '@teact';
import { withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import { type Notification, NotificationType } from '../../../services/types';

import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import Avatar from '../../../../components/common/Avatar';
import Logo from '../../icons/Logo';
import { FollowupNotification, InvitationNotification, ReminderNotification } from '../../icons/Notifications';

import styles from './TelebizNotifications.module.scss';

interface OwnProps {
  notification: Notification;
}

interface StateProps {
  peer?: ApiPeer;
}

const TelebizNotificationAvatar = ({ notification, peer }: OwnProps & StateProps) => {
  const AvatarComponent = useMemo(() => {
    switch (notification.type) {
      case NotificationType.REMINDER:
      case NotificationType.FOLLOWUP:
        return <Avatar peer={peer} size="medium" className={styles.notificationAvatarImage} />;
      case NotificationType.INVITATION_APPROVED:
      case NotificationType.INVITATION_RECEIVED:
        return (
          <Avatar
            previewUrl={notification.organization?.logo_url}
            text={notification.organization?.name}
            size="medium"
            className={styles.notificationAvatarImage}
          />
        );
      case NotificationType.SYSTEM:
        return <Logo className={buildClassName(styles.notificationAvatarImage, styles.notificationAvatarSystem)} />;
      default:
        return <div>AB</div>;
    }
  }, [notification, peer]);

  const IconComponent = useMemo(() => {
    switch (notification.type) {
      case NotificationType.REMINDER:
        return <ReminderNotification />;
      case NotificationType.FOLLOWUP:
        return <FollowupNotification />;
      case NotificationType.INVITATION_APPROVED:
      case NotificationType.INVITATION_RECEIVED:
        return <InvitationNotification />;
      case NotificationType.SYSTEM:
        return undefined;
      default:
        return <div>AB</div>;
    }
  }, [notification]);

  return (
    <div className={styles.notificationAvatar}>
      {AvatarComponent}
      {
        notification.type !== NotificationType.SYSTEM && (
          <div className={buildClassName(styles.notificationAvatarIcon, styles[notification.type])}>
            {IconComponent}
          </div>
        )
      }
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { notification }): Complete<StateProps> => {
    const peerId = notification.metadata?.chat_id;
    const peer = peerId ? selectPeer(global, peerId) : undefined;
    return {
      peer,
    };
  },
)(TelebizNotificationAvatar));
