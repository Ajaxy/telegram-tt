import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './Main';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const MainAsync: FC<OwnProps> = (props) => {
  const Main = useModuleLoader(Bundles.Main, 'Main');

  return Main ? <Main {...props} /> : undefined;
};

export default MainAsync;
