import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { IS_WEBAUTHN_SUPPORTED } from '../../util/browser/windowEnvironment';
import { cancelConditionalPasskeyRequest } from '../../util/passcode/passkey';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';

import useTimeout from '../../hooks/schedulers/useTimeout';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import AnimatedIconWithPreview from '../common/AnimatedIconWithPreview';
import PasswordForm from '../common/PasswordForm';
import Wallpaper from '../common/Wallpaper';
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
  shouldKeepBackground: boolean;
};

const ICON_SIZE = 160;

const LockScreen = ({
  isLocked,
  passcodeSettings,
  shouldKeepBackground,
}: OwnProps & StateProps) => {
  const {
    unlockScreen,
    unlockScreenWithPasskey,
    signOutAllAccounts,
    resetInvalidUnlockAttempts,
    clearPasscodeError,
  } = getActions();

  const {
    timeoutUntil,
    isLoading,
    errorKey,
    hasPasskey,
    isDataCorrupted,
  } = passcodeSettings;

  const lang = useLang();
  const [shouldShowPasscode, setShouldShowPasscode] = useState(false);
  const [isSignOutAllDialogOpen, openSignOutAllConfirmation, closeSignOutAllConfirmation] = useFlag(false);
  const { shouldRender } = useShowTransitionDeprecated(isLocked);

  useEffect(() => {
    if (!isLocked || isLoading || !hasPasskey || isDataCorrupted || !IS_WEBAUTHN_SUPPORTED) return undefined;

    unlockScreenWithPasskey({ isConditional: true });
    return cancelConditionalPasskeyRequest;
  }, [hasPasskey, isDataCorrupted, isLoading, isLocked]);

  const handleInvalidAttemptsTimeout = useLastCallback(() => {
    if (!timeoutUntil) return;
    resetInvalidUnlockAttempts({ timeoutUntil });
  });

  // eslint-disable-next-line @eslint-react/purity
  useTimeout(handleInvalidAttemptsTimeout, timeoutUntil ? timeoutUntil - Date.now() : undefined);

  const handleClearError = useLastCallback(() => {
    clearPasscodeError();
  });

  const handleSubmit = useLastCallback((passcode: string) => {
    unlockScreen({ passcode });
  });

  const handlePasskeyClick = useLastCallback(() => {
    unlockScreenWithPasskey();
  });

  const handleSignOutAllMessage = useLastCallback(() => {
    closeSignOutAllConfirmation();
    signOutAllAccounts();
  });

  if (!shouldRender) {
    return undefined;
  }

  function getValidationError() {
    return errorKey
      ? lang.withRegular(errorKey)
      : timeoutUntil ? lang('PasscodeTooManyAttempts') : '';
  }

  function renderLogoutPrompt() {
    return (
      <p className={styles.help}>
        {lang('PasscodeForgotHelp', {
          logOut: (
            <Link className={styles.logOutLink} onClick={openSignOutAllConfirmation}>
              {lang('PasscodeForgotHelpLink')}
            </Link>
          ),
        }, { withNodes: true })}
      </p>
    );
  }

  function renderCorruptedData() {
    return (
      <div className={styles.wrapper} dir={lang.isRtl ? 'rtl' : undefined}>
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={ICON_SIZE}
          className={styles.icon}
        />

        <p className={styles.corruptedText}>{lang('PasscodeDataCorrupted')}</p>

        <Button color="danger" isText className={styles.logOutAllButton} onClick={openSignOutAllConfirmation}>
          {lang('PasscodeLogOutAllAccounts')}
        </Button>
      </div>
    );
  }

  function renderUnlockForm() {
    return (
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
          shouldOfferPasskey={hasPasskey && IS_WEBAUTHN_SUPPORTED}
          isLoading={isLoading}
          error={getValidationError()}
          placeholder={lang('PasscodeEnterPasscodePlaceholder')}
          submitLabel={lang('Next')}
          onClearError={handleClearError}
          isPasswordVisible={shouldShowPasscode}
          noRipple
          onChangePasswordVisibility={setShouldShowPasscode}
          onSubmit={handleSubmit}
        />

        {hasPasskey && IS_WEBAUTHN_SUPPORTED && (
          <Button
            isText
            className={styles.passkeyButton}
            disabled={isLoading}
            onClick={handlePasskeyClick}
          >
            {lang('PasscodeUsePasskey')}
          </Button>
        )}

        {renderLogoutPrompt()}
      </div>
    );
  }

  return (
    <Wallpaper
      className={styles.container}
      backgroundMode={shouldKeepBackground ? 'lockScreen' : 'default'}
      isStatic
    >
      {isDataCorrupted ? renderCorruptedData() : renderUnlockForm()}

      <ConfirmDialog
        isOpen={isSignOutAllDialogOpen}
        onClose={closeSignOutAllConfirmation}
        text={lang('PasscodeLogOutAllConfirm')}
        confirmLabel={lang('PasscodeLogOutAllAccounts')}
        confirmHandler={handleSignOutAllMessage}
        confirmIsDestructive
      />
    </Wallpaper>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      passcodeSettings: global.passcode,
      shouldKeepBackground: global.sharedState.settings.shouldKeepLockScreenBackground,
    };
  },
)(LockScreen));
