import React, { FC } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const StatisticsAsync: FC = () => {
  const Statistics = useModuleLoader(Bundles.Extra, 'Statistics');

  return Statistics ? <Statistics /> : <Loading />;
};

export default StatisticsAsync;
