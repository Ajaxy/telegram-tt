import type { OwnProps } from './GiftOfferAcceptModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftOfferAcceptModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftOfferAcceptModal = useModuleLoader(
    Bundles.Stars,
    'GiftOfferAcceptModal',
    !modal,
  );

  return GiftOfferAcceptModal ? <GiftOfferAcceptModal {...props} /> : undefined;
};

export default GiftOfferAcceptModalAsync;
