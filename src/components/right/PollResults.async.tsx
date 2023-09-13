import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const PollResultsAsync: FC = () => {
  const PollResults = useModuleLoader(Bundles.Extra, 'PollResults');

  return PollResults ? <PollResults /> : <Loading />;
};

export default PollResultsAsync;
