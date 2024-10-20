import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

import type { OwnProps } from './StarsTransactionModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const StarsTransactionModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const StarsTransactionModal = useModuleLoader(Bundles.Stars, 'StarsTransactionInfoModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StarsTransactionModal ? <StarsTransactionModal {...props} /> : undefined;
};

export default StarsTransactionModalAsync;
