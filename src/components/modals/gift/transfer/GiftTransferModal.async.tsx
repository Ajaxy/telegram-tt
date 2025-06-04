import type { FC } from '../../../../lib/teact/teact';

import type { OwnProps } from './GiftTransferModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftTransferModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const GiftTransferModal = useModuleLoader(Bundles.Stars, 'GiftTransferModal', !modal);

  return GiftTransferModal ? <GiftTransferModal {...props} /> : undefined;
};

export default GiftTransferModalAsync;
