import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';
import { Bundles } from '../../../../util/moduleLoader';

import type { OwnProps } from './PremiumLimitReachedModal';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const PremiumLimitReachedModalAsync: FC<OwnProps> = (props) => {
  const { limit } = props;
  const PremiumLimitReachedModal = useModuleLoader(Bundles.Extra, 'PremiumLimitReachedModal', !limit);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PremiumLimitReachedModal ? <PremiumLimitReachedModal {...props} /> : undefined;
};

export default memo(PremiumLimitReachedModalAsync);
