import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PremiumGiftingModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PremiumGiftingModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PremiumGiftingModal = useModuleLoader(Bundles.Extra, 'PremiumGiftingModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PremiumGiftingModal ? <PremiumGiftingModal {...props} /> : undefined;
};

export default PremiumGiftingModalAsync;
