import type { OwnProps } from './GiftAuctionModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftAuctionModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftAuctionModal = useModuleLoader(Bundles.Stars, 'GiftAuctionModal', !modal);

  return GiftAuctionModal ? <GiftAuctionModal {...props} /> : undefined;
};

export default GiftAuctionModalAsync;
