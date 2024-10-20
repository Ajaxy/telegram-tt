import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './StarsBalanceModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StarsBalanceModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const StarsBalanceModal = useModuleLoader(Bundles.Stars, 'StarsBalanceModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StarsBalanceModal ? <StarsBalanceModal {...props} /> : undefined;
};

export default StarsBalanceModalAsync;
