import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './PaymentModal';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const PaymentModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const PaymentModal = useModuleLoader(Bundles.Extra, 'PaymentModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PaymentModal ? <PaymentModal {...props} /> : undefined;
};

export default memo(PaymentModalAsync);
