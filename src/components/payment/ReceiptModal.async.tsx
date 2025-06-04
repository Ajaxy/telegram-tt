import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './ReceiptModal';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ReceiptModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ReceiptModal = useModuleLoader(Bundles.Extra, 'ReceiptModal', !isOpen);

  return ReceiptModal ? <ReceiptModal {...props} /> : undefined;
};

export default ReceiptModalAsync;
