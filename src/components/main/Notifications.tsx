import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiNotification } from '../../api/types';

import { pick } from '../../util/iteratees';

import Notification from '../ui/Notification';
import renderText from '../common/helpers/renderText';

type StateProps = {
  notifications: ApiNotification[];
};

type DispatchProps = Pick<GlobalActions, 'dismissNotification'>;

const Notifications: FC<StateProps & DispatchProps> = ({ notifications, dismissNotification }) => {
  if (!notifications.length) {
    return undefined;
  }

  return (
    <div id="Notifications">
      {notifications.map(({ message }) => (
        <Notification
          message={renderText(message, ['emoji', 'br', 'links', 'simple_markdown'])}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['notifications']),
  (setGlobal, actions): DispatchProps => pick(actions, ['dismissNotification']),
)(Notifications));
