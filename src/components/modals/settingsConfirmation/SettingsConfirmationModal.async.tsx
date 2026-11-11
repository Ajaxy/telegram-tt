import type { OwnProps } from './SettingsConfirmationModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const SettingsConfirmationModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const SettingsConfirmationModal = useModuleLoader(Bundles.Extra, 'SettingsConfirmationModal', !isOpen);

  return SettingsConfirmationModal ? <SettingsConfirmationModal {...props} /> : undefined;
};

export default SettingsConfirmationModalAsync;
