import type { OwnProps } from './GiftAuctionAcquiredModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftAuctionAcquiredModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftAuctionAcquiredModal = useModuleLoader(Bundles.Stars, 'GiftAuctionAcquiredModal', !modal);

  return GiftAuctionAcquiredModal ? <GiftAuctionAcquiredModal {...props} /> : undefined;
};

export default GiftAuctionAcquiredModalAsync;
