import type { FC } from '../../../../lib/teact/teact';

import type { OwnProps } from './PremiumLimitReachedModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const PremiumLimitReachedModalAsync: FC<OwnProps> = (props) => {
  const { limit } = props;
  const PremiumLimitReachedModal = useModuleLoader(Bundles.Extra, 'PremiumLimitReachedModal', !limit);

  return PremiumLimitReachedModal ? <PremiumLimitReachedModal {...props} /> : undefined;
};

export default PremiumLimitReachedModalAsync;
