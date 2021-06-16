import React, { FC, memo } from '../../lib/teact/teact';
import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';
import Loading from '../ui/Loading';

const AuthQrCodeAsync: FC = () => {
  const AuthQrCode = useModuleLoader(Bundles.Auth, 'AuthQrCode');

  return AuthQrCode ? <AuthQrCode /> : <Loading />;
};

export default memo(AuthQrCodeAsync);
