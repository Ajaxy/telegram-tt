import React, { FC, memo } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiNotification } from '../../api/types';

import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';

import Notification from '../ui/Notification';

type StateProps = {
  notifications: ApiNotification[];
};

const Notifications: FC<StateProps> = ({ notifications }) => {
  const { dismissNotification } = getDispatch();

  if (!notifications.length) {
    return undefined;
  }

  return (
    <div id="Notifications">
      {notifications.map(({ message, localId }) => (
        <Notification
          message={renderText(message, ['emoji', 'br', 'links', 'simple_markdown'])}
          onDismiss={() => dismissNotification({ localId })}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['notifications']),
)(Notifications));
