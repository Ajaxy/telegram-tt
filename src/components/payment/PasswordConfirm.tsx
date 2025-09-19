import type { FC } from '../../lib/teact/teact';
import { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiPaymentCredentials } from '../../api/types';
import type { FormState } from '../../hooks/reducers/usePaymentReducer';
import type { RegularLangFnParameters } from '../../util/localization';

import { selectTabState } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';

import PasswordForm from '../common/PasswordForm';
import PasswordMonkey from '../common/PasswordMonkey';

interface OwnProps {
  isActive?: boolean;
  state: FormState;
  savedCredentials?: ApiPaymentCredentials[];
  onPasswordChange: (password: string) => void;
}

interface StateProps {
  errorKey?: RegularLangFnParameters;
  passwordHint?: string;
  savedCredentials?: ApiPaymentCredentials[];
}

const PasswordConfirm: FC<OwnProps & StateProps> = ({
  isActive,
  errorKey,
  state,
  savedCredentials,
  passwordHint,
  onPasswordChange,
}) => {
  const { clearPaymentError } = getActions();

  const oldLang = useOldLang();
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
        error={errorKey && lang.withRegular(errorKey)}
        hint={passwordHint}
        description={oldLang('PaymentConfirmationMessage', cardName)}
        placeholder={oldLang('Password')}
        onClearError={clearPaymentError}
        shouldShowSubmit={false}
        shouldResetValue={isActive}
        isPasswordVisible={shouldShowPassword}
        onChangePasswordVisibility={setShouldShowPassword}
        onInputChange={onPasswordChange}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const { payment } = selectTabState(global);
  return {
    errorKey: payment.error?.messageKey,
    passwordHint: global.twoFaSettings.hint,
    savedCredentials: payment.form?.type === 'regular' ? payment.form.savedCredentials : undefined,
  };
})(PasswordConfirm));
