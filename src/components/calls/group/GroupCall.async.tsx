import React, { FC, memo } from '../../../lib/teact/teact';
import useModuleLoader from '../../../hooks/useModuleLoader';
import { Bundles } from '../../../util/moduleLoader';
import { OwnProps } from './GroupCall';

const GroupCallAsync: FC<OwnProps> = (props) => {
  const { groupCallId } = props;
  const GroupCall = useModuleLoader(Bundles.Calls, 'GroupCall', !groupCallId);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return GroupCall ? <GroupCall {...props} /> : undefined;
};

export default memo(GroupCallAsync);
