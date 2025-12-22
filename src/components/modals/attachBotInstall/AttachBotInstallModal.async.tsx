import type { OwnProps } from './AttachBotInstallModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachBotInstallModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const AttachBotInstallModal = useModuleLoader(Bundles.Extra, 'AttachBotInstallModal', !modal);

  return AttachBotInstallModal ? <AttachBotInstallModal {...props} /> : undefined;
};

export default AttachBotInstallModalAsync;
