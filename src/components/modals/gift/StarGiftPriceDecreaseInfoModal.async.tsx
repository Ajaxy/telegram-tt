import type { OwnProps } from './StarGiftPriceDecreaseInfoModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StarGiftPriceDecreaseInfoModalAsync = (props: OwnProps) => {
  const { modal } = props;
  const StarGiftPriceDecreaseInfoModal = useModuleLoader(Bundles.Stars, 'StarGiftPriceDecreaseInfoModal', !modal);

  return StarGiftPriceDecreaseInfoModal ? <StarGiftPriceDecreaseInfoModal {...props} /> : undefined;
};

export default StarGiftPriceDecreaseInfoModalAsync;
