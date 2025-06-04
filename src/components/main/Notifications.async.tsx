import type { FC } from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const NotificationsAsync: FC = ({ isOpen }) => {
  const Notifications = useModuleLoader(Bundles.Extra, 'Notifications', !isOpen);

  return Notifications ? <Notifications /> : undefined;
};

export default NotificationsAsync;
