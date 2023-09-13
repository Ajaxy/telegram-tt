import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiPaymentCredentials } from '../../api/types';
import type { FormState } from '../../hooks/reducers/usePaymentReducer';

import { selectTabState } from '../../global/selectors';

import useLang from '../../hooks/useLang';

import PasswordForm from '../common/PasswordForm';
import PasswordMonkey from '../common/PasswordMonkey';

interface OwnProps {
  isActive?: boolean;
  state: FormState;
  savedCredentials?: ApiPaymentCredentials[];
  onPasswordChange: (password: string) => void;
}

interface StateProps {
  error?: string;
  passwordHint?: string;
  savedCredentials?: ApiPaymentCredentials[];
}

const PasswordConfirm: FC<OwnProps & StateProps> = ({
  isActive,
  error,
  state,
  savedCredentials,
  passwordHint,
  onPasswordChange,
}) => {
  const { clearPaymentError } = getActions();

  const lang = useLang();
  const [shouldShowPassword, setShouldShowPassword] = useState(false);
  const cardName = useMemo(() => {
    return savedCredentials?.length && state.savedCredentialId
      ? savedCredentials.find(({ id }) => id === state.savedCredentialId)?.title
      : undefined;
  }, [savedCredentials, state.savedCredentialId]);

  return (
    <div className="PaymentInfo">
      <PasswordMonkey isBig isPasswordVisible={shouldShowPassword} />

      <PasswordForm
        error={error ? lang(error) : undefined}
        hint={passwordHint}
        description={lang('PaymentConfirmationMessage', cardName)}
        placeholder={lang('Password')}
        clearError={clearPaymentError}
        shouldShowSubmit={false}
        shouldResetValue={isActive}
        isPasswordVisible={shouldShowPassword}
        onChangePasswordVisibility={setShouldShowPassword}
        onInputChange={onPasswordChange}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { payment } = selectTabState(global);
  return {
    error: payment.error?.message,
    passwordHint: global.twoFaSettings.hint,
    savedCredentials: payment.savedCredentials,
  };
})(PasswordConfirm));
