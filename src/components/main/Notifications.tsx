import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiNotification } from '../../api/types';

import { selectTabState } from '../../global/selectors';
import { pick } from '../../util/iteratees';

import Notification from '../ui/Notification';

type StateProps = {
  notifications: ApiNotification[];
};

const Notifications: FC<StateProps> = ({ notifications }) => {
  if (!notifications.length) {
    return undefined;
  }

  return (
    <div id="Notifications">
      {notifications.map((notification) => (
        <Notification notification={notification} />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(selectTabState(global), ['notifications']),
)(Notifications));
