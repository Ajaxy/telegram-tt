import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useOldLang from '../../../hooks/useOldLang';

import PasswordForm from '../../common/PasswordForm';
import PasswordMonkey from '../../common/PasswordMonkey';

type OwnProps = {
  error?: string;
  isLoading?: boolean;
  shouldDisablePasswordManager?: boolean;
  expectedPassword?: string;
  placeholder?: string;
  hint?: string;
  submitLabel?: string;
  clearError?: NoneToVoidFunction;
  onSubmit: (password: string) => void;
  isActive?: boolean;
  onReset: () => void;
};

const EQUAL_PASSWORD_ERROR = 'Passwords Should Be Equal';

const SettingsPasswordForm: FC<OwnProps> = ({
  isActive,
  onReset,
  error,
  isLoading,
  shouldDisablePasswordManager,
  expectedPassword,
  placeholder = 'Current Password',
  hint,
  submitLabel,
  clearError,
  onSubmit,
}) => {
  const [validationError, setValidationError] = useState<string>('');
  const [shouldShowPassword, setShouldShowPassword] = useState(false);

  const handleSubmit = useCallback((newPassword) => {
    if (expectedPassword && newPassword !== expectedPassword) {
      setValidationError(EQUAL_PASSWORD_ERROR);
    } else {
      onSubmit(newPassword);
    }
  }, [onSubmit, expectedPassword]);

  const handleClearError = useCallback(() => {
    if (clearError) {
      clearError();
    }
    setValidationError('');
  }, [clearError]);

  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content password-form custom-scroll">
      <div className="settings-content-header no-border">
        <PasswordMonkey isBig isPasswordVisible={shouldShowPassword} />
      </div>

      <div className="settings-item pt-2">
        <PasswordForm
          error={validationError || error}
          hint={hint}
          placeholder={placeholder}
          shouldDisablePasswordManager={shouldDisablePasswordManager}
          submitLabel={submitLabel || lang('Next')}
          clearError={handleClearError}
          isLoading={isLoading}
          isPasswordVisible={shouldShowPassword}
          shouldResetValue={isActive}
          onChangePasswordVisibility={setShouldShowPassword}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};

export default memo(SettingsPasswordForm);
