import type { FC } from '../../lib/teact/teact';

import type { OwnProps } from './LockScreen';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

const LockScreenAsync: FC<OwnProps> = (props) => {
  const { isLocked } = props;
  const LockScreen = useModuleLoader(Bundles.Main, 'LockScreen', !isLocked);

  return LockScreen ? <LockScreen {...props} /> : undefined;
};

export default LockScreenAsync;
