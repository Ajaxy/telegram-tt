import React, { FC, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiNotification } from '../../api/types';

import { pick } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';

import Notification from '../ui/Notification';

type StateProps = {
  notifications: ApiNotification[];
};

const Notifications: FC<StateProps> = ({ notifications }) => {
  const { dismissNotification } = getActions();

  if (!notifications.length) {
    return undefined;
  }

  return (
    <div id="Notifications">
      {notifications.map(({ message, localId }) => (
        <Notification
          message={renderText(message, ['emoji', 'br', 'links', 'simple_markdown'])}
          // eslint-disable-next-line react/jsx-no-bind
          onDismiss={() => dismissNotification({ localId })}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['notifications']),
)(Notifications));
