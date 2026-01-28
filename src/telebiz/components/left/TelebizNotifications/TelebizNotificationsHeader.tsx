import { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';
import HeaderMenuButton from '../../common/HeaderMenuButton';

import styles from './TelebizNotificationsHeader.module.scss';

const TelebizNotificationsHeader = () => {
  const { markAllTelebizNotificationsRead } = getActions();

  const handleMarkAllAsRead = () => {
    markAllTelebizNotificationsRead();
  };

  return (
    <div className={styles.container}>
      <h3>Telebiz Notifications</h3>
      <DropdownMenu
        className="settings-more-menu"
        trigger={HeaderMenuButton}
        positionX="right"
      >
        <MenuItem icon="message-read" onClick={handleMarkAllAsRead}>
          Mark all as read
        </MenuItem>
      </DropdownMenu>
    </div>
  );
};

export default memo(TelebizNotificationsHeader);
