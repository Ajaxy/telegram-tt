import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

type OwnProps = {
  isActive?: boolean;
};

const ActiveCallHeaderAsync: FC<OwnProps> = (props) => {
  const { isActive } = props;
  const ActiveCallHeader = useModuleLoader(Bundles.Calls, 'ActiveCallHeader', !isActive);

  return ActiveCallHeader ? <ActiveCallHeader /> : undefined;
};

export default ActiveCallHeaderAsync;
