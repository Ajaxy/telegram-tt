import type { OwnProps } from './WebAppsCloseConfirmationModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const WebAppsCloseConfirmationModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const WebAppsCloseConfirmationModal = useModuleLoader(Bundles.Extra, 'WebAppsCloseConfirmationModal', !modal);

  return WebAppsCloseConfirmationModal ? <WebAppsCloseConfirmationModal modal={modal} /> : undefined;
};

export default WebAppsCloseConfirmationModalAsync;
