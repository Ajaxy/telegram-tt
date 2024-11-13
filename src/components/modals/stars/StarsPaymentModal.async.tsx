import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './StarsPaymentModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StarPaymentModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const StarPaymentModal = useModuleLoader(Bundles.Stars, 'StarPaymentModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StarPaymentModal ? <StarPaymentModal {...props} /> : undefined;
};

export default StarPaymentModalAsync;
