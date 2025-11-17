import type { OwnProps } from './StealthModeModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StealthModeModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const StealthModeModal = useModuleLoader(Bundles.Extra, 'StealthModeModal', !modal);

  return StealthModeModal ? <StealthModeModal {...props} /> : undefined;
};

export default StealthModeModalAsync;
