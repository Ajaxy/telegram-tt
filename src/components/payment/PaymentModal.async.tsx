import type { OwnProps } from './PaymentModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const PaymentModalAsync = (props: OwnProps) => {
  const { isOpen } = props;
  const PaymentModal = useModuleLoader(Bundles.Extra, 'PaymentModal', !isOpen);

  return PaymentModal ? <PaymentModal {...props} /> : undefined;
};

export default PaymentModalAsync;
