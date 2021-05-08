import React, { FC, memo } from '../../lib/teact/teact';
import { OwnProps } from './ReceiptModal';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const ReceiptModalAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const ReceiptModal = useModuleLoader(Bundles.Extra, 'ReceiptModal', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return ReceiptModal ? <ReceiptModal {...props} /> : undefined;
};

export default memo(ReceiptModalAsync);
