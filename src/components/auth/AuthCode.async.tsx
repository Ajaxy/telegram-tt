import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const AuthCodeAsync = () => {
  const AuthCode = useModuleLoader(Bundles.Auth, 'AuthCode');

  return AuthCode ? <AuthCode /> : <Loading />;
};

export default AuthCodeAsync;
