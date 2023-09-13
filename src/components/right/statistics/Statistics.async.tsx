import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './Statistics';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const StatisticsAsync: FC<OwnProps> = (props) => {
  const Statistics = useModuleLoader(Bundles.Extra, 'Statistics');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Statistics ? <Statistics {...props} /> : <Loading />;
};

export default StatisticsAsync;
