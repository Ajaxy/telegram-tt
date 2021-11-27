import React, { FC, memo } from '../../lib/teact/teact';
import useModuleLoader from '../../hooks/useModuleLoader';
import { Bundles } from '../../util/moduleLoader';

type OwnProps = {
  groupCallId?: string;
};

const ActiveCallHeaderAsync: FC<OwnProps> = (props) => {
  const { groupCallId } = props;
  const ActiveCallHeader = useModuleLoader(Bundles.Calls, 'ActiveCallHeader', !groupCallId);

  return ActiveCallHeader ? <ActiveCallHeader /> : undefined;
};

export default memo(ActiveCallHeaderAsync);
