import React, { FC, memo } from '../../../lib/teact/teact';
import { Bundles } from '../../../util/moduleLoader';

import { OwnProps } from './Settings';

import useModuleLoader from '../../../hooks/useModuleLoader';
import Loading from '../../ui/Loading';

const SettingsAsync: FC<OwnProps> = (props) => {
  const Settings = useModuleLoader(Bundles.Extra, 'Settings');

  // eslint-disable-next-line react/jsx-props-no-spreading
  return Settings ? <Settings {...props} /> : <Loading />;
};

export default memo(SettingsAsync);
