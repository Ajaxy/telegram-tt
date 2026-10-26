import type { OwnProps } from './WalletCardModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const WalletCardModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const WalletCardModal = useModuleLoader(Bundles.Wallet, 'WalletCardModal', !modal);

  return WalletCardModal ? <WalletCardModal {...props} /> : undefined;
};

export default WalletCardModalAsync;
