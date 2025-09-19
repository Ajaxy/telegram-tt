import {
  memo,
  useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import buildClassName from '../../util/buildClassName';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Modal from '../ui/Modal';
import PasswordForm from './PasswordForm';

import styles from './VerificationMonetizationModal.module.scss';

export type OwnProps = {
  modal: TabState['monetizationVerificationModal'];
};

type StateProps = {
  passwordHint?: string;
};

const VerificationMonetizationModal = ({
  modal,
  passwordHint,
}: OwnProps & StateProps) => {
  const {
    closeMonetizationVerificationModal, clearMonetizationVerificationError, processMonetizationRevenueWithdrawalUrl,
  } = getActions();

  const isOpen = Boolean(modal);

  const renderingModal = useCurrentOrPrev(modal);

  const lang = useLang();

  const [shouldShowPassword, setShouldShowPassword] = useState(false);

  const handleSubmit = useLastCallback((password: string) => {
    if (!renderingModal) return;
    processMonetizationRevenueWithdrawalUrl({
      peerId: renderingModal.chatId,
      currentPassword: password,
    });
  });

  const handleClearError = useLastCallback(() => {
    clearMonetizationVerificationError();
  });

  const handleClose = useLastCallback(() => {
    closeMonetizationVerificationModal();
  });

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      title={lang('CheckPasswordTitle')}
      className={styles.root}
      contentClassName={styles.content}
      onClose={handleClose}
    >
      <div className={buildClassName(styles.content, 'settings-content password-form custom-scroll')}>
        <div className="settings-item pt-0">
          <PasswordForm
            shouldShowSubmit
            placeholder={lang('CheckPasswordPlaceholder')}
            error={renderingModal?.errorKey && lang.withRegular(renderingModal.errorKey)}
            description={lang('CheckPasswordDescription')}
            onClearError={handleClearError}
            isLoading={renderingModal?.isLoading}
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

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const {
      twoFaSettings: {
        hint: passwordHint,
      },
    } = global;

    return {
      passwordHint,
    };
  },
)(VerificationMonetizationModal));
