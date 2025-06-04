import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './StarsGiftingPickerModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StarsGiftingPickerModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const StarsGiftingPickerModal = useModuleLoader(Bundles.Stars, 'StarsGiftingPickerModal', !isOpen);

  return StarsGiftingPickerModal ? <StarsGiftingPickerModal {...props} /> : undefined;
};

export default StarsGiftingPickerModalAsync;
