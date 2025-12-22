import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const AuthPasswordAsync = () => {
  const AuthPassword = useModuleLoader(Bundles.Auth, 'AuthPassword');

  return AuthPassword ? <AuthPassword /> : <Loading />;
};

export default AuthPasswordAsync;
