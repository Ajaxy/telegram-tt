import type { OwnProps } from './GiftTransferModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftTransferModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftTransferModal = useModuleLoader(Bundles.Stars, 'GiftTransferModal', !modal);

  return GiftTransferModal ? <GiftTransferModal {...props} /> : undefined;
};

export default GiftTransferModalAsync;
