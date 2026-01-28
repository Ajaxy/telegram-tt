import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { TelebizSettingsScreens } from '../types';

import { selectTelebizNotificationsUnreadCount } from '../../../global/selectors';

import Button from '../../../../components/ui/Button';
import Notification from '../../icons/Notification';

import styles from './TelebizNotificationsButton.module.scss';

type StateProps = {
  unreadCount: number;
};

const TelebizNotificationsButton: FC<StateProps> = ({ unreadCount }) => {
  const { openTelebizSettingsScreen } = getActions();

  return (
    <Button
      round
      size="smaller"
      color="translucent"
      onClick={() => {
        openTelebizSettingsScreen({ screen: TelebizSettingsScreens.Notifications });
      }}
      className={styles.telebizNotificationsButton}
    >
      <div className={styles.wrapper}>
        <Notification />
        {unreadCount > 0 && <div className={styles.dot} />}
      </div>
    </Button>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    unreadCount: selectTelebizNotificationsUnreadCount(global),
  }),
)(TelebizNotificationsButton));
