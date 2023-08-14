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
      {notifications.map(({
        message, className, localId, action, actionText, title, duration,
      }) => (
        <Notification
          title={title ? renderText(title, ['simple_markdown', 'emoji', 'br', 'links']) : undefined}
          action={action}
          actionText={actionText}
          className={className}
          duration={duration}
          message={renderText(message, ['simple_markdown', 'emoji', 'br', 'links'])}
          // eslint-disable-next-line react/jsx-no-bind
          onDismiss={() => dismissNotification({ localId })}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(selectTabState(global), ['notifications']),
)(Notifications));
