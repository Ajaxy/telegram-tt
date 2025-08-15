import type { FC } from '../../../lib/teact/teact';

import type { TabState } from '../../../global/types';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

export type OwnProps = {
  modal: TabState['priceConfirmModal'];
};

const PriceConfirmModalAsync: FC<OwnProps> = ({ modal }) => {
  const PriceConfirmModal = useModuleLoader(Bundles.Stars, 'PriceConfirmModal', !modal);

  return PriceConfirmModal ? <PriceConfirmModal modal={modal} /> : undefined;
};

export default PriceConfirmModalAsync;
