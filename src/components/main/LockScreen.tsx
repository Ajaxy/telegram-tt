import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import useLang from '../../hooks/useLang';
import { decryptSession } from '../../util/passcode';
import useShowTransition from '../../hooks/useShowTransition';
import useTimeout from '../../hooks/useTimeout';
import useFlag from '../../hooks/useFlag';

import AnimatedIconWithPreview from '../common/AnimatedIconWithPreview';
import PasswordForm from '../common/PasswordForm';
import ConfirmDialog from '../ui/ConfirmDialog';
import Button from '../ui/Button';
import Link from '../ui/Link';

import styles from './LockScreen.module.scss';
import lockPreviewUrl from '../../assets/lock.png';

export type OwnProps = {
  isLocked?: boolean;
};

type StateProps = {
  passcodeSettings: GlobalState['passcode'];
};

const MAX_INVALID_ATTEMPTS = 5;
const TIMEOUT_RESET_INVALID_ATTEMPTS_MS = 180000; // 3 minutes
const ICON_SIZE = 160;

const LockScreen: FC<OwnProps & StateProps> = ({
  isLocked,
  passcodeSettings,
}) => {
  const {
    unlockScreen,
    signOut,
    logInvalidUnlockAttempt,
    resetInvalidUnlockAttempts,
  } = getActions();

  const {
    invalidAttemptsCount,
    isLoading,
  } = passcodeSettings;

  const lang = useLang();
  const [validationError, setValidationError] = useState<string>('');
  const [shouldShowPasscode, setShouldShowPasscode] = useState(false);
  const [isSignOutDialogOpen, openSignOutConfirmation, closeSignOutConfirmation] = useFlag(false);
  const { shouldRender } = useShowTransition(isLocked);

  useTimeout(
    resetInvalidUnlockAttempts,
    invalidAttemptsCount && invalidAttemptsCount >= MAX_INVALID_ATTEMPTS
      ? TIMEOUT_RESET_INVALID_ATTEMPTS_MS
      : undefined,
  );

  const handleClearError = useCallback(() => {
    setValidationError('');
  }, []);

  const handleSubmit = useCallback((passcode: string) => {
    if (invalidAttemptsCount && invalidAttemptsCount >= MAX_INVALID_ATTEMPTS) {
      setValidationError(lang('FloodWait'));
      return;
    }

    setValidationError('');
    decryptSession(passcode).then(unlockScreen, () => {
      logInvalidUnlockAttempt();
      setValidationError(lang('lng_passcode_wrong'));
    });
  }, [invalidAttemptsCount, lang, logInvalidUnlockAttempt, unlockScreen]);

  useEffect(() => {
    if (invalidAttemptsCount && invalidAttemptsCount >= MAX_INVALID_ATTEMPTS) {
      setValidationError(lang('FloodWait'));
    } else if (invalidAttemptsCount === 0) {
      setValidationError('');
    }
  }, [invalidAttemptsCount, lang]);

  const handleSignOutMessage = useCallback(() => {
    closeSignOutConfirmation();
    signOut();
  }, [closeSignOutConfirmation, signOut]);

  if (!shouldRender) {
    return undefined;
  }

  function renderLogoutPrompt() {
    return (
      <div className={styles.help}>
        <p>
          <Link onClick={openSignOutConfirmation}>Log out</Link>{' '}
          if you don&apos;t remember your passcode.
        </p>
        <p>
          <Button color="translucent" size="tiny" isText onClick={openSignOutConfirmation}>
            {lang('AccountSettings.Logout')}
          </Button>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper} dir={lang.isRtl ? 'rtl' : undefined}>
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={ICON_SIZE}
          className={styles.icon}
        />

        <PasswordForm
          key="password-form"
          shouldShowSubmit
          shouldDisablePasswordManager
          isLoading={isLoading}
          error={validationError}
          placeholder={lang('Passcode.EnterPasscodePlaceholder')}
          submitLabel={lang('Next')}
          clearError={handleClearError}
          isPasswordVisible={shouldShowPasscode}
          noRipple
          onChangePasswordVisibility={setShouldShowPasscode}
          onSubmit={handleSubmit}
        />

        {renderLogoutPrompt()}
      </div>

      <ConfirmDialog
        isOpen={isSignOutDialogOpen}
        onClose={closeSignOutConfirmation}
        text={lang('lng_sure_logout')}
        confirmLabel={lang('AccountSettings.Logout')}
        confirmHandler={handleSignOutMessage}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      passcodeSettings: global.passcode,
    };
  },
)(LockScreen));
