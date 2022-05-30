import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import useModuleLoader from '../../hooks/useModuleLoader';
import { Bundles } from '../../util/moduleLoader';

type OwnProps = {
  isActive?: boolean;
};

const ActiveCallHeaderAsync: FC<OwnProps> = (props) => {
  const { isActive } = props;
  const ActiveCallHeader = useModuleLoader(Bundles.Calls, 'ActiveCallHeader', !isActive);

  return ActiveCallHeader ? <ActiveCallHeader /> : undefined;
};

export default memo(ActiveCallHeaderAsync);
