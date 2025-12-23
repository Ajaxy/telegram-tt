import type { OwnProps } from './GiftAuctionChangeRecipientModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftAuctionChangeRecipientModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftAuctionChangeRecipientModal = useModuleLoader(
    Bundles.Stars,
    'GiftAuctionChangeRecipientModal',
    !modal,
  );

  return GiftAuctionChangeRecipientModal ? <GiftAuctionChangeRecipientModal {...props} /> : undefined;
};

export default GiftAuctionChangeRecipientModalAsync;
