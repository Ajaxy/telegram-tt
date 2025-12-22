import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

import Loading from '../ui/Loading';

const AuthRegisterAsync = () => {
  const AuthRegister = useModuleLoader(Bundles.Auth, 'AuthRegister');

  return AuthRegister ? <AuthRegister /> : <Loading />;
};

export default AuthRegisterAsync;
