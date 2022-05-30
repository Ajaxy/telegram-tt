import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import { Bundles } from '../../../util/moduleLoader';

import type { OwnProps } from './MessageStatistics';

import useModuleLoader from '../../../hooks/useModuleLoader';
import Loading from '../../ui/Loading';

const MessageStatisticsAsync: FC<OwnProps> = (props) => {
  const MessageStatistics = useModuleLoader(Bundles.Extra, 'MessageStatistics');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return MessageStatistics ? <MessageStatistics {...props} /> : <Loading />;
};

export default MessageStatisticsAsync;
