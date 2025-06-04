import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './AttachBotInstallModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachBotInstallModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const AttachBotInstallModal = useModuleLoader(Bundles.Extra, 'AttachBotInstallModal', !modal);

  return AttachBotInstallModal ? <AttachBotInstallModal {...props} /> : undefined;
};

export default AttachBotInstallModalAsync;
