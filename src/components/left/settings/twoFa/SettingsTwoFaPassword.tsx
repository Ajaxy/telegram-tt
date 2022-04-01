import React, {
  FC, memo, useCallback, useState,
} from '../../../../lib/teact/teact';

import { SettingsScreens } from '../../../../types';

import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';

import PasswordMonkey from '../../../common/PasswordMonkey';
import PasswordForm from '../../../common/PasswordForm';

type OwnProps = {
  screen: SettingsScreens;
  error?: string;
  isLoading?: boolean;
  expectedPassword?: string;
  placeholder?: string;
  hint?: string;
  submitLabel?: string;
  clearError?: NoneToVoidFunction;
  onSubmit: (password: string) => void;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

const EQUAL_PASSWORD_ERROR = 'Passwords Should Be Equal';

const SettingsTwoFaPassword: FC<OwnProps> = ({
  screen,
  isActive,
  onScreenSelect,
  onReset,
  error,
  isLoading,
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

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, screen);

  return (
    <div className="settings-content two-fa custom-scroll">
      <div className="settings-content-header no-border">
        <PasswordMonkey isBig isPasswordVisible={shouldShowPassword} />
      </div>

      <div className="settings-item pt-0">
        <PasswordForm
          error={validationError || error}
          hint={hint}
          placeholder={placeholder}
          submitLabel={submitLabel || lang('Next')}
          clearError={handleClearError}
          isLoading={isLoading}
          isPasswordVisible={shouldShowPassword}
          onChangePasswordVisibility={setShouldShowPassword}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
};

export default memo(SettingsTwoFaPassword);
