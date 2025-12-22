import type { OwnProps } from './LockScreen';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const LockScreenAsync = (props: OwnProps) => {
  const { isLocked } = props;
  const LockScreen = useModuleLoader(Bundles.Main, 'LockScreen', !isLocked);

  return LockScreen ? <LockScreen {...props} /> : undefined;
};

export default LockScreenAsync;
