import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './AttachBotInstallModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const AttachBotInstallModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const AttachBotInstallModal = useModuleLoader(Bundles.Extra, 'AttachBotInstallModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return AttachBotInstallModal ? <AttachBotInstallModal {...props} /> : undefined;
};

export default AttachBotInstallModalAsync;
