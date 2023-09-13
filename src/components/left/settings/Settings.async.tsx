import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './Settings';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

import Loading from '../../ui/Loading';

const SettingsAsync: FC<OwnProps> = (props) => {
  const Settings = useModuleLoader(Bundles.Extra, 'Settings');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Settings ? <Settings {...props} /> : <Loading />;
};

export default SettingsAsync;
