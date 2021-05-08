import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const MainAsync: FC = () => {
  const Main = useModuleLoader(Bundles.Main, 'Main');

  return Main ? <Main /> : undefined;
};

export default memo(MainAsync);
