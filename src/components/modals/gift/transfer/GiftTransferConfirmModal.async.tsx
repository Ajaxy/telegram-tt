import type { FC } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftTransferConfirmModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftTransferConfirmModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftTransferConfirmModal = useModuleLoader(
    Bundles.Stars,
    'GiftTransferConfirmModal',
    !modal,
  );

  return GiftTransferConfirmModal ? <GiftTransferConfirmModal {...props} /> : undefined;
};

export default GiftTransferConfirmModalAsync;
