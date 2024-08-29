import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PremiumGiftModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PremiumGiftModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PremiumGiftModal = useModuleLoader(Bundles.Extra, 'PremiumGiftModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PremiumGiftModal ? <PremiumGiftModal {...props} /> : undefined;
};

export default PremiumGiftModalAsync;
