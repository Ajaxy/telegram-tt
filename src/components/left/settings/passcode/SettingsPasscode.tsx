import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { GlobalState } from '../../../../global/types';
import { SettingsScreens } from '../../../../types';

import { decryptSession } from '../../../../util/passcode';

import useOldLang from '../../../../hooks/useOldLang';

import SettingsPasscodeForm from '../SettingsPasswordForm';
import SettingsPasscodeCongratulations from './SettingsPasscodeCongratulations';
import SettingsPasscodeEnabled from './SettingsPasscodeEnabled';
import SettingsPasscodeStart from './SettingsPasscodeStart';

export type OwnProps = {
  passcode: string;
  currentScreen: SettingsScreens;
  shownScreen: SettingsScreens;
  isActive?: boolean;
  onSetPasscode: (passcode: string) => void;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = GlobalState['passcode'];

const SettingsPasscode: FC<OwnProps & StateProps> = ({
  passcode,
  currentScreen,
  shownScreen,
  error,
  isActive,
  isLoading,
  onScreenSelect,
  onSetPasscode,
  onReset,
}) => {
  const {
    setPasscode,
    clearPasscode,
    setPasscodeError,
    clearPasscodeError,
  } = getActions();

  const lang = useOldLang();

  const handleStartWizard = useCallback(() => {
    onSetPasscode('');
    onScreenSelect(SettingsScreens.PasscodeNewPasscode);
  }, [onScreenSelect, onSetPasscode]);

  const handleNewPassword = useCallback((value: string) => {
    onSetPasscode(value);
    onScreenSelect(SettingsScreens.PasscodeNewPasscodeConfirm);
  }, [onScreenSelect, onSetPasscode]);

  const handleNewPasswordConfirm = useCallback(() => {
    setPasscode({ passcode });
    onSetPasscode('');
    onScreenSelect(SettingsScreens.PasscodeCongratulations);
  }, [onScreenSelect, onSetPasscode, passcode, setPasscode]);

  const handleChangePasswordCurrent = useCallback((currentPasscode: string) => {
    onSetPasscode('');
    decryptSession(currentPasscode).then(() => {
      onScreenSelect(SettingsScreens.PasscodeChangePasscodeNew);
    }, () => {
      setPasscodeError({
        error: lang('PasscodeController.Error.Current'),
      });
    });
  }, [lang, onScreenSelect, onSetPasscode, setPasscodeError]);

  const handleChangePasswordNew = useCallback((value: string) => {
    onSetPasscode(value);
    onScreenSelect(SettingsScreens.PasscodeChangePasscodeConfirm);
  }, [onScreenSelect, onSetPasscode]);

  const handleTurnOff = useCallback((currentPasscode: string) => {
    decryptSession(currentPasscode).then(() => {
      clearPasscode();
      onScreenSelect(SettingsScreens.Privacy);
    }, () => {
      setPasscodeError({
        error: lang('PasscodeController.Error.Current'),
      });
    });
  }, [clearPasscode, lang, onScreenSelect, setPasscodeError]);

  switch (currentScreen) {
    case SettingsScreens.PasscodeDisabled:
      return (
        <SettingsPasscodeStart
          onStart={handleStartWizard}
          isActive={isActive || [
            SettingsScreens.PasscodeNewPasscode,
            SettingsScreens.PasscodeNewPasscodeConfirm,
            SettingsScreens.PasscodeCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeNewPasscode:
      return (
        <SettingsPasscodeForm
          shouldDisablePasswordManager
          placeholder={lang('EnterNewPasscode')}
          submitLabel={lang('Continue')}
          onSubmit={handleNewPassword}
          isActive={isActive || [
            SettingsScreens.PasscodeNewPasscodeConfirm,
            SettingsScreens.PasscodeCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeNewPasscodeConfirm:
      return (
        <SettingsPasscodeForm
          shouldDisablePasswordManager
          expectedPassword={passcode}
          placeholder={lang('ReEnterYourPasscode')}
          submitLabel={lang('Continue')}
          isLoading={isLoading}
          onSubmit={handleNewPasswordConfirm}
          isActive={isActive || [
            SettingsScreens.PasscodeCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeCongratulations:
      return (
        <SettingsPasscodeCongratulations
          isActive={isActive}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeEnabled:
      return (
        <SettingsPasscodeEnabled
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.PasscodeChangePasscodeCurrent,
            SettingsScreens.PasscodeChangePasscodeNew,
            SettingsScreens.PasscodeChangePasscodeConfirm,
            SettingsScreens.PasscodeCongratulations,
            SettingsScreens.PasscodeTurnOff,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeChangePasscodeCurrent:
      return (
        <SettingsPasscodeForm
          shouldDisablePasswordManager
          error={error}
          clearError={clearPasscodeError}
          placeholder={lang('PasscodeController.Current.Placeholder')}
          onSubmit={handleChangePasswordCurrent}
          isActive={isActive || [
            SettingsScreens.PasscodeChangePasscodeNew,
            SettingsScreens.PasscodeChangePasscodeConfirm,
            SettingsScreens.PasscodeCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeChangePasscodeNew:
      return (
        <SettingsPasscodeForm
          shouldDisablePasswordManager
          placeholder={lang('PleaseEnterNewFirstPassword')}
          onSubmit={handleChangePasswordNew}
          isActive={isActive || [
            SettingsScreens.PasscodeChangePasscodeConfirm,
            SettingsScreens.PasscodeCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeChangePasscodeConfirm:
      return (
        <SettingsPasscodeForm
          shouldDisablePasswordManager
          expectedPassword={passcode}
          placeholder={lang('PasscodeController.ReEnterPasscode.Placeholder')}
          isLoading={isLoading}
          onSubmit={handleNewPasswordConfirm}
          isActive={isActive || [
            SettingsScreens.PasscodeCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.PasscodeTurnOff:
      return (
        <SettingsPasscodeForm
          shouldDisablePasswordManager
          error={error ? lang(error) : undefined}
          clearError={clearPasscodeError}
          placeholder={lang('PasscodeController.Current.Placeholder')}
          onSubmit={handleTurnOff}
          isActive={isActive}
          onReset={onReset}
        />
      );

    default:
      return undefined;
  }
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({ ...global.passcode }),
)(SettingsPasscode));
