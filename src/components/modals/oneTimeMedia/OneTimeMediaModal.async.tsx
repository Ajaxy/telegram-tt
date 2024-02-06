import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './OneTimeMediaModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const OneTimeMediaModalAsync: FC<OwnProps> = (props) => {
  const { info } = props;
  const OneTimeMediaModal = useModuleLoader(Bundles.Extra, 'OneTimeMediaModal', !info);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return OneTimeMediaModal ? <OneTimeMediaModal {...props} /> : undefined;
};

export default OneTimeMediaModalAsync;
