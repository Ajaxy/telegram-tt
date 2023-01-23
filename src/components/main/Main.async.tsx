import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import type { OwnProps } from './Main';

import useModuleLoader from '../../hooks/useModuleLoader';

const MainAsync: FC<OwnProps> = (props) => {
  const Main = useModuleLoader(Bundles.Main, 'Main');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Main ? <Main {...props} /> : undefined;
};

export default memo(MainAsync);
