import type { OwnProps } from './ActiveGiftAuctionsModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const ActiveGiftAuctionsModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const ActiveGiftAuctionsModal = useModuleLoader(Bundles.Stars, 'ActiveGiftAuctionsModal', !modal);

  return ActiveGiftAuctionsModal ? <ActiveGiftAuctionsModal {...props} /> : undefined;
};

export default ActiveGiftAuctionsModalAsync;
