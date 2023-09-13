import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import type { OwnProps } from './PinMessageModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const PinMessageModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PinMessageModal = useModuleLoader(Bundles.Extra, 'PinMessageModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PinMessageModal ? <PinMessageModal {...props} /> : undefined;
};

export default PinMessageModalAsync;
