import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback, useState } from '../../../lib/teact/teact';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

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
  isActive?: boolean;
  onSubmit: (password: string) => void;
  onClearError?: NoneToVoidFunction;
  onReset: () => void;
};

const SettingsPasswordForm: FC<OwnProps> = ({
  isActive,
  error,
  isLoading,
  shouldDisablePasswordManager,
  expectedPassword,
  placeholder,
  hint,
  submitLabel,
  onSubmit,
  onClearError,
  onReset,
}) => {
  const [validationError, setValidationError] = useState<string>('');
  const [shouldShowPassword, setShouldShowPassword] = useState(false);

  const lang = useLang();

  const handleSubmit = useCallback((newPassword) => {
    if (expectedPassword && newPassword !== expectedPassword) {
      setValidationError(lang('SettingsPasswordEqual'));
    } else {
      onSubmit(newPassword);
    }
  }, [onSubmit, expectedPassword, lang]);

  const handleClearError = useCallback(() => {
    if (onClearError) {
      onClearError();
    }
    setValidationError('');
  }, [onClearError]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content password-form custom-scroll">
      <div className="settings-content-header no-border">
        <PasswordMonkey isBig isPasswordVisible={shouldShowPassword} />
      </div>

      <div className="settings-item settings-group">
        <PasswordForm
          error={validationError || error}
          hint={hint}
          placeholder={placeholder || lang('CurrentPasswordPlaceholder')}
          shouldDisablePasswordManager={shouldDisablePasswordManager}
          submitLabel={submitLabel}
          onClearError={handleClearError}
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
