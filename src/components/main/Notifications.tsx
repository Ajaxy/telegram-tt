import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiNotification } from '../../api/types';

import { selectTabState } from '../../global/selectors';
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
      {notifications.map((notification) => (
        <Notification
          key={notification.localId}
          title={notification.title
            ? renderText(notification.title, ['simple_markdown', 'emoji', 'br', 'links']) : undefined}
          action={notification.action}
          actionText={notification.actionText}
          className={notification.className}
          duration={notification.duration}
          icon={notification.icon}
          cacheBreaker={notification.cacheBreaker}
          message={renderText(notification.message, ['simple_markdown', 'emoji', 'br', 'links'])}
          shouldDisableClickDismiss={notification.disableClickDismiss}
          dismissAction={notification.dismissAction}
          shouldShowTimer={notification.shouldShowTimer}
          // eslint-disable-next-line react/jsx-no-bind
          onDismiss={() => dismissNotification({ localId: notification.localId })}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(selectTabState(global), ['notifications']),
)(Notifications));
