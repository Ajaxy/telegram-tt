import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Modal from '../ui/Modal';
import PasswordForm from './PasswordForm';

import styles from './VerificationMonetizationModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  chatId: string;
  passwordHint?: string;
  error?: string;
  isLoading?: boolean;
};

const VerificationMonetizationModal: FC<OwnProps> = ({
  isOpen,
  chatId,
  onClose,
  passwordHint,
  error,
  isLoading,
}) => {
  const {
    clearMonetizationInfo, loadMonetizationRevenueWithdrawalUrl,
  } = getActions();

  const lang = useOldLang();

  const [shouldShowPassword, setShouldShowPassword] = useState(false);

  const handleSubmit = useLastCallback((password: string) => {
    loadMonetizationRevenueWithdrawalUrl({
      chatId,
      currentPassword: password,
      onSuccess: () => {
        onClose();
      },
    });
  });

  const handleClearError = useLastCallback(() => {
    clearMonetizationInfo();
  });

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      title={lang('EnterPassword')}
      className={styles.root}
      contentClassName={styles.content}
      onClose={onClose}
    >
      <div className={buildClassName(styles.content, 'settings-content password-form custom-scroll')}>
        <div className="settings-item pt-0">
          <PasswordForm
            shouldShowSubmit
            placeholder={lang('Password')}
            error={error && lang(error)}
            description={lang('Channel.OwnershipTransfer.EnterPasswordText')}
            clearError={handleClearError}
            isLoading={isLoading}
            hint={passwordHint}
            isPasswordVisible={shouldShowPassword}
            shouldResetValue={isOpen}
            onChangePasswordVisibility={setShouldShowPassword}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </Modal>
  );
};

export default memo(VerificationMonetizationModal);
