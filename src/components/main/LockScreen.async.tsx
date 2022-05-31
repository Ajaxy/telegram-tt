import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import type { OwnProps } from './LockScreen';

import useModuleLoader from '../../hooks/useModuleLoader';

const LockScreenAsync: FC<OwnProps> = (props) => {
  const { isLocked } = props;
  const LockScreen = useModuleLoader(Bundles.Main, 'LockScreen', !isLocked);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return LockScreen ? <LockScreen {...props} /> : undefined;
};

export default memo(LockScreenAsync);
