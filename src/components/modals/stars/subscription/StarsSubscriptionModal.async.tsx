import type { FC } from '../../../../lib/teact/teact';
import React from '../../../../lib/teact/teact';

import type { OwnProps } from './StarsSubscriptionModal';

import { Bundles } from '../../../../util/moduleLoader';

import useModuleLoader from '../../../../hooks/useModuleLoader';

const StarsSubscriptionModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const StarsSubscriptionModal = useModuleLoader(Bundles.Stars, 'StarsSubscriptionModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StarsSubscriptionModal ? <StarsSubscriptionModal {...props} /> : undefined;
};

export default StarsSubscriptionModalAsync;
