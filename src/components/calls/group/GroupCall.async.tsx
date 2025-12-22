import type { OwnProps } from './GroupCall';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const GroupCallAsync = (props: OwnProps) => {
  const { groupCallId } = props;
  const GroupCall = useModuleLoader(Bundles.Calls, 'GroupCall', !groupCallId);

  return GroupCall ? <GroupCall {...props} /> : undefined;
};

export default GroupCallAsync;
