import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './BoostModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BoostModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const BoostModal = useModuleLoader(Bundles.Extra, 'BoostModal', !modal);

  return BoostModal ? <BoostModal {...props} /> : undefined;
};

export default BoostModalAsync;
