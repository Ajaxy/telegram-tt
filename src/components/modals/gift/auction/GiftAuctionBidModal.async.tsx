import type { OwnProps } from './GiftAuctionBidModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftAuctionBidModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftAuctionBidModal = useModuleLoader(Bundles.Stars, 'GiftAuctionBidModal', !modal);

  return GiftAuctionBidModal ? <GiftAuctionBidModal {...props} /> : undefined;
};

export default GiftAuctionBidModalAsync;
