import React, {
  FC, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../modules';

import { GlobalState } from '../../global/types';

import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import MonkeyPassword from '../common/PasswordMonkey';
import PasswordForm from '../common/PasswordForm';

type StateProps = Pick<GlobalState, 'authIsLoading' | 'authError' | 'authHint'>;

const AuthPassword: FC<StateProps> = ({
  authIsLoading, authError, authHint,
}) => {
  const { setAuthPassword, clearAuthError } = getActions();

  const lang = useLang();
  const [showPassword, setShowPassword] = useState(false);

  const handleChangePasswordVisibility = useCallback((isVisible) => {
    setShowPassword(isVisible);
  }, []);

  const handleSubmit = useCallback((password: string) => {
    setAuthPassword({ password });
  }, [setAuthPassword]);

  return (
    <div id="auth-password-form" className="custom-scroll">
      <div className="auth-form">
        <MonkeyPassword isPasswordVisible={showPassword} />
        <h2>{lang('Login.Header.Password')}</h2>
        <p className="note">{lang('Login.EnterPasswordDescription')}</p>
        <PasswordForm
          clearError={clearAuthError}
          error={authError && lang(authError)}
          hint={authHint}
          isLoading={authIsLoading}
          isPasswordVisible={showPassword}
          onChangePasswordVisibility={handleChangePasswordVisibility}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['authIsLoading', 'authError', 'authHint']),
)(AuthPassword));
