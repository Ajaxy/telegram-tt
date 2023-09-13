import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PremiumMainModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PremiumMainModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PremiumMainModal = useModuleLoader(Bundles.Extra, 'PremiumMainModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PremiumMainModal ? <PremiumMainModal {...props} /> : undefined;
};

export default PremiumMainModalAsync;
