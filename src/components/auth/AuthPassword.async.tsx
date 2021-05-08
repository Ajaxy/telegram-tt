import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const AuthPasswordAsync: FC = () => {
  const AuthPassword = useModuleLoader(Bundles.Auth, 'AuthPassword');

  return AuthPassword ? <AuthPassword /> : <Loading />;
};

export default memo(AuthPasswordAsync);
