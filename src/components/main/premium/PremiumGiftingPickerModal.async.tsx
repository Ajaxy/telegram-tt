import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PremiumGiftingPickerModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PremiumGiftingPickerModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PremiumGiftingPickerModal = useModuleLoader(Bundles.Extra, 'PremiumGiftingPickerModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PremiumGiftingPickerModal ? <PremiumGiftingPickerModal {...props} /> : undefined;
};

export default PremiumGiftingPickerModalAsync;
