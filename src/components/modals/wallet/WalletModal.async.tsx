import type { OwnProps } from './WalletModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const WalletModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const WalletModal = useModuleLoader(Bundles.Wallet, 'WalletModal', !modal);

  return WalletModal ? <WalletModal {...props} /> : undefined;
};

export default WalletModalAsync;
