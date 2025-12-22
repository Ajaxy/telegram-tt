import type { OwnProps } from './GiftResalePriceComposerModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const GiftResalePriceComposerModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const GiftResalePriceComposerModal = useModuleLoader(Bundles.Stars, 'GiftResalePriceComposerModal', !modal);

  return GiftResalePriceComposerModal ? <GiftResalePriceComposerModal {...props} /> : undefined;
};

export default GiftResalePriceComposerModalAsync;
