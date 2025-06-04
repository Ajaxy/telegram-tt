import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './MessageStatistics';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const MessageStatisticsAsync: FC<OwnProps> = (props) => {
  const MessageStatistics = useModuleLoader(Bundles.Extra, 'MessageStatistics');

  return MessageStatistics ? <MessageStatistics {...props} /> : <Loading />;
};

export default MessageStatisticsAsync;
