import type { OwnProps } from './GiftTransferConfirmModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftTransferConfirmModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftTransferConfirmModal = useModuleLoader(
    Bundles.Stars,
    'GiftTransferConfirmModal',
    !modal,
  );

  return GiftTransferConfirmModal ? <GiftTransferConfirmModal {...props} /> : undefined;
};

export default GiftTransferConfirmModalAsync;
