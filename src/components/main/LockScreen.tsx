import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { decryptSession } from '../../util/passcode';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';

import useTimeout from '../../hooks/schedulers/useTimeout';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../common/AnimatedIconWithPreview';
import PasswordForm from '../common/PasswordForm';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Link from '../ui/Link';

import styles from './LockScreen.module.scss';

import lockPreviewUrl from '../../assets/lock.png';

export type OwnProps = {
  isLocked?: boolean;
};

type StateProps = {
  passcodeSettings: GlobalState['passcode'];
};

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
    timeoutUntil,
    isLoading,
  } = passcodeSettings;

  const lang = useLang();
  const [validationError, setValidationError] = useState<string>('');
  const [shouldShowPasscode, setShouldShowPasscode] = useState(false);
  const [isSignOutDialogOpen, openSignOutConfirmation, closeSignOutConfirmation] = useFlag(false);
  const { shouldRender } = useShowTransition(isLocked);

  useTimeout(resetInvalidUnlockAttempts, timeoutUntil ? timeoutUntil - Date.now() : undefined);

  const handleClearError = useCallback(() => {
    setValidationError('');
  }, []);

  const handleSubmit = useCallback((passcode: string) => {
    if (timeoutUntil !== undefined) {
      setValidationError(lang('FloodWait'));
      return;
    }

    setValidationError('');
    decryptSession(passcode).then(unlockScreen, () => {
      logInvalidUnlockAttempt();
      setValidationError(lang('lng_passcode_wrong'));
    });
  }, [lang, timeoutUntil]);

  useEffect(() => {
    if (timeoutUntil !== undefined) {
      setValidationError(lang('FloodWait'));
    } else if (invalidAttemptsCount === 0) {
      setValidationError('');
    }
  }, [timeoutUntil, lang, invalidAttemptsCount]);

  const handleSignOutMessage = useCallback(() => {
    closeSignOutConfirmation();
    signOut({ forceInitApi: true });
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
