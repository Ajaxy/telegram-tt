import type { OwnProps } from './GiftMoveToWalletModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftMoveToWalletModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftMoveToWalletModal = useModuleLoader(Bundles.Stars, 'GiftMoveToWalletModal', !modal);

  return GiftMoveToWalletModal ? <GiftMoveToWalletModal {...props} /> : undefined;
};

export default GiftMoveToWalletModalAsync;
