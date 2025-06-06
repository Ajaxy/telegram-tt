import type { FC } from '../../../lib/teact/teact';

import type { OwnProps } from './GroupCall';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GroupCallAsync: FC<OwnProps> = (props) => {
  const { groupCallId } = props;
  const GroupCall = useModuleLoader(Bundles.Calls, 'GroupCall', !groupCallId);

  return GroupCall ? <GroupCall {...props} /> : undefined;
};

export default GroupCallAsync;
