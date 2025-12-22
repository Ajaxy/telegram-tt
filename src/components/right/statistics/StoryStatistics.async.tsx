import type { OwnProps } from './StoryStatistics';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const StoryStatisticsAsync = (props: OwnProps) => {
  const StoryStatistics = useModuleLoader(Bundles.Extra, 'StoryStatistics');

  return StoryStatistics ? <StoryStatistics {...props} /> : <Loading />;
};

export default StoryStatisticsAsync;
