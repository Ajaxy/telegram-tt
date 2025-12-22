import type { OwnProps } from './PinMessageModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const PinMessageModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const PinMessageModal = useModuleLoader(Bundles.Extra, 'PinMessageModal', !isOpen);

  return PinMessageModal ? <PinMessageModal {...props} /> : undefined;
};

export default PinMessageModalAsync;
