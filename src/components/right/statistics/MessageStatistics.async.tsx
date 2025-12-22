import type { OwnProps } from './MessageStatistics';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const MessageStatisticsAsync = (props: OwnProps) => {
  const MessageStatistics = useModuleLoader(Bundles.Extra, 'MessageStatistics');

  return MessageStatistics ? <MessageStatistics {...props} /> : <Loading />;
};

export default MessageStatisticsAsync;
