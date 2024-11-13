import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const WebAppsCloseConfirmationModalAsync: FC = (props) => {
  const { modal } = props;
  const WebAppsCloseConfirmationModal = useModuleLoader(Bundles.Extra, 'WebAppsCloseConfirmationModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return WebAppsCloseConfirmationModal ? <WebAppsCloseConfirmationModal isOpen={modal} /> : undefined;
};

export default WebAppsCloseConfirmationModalAsync;
