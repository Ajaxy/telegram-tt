import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const AuthCodeAsync: FC = () => {
  const AuthCode = useModuleLoader(Bundles.Auth, 'AuthCode');

  return AuthCode ? <AuthCode /> : <Loading />;
};

export default memo(AuthCodeAsync);
