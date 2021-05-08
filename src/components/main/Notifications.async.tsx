import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const NotificationsAsync: FC = ({ isOpen }) => {
  const Notifications = useModuleLoader(Bundles.Extra, 'Notifications', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Notifications ? <Notifications /> : undefined;
};

export default memo(NotificationsAsync);
