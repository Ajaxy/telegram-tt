import React, {
  FC, memo, useCallback, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalState, GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';

import MonkeyPassword from '../common/PasswordMonkey';
import PasswordForm from '../common/PasswordForm';

type StateProps = Pick<GlobalState, 'authIsLoading' | 'authError' | 'authHint'>;
type DispatchProps = Pick<GlobalActions, 'setAuthPassword' | 'clearAuthError'>;

const AuthPassword: FC<StateProps & DispatchProps> = ({
  authIsLoading, authError, authHint, setAuthPassword, clearAuthError,
}) => {
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
        <h2>Enter Your Password</h2>
        <p className="note">
          Your account is protected with
          <br />an additional password.
        </p>
        <PasswordForm
          clearError={clearAuthError}
          error={authError}
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
  (setGlobal, actions): DispatchProps => pick(actions, ['setAuthPassword', 'clearAuthError']),
)(AuthPassword));
