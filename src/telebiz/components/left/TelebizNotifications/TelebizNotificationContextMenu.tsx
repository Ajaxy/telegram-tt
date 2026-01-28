import { memo, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { Notification } from '../../../services/types';
import { NotificationStatus } from '../../../services/types';

import useLastCallback from '../../../../hooks/useLastCallback';

import Menu from '../../../../components/ui/Menu';
import MenuItem from '../../../../components/ui/MenuItem';

export const NOTIFICATION_CONTEXT_MENU_CLASS = 'notification-context-menu';

type OwnProps = {
  notification: Notification;
  isOpen: boolean;
  anchor?: { x: number; y: number };
  onClose: () => void;
  onCloseAnimationEnd: () => void;
  getTriggerElement: () => HTMLElement | undefined;
  getRootElement: () => Element | null | undefined;
};

const TelebizNotificationContextMenu = ({
  notification,
  isOpen,
  anchor,
  onClose,
  onCloseAnimationEnd,
  getTriggerElement,
  getRootElement,
}: OwnProps) => {
  const {
    markTelebizNotificationRead,
    markTelebizNotificationUnread,
  } = getActions();

  const menuRef = useRef<HTMLDivElement>();

  const getMenuElement = useLastCallback(() => {
    return document.querySelector('#portals')?.querySelector(`.${NOTIFICATION_CONTEXT_MENU_CLASS} .bubble`);
  });

  const getLayout = useLastCallback(() => ({ withPortal: true, shouldAvoidNegativePosition: true }));

  const isUnread = notification.status === NotificationStatus.UNREAD;

  const handleToggleReadStatus = useLastCallback(() => {
    if (isUnread) {
      markTelebizNotificationRead({ notificationId: notification.id });
    } else {
      markTelebizNotificationUnread({ notificationId: notification.id });
    }
  });

  if (!anchor) return undefined;

  const getRootElementAsHtml = useLastCallback(() => getRootElement() as HTMLElement | null | undefined);

  return (
    <Menu
      isOpen={isOpen}
      anchor={anchor}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      ref={menuRef}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElementAsHtml}
      getMenuElement={getMenuElement}
      autoClose
      className={NOTIFICATION_CONTEXT_MENU_CLASS}
      getLayout={getLayout}
      withPortal
    >
      <MenuItem
        icon={isUnread ? 'readchats' : 'unread'}
        onClick={handleToggleReadStatus}
      >
        {isUnread ? 'Mark as read' : 'Mark as unread'}
      </MenuItem>
    </Menu>
  );
};

export default memo(TelebizNotificationContextMenu);
