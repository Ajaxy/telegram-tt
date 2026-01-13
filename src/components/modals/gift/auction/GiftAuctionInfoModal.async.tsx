import type { OwnProps } from './GiftAuctionInfoModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftAuctionInfoModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftAuctionInfoModal = useModuleLoader(Bundles.Stars, 'GiftAuctionInfoModal', !modal);

  return GiftAuctionInfoModal ? <GiftAuctionInfoModal {...props} /> : undefined;
};

export default GiftAuctionInfoModalAsync;
