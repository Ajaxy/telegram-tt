import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

type OwnProps = {
  isActive?: boolean;
};

const ActiveCallHeaderAsync = (props: OwnProps) => {
  const { isActive } = props;
  const ActiveCallHeader = useModuleLoader(Bundles.Calls, 'ActiveCallHeader', !isActive);

  return ActiveCallHeader ? <ActiveCallHeader /> : undefined;
};

export default ActiveCallHeaderAsync;
