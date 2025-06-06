import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './PinMessageModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const PinMessageModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PinMessageModal = useModuleLoader(Bundles.Extra, 'PinMessageModal', !isOpen);

  return PinMessageModal ? <PinMessageModal {...props} /> : undefined;
};

export default PinMessageModalAsync;
