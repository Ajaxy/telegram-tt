import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { Bundles } from '../../../util/moduleLoader';

import type { OwnProps } from './Management';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const ManagementAsync: FC<OwnProps> = (props) => {
  const Management = useModuleLoader(Bundles.Extra, 'Management');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Management ? <Management {...props} /> : <Loading />;
};

export default memo(ManagementAsync);
