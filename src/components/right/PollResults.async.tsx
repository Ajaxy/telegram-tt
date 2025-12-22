import type { OwnProps } from './PollResults';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const PollResultsAsync = (props: OwnProps) => {
  const { isActive } = props;
  const PollResults = useModuleLoader(Bundles.Extra, 'PollResults', !isActive);

  return PollResults ? <PollResults {...props} /> : <Loading />;
};

export default PollResultsAsync;
