import type { OwnProps } from './Statistics';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const StatisticsAsync = (props: OwnProps) => {
  const Statistics = useModuleLoader(Bundles.Extra, 'Statistics');

  return Statistics ? <Statistics {...props} /> : <Loading />;
};

export default StatisticsAsync;
