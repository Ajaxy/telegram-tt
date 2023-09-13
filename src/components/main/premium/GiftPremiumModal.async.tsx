import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './GiftPremiumModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GiftPremiumModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const GiftPremiumModal = useModuleLoader(Bundles.Extra, 'GiftPremiumModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return GiftPremiumModal ? <GiftPremiumModal {...props} /> : undefined;
};

export default GiftPremiumModalAsync;
