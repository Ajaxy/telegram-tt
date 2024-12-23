import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PaidReactionModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PaidReactionModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const PaidReactionModal = useModuleLoader(Bundles.Stars, 'PaidReactionModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PaidReactionModal ? <PaidReactionModal {...props} /> : undefined;
};

export default PaidReactionModalAsync;
