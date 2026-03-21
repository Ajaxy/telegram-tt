import { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import ConfirmDialog from '../ui/ConfirmDialog';
import PasswordForm from './PasswordForm';
import PasswordMonkey from './PasswordMonkey';

import styles from './PasswordConfirmModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  title?: string;
  confirmLabel?: string;
  description?: string;
  onClose: NoneToVoidFunction;
  onSubmit: (password: string) => void;
};

type StateProps = {
  error?: GlobalState['twoFaSettings']['errorKey'];
  hint?: string;
  isLoading?: boolean;
};

const PasswordConfirmModal = ({
  isOpen,
  title,
  confirmLabel,
  description,
  error,
  hint,
  isLoading,
  onClose,
  onSubmit,
}: OwnProps & StateProps) => {
  const { checkPassword, clearTwoFaError } = getActions();
  const lang = useLang();

  const [shouldShowPassword, setShouldShowPassword] = useState(false);
  const [password, setPassword] = useState('');

  const handlePasswordChange = useLastCallback((value: string) => {
    setPassword(value);
  });

  const handleSubmit = useLastCallback(() => {
    checkPassword({
      currentPassword: password,
      onSuccess: () => {
        onSubmit(password);
        setPassword('');
        setShouldShowPassword(false);
      },
    });
  });

  const handleClose = useLastCallback(() => {
    onClose();
    clearTwoFaError();
    setPassword('');
    setShouldShowPassword(false);
  });

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={title || lang('EnterPassword')}
      confirmLabel={confirmLabel || lang('AutoDeleteConfirm')}
      confirmHandler={handleSubmit}
      confirmIsDestructive
      onClose={handleClose}
    >
      <PasswordMonkey isBig isPasswordVisible={shouldShowPassword} />
      {description && <p className={styles.description}>{description}</p>}
      <PasswordForm
        error={error && lang.withRegular(error)}
        hint={hint}
        isLoading={isLoading}
        isPasswordVisible={shouldShowPassword}
        onChangePasswordVisibility={setShouldShowPassword}
        onClearError={clearTwoFaError}
        onInputChange={handlePasswordChange}
      />
    </ConfirmDialog>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { errorKey, hint, isLoading } = global.twoFaSettings;
    return {
      error: errorKey,
      hint,
      isLoading,
    };
  },
)(PasswordConfirmModal));
