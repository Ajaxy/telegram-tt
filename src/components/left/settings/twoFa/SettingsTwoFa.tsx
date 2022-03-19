import React, {
  FC, memo, useCallback, useEffect,
} from '../../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../../modules';

import { GlobalState } from '../../../../global/types';
import { SettingsScreens } from '../../../../types';

import { TwoFaDispatch, TwoFaState } from '../../../../hooks/reducers/useTwoFaReducer';
import useLang from '../../../../hooks/useLang';

import SettingsTwoFaEnabled from './SettingsTwoFaEnabled';
import SettingsTwoFaPassword from './SettingsTwoFaPassword';
import SettingsTwoFaStart from './SettingsTwoFaStart';
import SettingsTwoFaSkippableForm from './SettingsTwoFaSkippableForm';
import SettingsTwoFaCongratulations from './SettingsTwoFaCongratulations';
import SettingsTwoFaEmailCode from './SettingsTwoFaEmailCode';

export type OwnProps = {
  state: TwoFaState;
  currentScreen: SettingsScreens;
  shownScreen: SettingsScreens;
  dispatch: TwoFaDispatch;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = GlobalState['twoFaSettings'];

const SettingsTwoFa: FC<OwnProps & StateProps> = ({
  currentScreen,
  shownScreen,
  state,
  hint,
  isLoading,
  error,
  waitingEmailCodeLength,
  dispatch,
  isActive,
  onScreenSelect,
  onReset,
}) => {
  const {
    updatePassword,
    checkPassword,
    clearTwoFaError,
    updateRecoveryEmail,
    provideTwoFaEmailCode,
    clearPassword,
  } = getDispatch();

  useEffect(() => {
    if (waitingEmailCodeLength) {
      if (currentScreen === SettingsScreens.TwoFaNewPasswordEmail) {
        onScreenSelect(SettingsScreens.TwoFaNewPasswordEmailCode);
      } else if (currentScreen === SettingsScreens.TwoFaRecoveryEmail) {
        onScreenSelect(SettingsScreens.TwoFaRecoveryEmailCode);
      }
    }
  }, [currentScreen, onScreenSelect, waitingEmailCodeLength]);

  const handleStartWizard = useCallback(() => {
    dispatch({ type: 'reset' });
    onScreenSelect(SettingsScreens.TwoFaNewPassword);
  }, [dispatch, onScreenSelect]);

  const handleNewPassword = useCallback((value: string) => {
    dispatch({ type: 'setPassword', payload: value });
    onScreenSelect(SettingsScreens.TwoFaNewPasswordConfirm);
  }, [dispatch, onScreenSelect]);

  const handleNewPasswordConfirm = useCallback(() => {
    onScreenSelect(SettingsScreens.TwoFaNewPasswordHint);
  }, [onScreenSelect]);

  const handleNewPasswordHint = useCallback((value?: string) => {
    dispatch({ type: 'setHint', payload: value });
    onScreenSelect(SettingsScreens.TwoFaNewPasswordEmail);
  }, [dispatch, onScreenSelect]);

  const handleNewPasswordEmail = useCallback((value?: string) => {
    dispatch({ type: 'setEmail', payload: value });
    updatePassword({
      ...state,
      email: value,
      onSuccess: () => {
        onScreenSelect(SettingsScreens.TwoFaCongratulations);
      },
    });
  }, [dispatch, onScreenSelect, state, updatePassword]);

  const handleChangePasswordCurrent = useCallback((value: string) => {
    dispatch({ type: 'setCurrentPassword', payload: value });
    checkPassword({
      currentPassword: value,
      onSuccess: () => {
        onScreenSelect(SettingsScreens.TwoFaChangePasswordNew);
      },
    });
  }, [checkPassword, dispatch, onScreenSelect]);

  const handleChangePasswordNew = useCallback((value: string) => {
    dispatch({ type: 'setPassword', payload: value });
    onScreenSelect(SettingsScreens.TwoFaChangePasswordConfirm);
  }, [dispatch, onScreenSelect]);

  const handleChangePasswordConfirm = useCallback(() => {
    onScreenSelect(SettingsScreens.TwoFaChangePasswordHint);
  }, [onScreenSelect]);

  const handleChangePasswordHint = useCallback((value?: string) => {
    dispatch({ type: 'setHint', payload: value });
    updatePassword({
      ...state,
      hint: value,
      onSuccess: () => {
        onScreenSelect(SettingsScreens.TwoFaCongratulations);
      },
    });
  }, [dispatch, onScreenSelect, state, updatePassword]);

  const handleTurnOff = useCallback((value: string) => {
    clearPassword({
      currentPassword: value,
      onSuccess: () => {
        onScreenSelect(SettingsScreens.Privacy);
      },
    });
  }, [clearPassword, onScreenSelect]);

  const handleRecoveryEmailCurrentPassword = useCallback((value: string) => {
    dispatch({ type: 'setCurrentPassword', payload: value });
    checkPassword({
      currentPassword: value,
      onSuccess: () => {
        onScreenSelect(SettingsScreens.TwoFaRecoveryEmail);
      },
    });
  }, [checkPassword, dispatch, onScreenSelect]);

  const handleRecoveryEmail = useCallback((value?: string) => {
    dispatch({ type: 'setEmail', payload: value });
    updateRecoveryEmail({
      ...state,
      email: value,
      onSuccess: () => {
        onScreenSelect(SettingsScreens.TwoFaCongratulations);
      },
    });
  }, [dispatch, onScreenSelect, state, updateRecoveryEmail]);

  const handleEmailCode = useCallback((code: string) => {
    provideTwoFaEmailCode({ code });
  }, [provideTwoFaEmailCode]);

  const lang = useLang();

  switch (currentScreen) {
    case SettingsScreens.TwoFaDisabled:
      return (
        <SettingsTwoFaStart
          onStart={handleStartWizard}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaNewPassword,
            SettingsScreens.TwoFaNewPasswordConfirm,
            SettingsScreens.TwoFaNewPasswordHint,
            SettingsScreens.TwoFaNewPasswordEmail,
            SettingsScreens.TwoFaNewPasswordEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaNewPassword:
      return (
        <SettingsTwoFaPassword
          screen={currentScreen}
          placeholder={lang('PleaseEnterPassword')}
          submitLabel={lang('Continue')}
          onSubmit={handleNewPassword}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaNewPasswordConfirm,
            SettingsScreens.TwoFaNewPasswordHint,
            SettingsScreens.TwoFaNewPasswordEmail,
            SettingsScreens.TwoFaNewPasswordEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaNewPasswordConfirm:
      return (
        <SettingsTwoFaPassword
          screen={currentScreen}
          expectedPassword={state.password}
          placeholder={lang('PleaseReEnterPassword')}
          submitLabel={lang('Continue')}
          onSubmit={handleNewPasswordConfirm}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaNewPasswordHint,
            SettingsScreens.TwoFaNewPasswordEmail,
            SettingsScreens.TwoFaNewPasswordEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaNewPasswordHint:
      return (
        <SettingsTwoFaSkippableForm
          icon="hint"
          placeholder={lang('PasswordHintPlaceholder')}
          onSubmit={handleNewPasswordHint}
          screen={currentScreen}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaNewPasswordEmail,
            SettingsScreens.TwoFaNewPasswordEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaNewPasswordEmail:
      return (
        <SettingsTwoFaSkippableForm
          icon="email"
          type="email"
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          placeholder={lang('RecoveryEmailTitle')}
          shouldConfirm
          onSubmit={handleNewPasswordEmail}
          screen={currentScreen}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaNewPasswordEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaNewPasswordEmailCode:
      return (
        <SettingsTwoFaEmailCode
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          onSubmit={handleEmailCode}
          screen={currentScreen}
          onScreenSelect={onScreenSelect}
          isActive={isActive || shownScreen === SettingsScreens.TwoFaCongratulations}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaCongratulations:
      return (
        <SettingsTwoFaCongratulations
          onScreenSelect={onScreenSelect}
          isActive={isActive}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaEnabled:
      return (
        <SettingsTwoFaEnabled
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaChangePasswordCurrent,
            SettingsScreens.TwoFaChangePasswordNew,
            SettingsScreens.TwoFaChangePasswordConfirm,
            SettingsScreens.TwoFaChangePasswordHint,
            SettingsScreens.TwoFaTurnOff,
            SettingsScreens.TwoFaRecoveryEmailCurrentPassword,
            SettingsScreens.TwoFaRecoveryEmail,
            SettingsScreens.TwoFaRecoveryEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaChangePasswordCurrent:
      return (
        <SettingsTwoFaPassword
          screen={currentScreen}
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleChangePasswordCurrent}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaChangePasswordNew,
            SettingsScreens.TwoFaChangePasswordConfirm,
            SettingsScreens.TwoFaChangePasswordHint,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaChangePasswordNew:
      return (
        <SettingsTwoFaPassword
          screen={currentScreen}
          placeholder={lang('PleaseEnterNewFirstPassword')}
          onSubmit={handleChangePasswordNew}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaChangePasswordConfirm,
            SettingsScreens.TwoFaChangePasswordHint,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaChangePasswordConfirm:
      return (
        <SettingsTwoFaPassword
          screen={currentScreen}
          expectedPassword={state.password}
          placeholder={lang('PleaseReEnterPassword')}
          onSubmit={handleChangePasswordConfirm}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaChangePasswordHint,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaChangePasswordHint:
      return (
        <SettingsTwoFaSkippableForm
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          icon="hint"
          placeholder={lang('PasswordHintPlaceholder')}
          onSubmit={handleChangePasswordHint}
          onScreenSelect={onScreenSelect}
          isActive={isActive || shownScreen === SettingsScreens.TwoFaCongratulations}
          onReset={onReset}
          screen={currentScreen}
        />
      );

    case SettingsScreens.TwoFaTurnOff:
      return (
        <SettingsTwoFaPassword
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleTurnOff}
          onScreenSelect={onScreenSelect}
          isActive={isActive}
          onReset={onReset}
          screen={currentScreen}
        />
      );

    case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
      return (
        <SettingsTwoFaPassword
          screen={currentScreen}
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleRecoveryEmailCurrentPassword}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaRecoveryEmail,
            SettingsScreens.TwoFaRecoveryEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaRecoveryEmail:
      return (
        <SettingsTwoFaSkippableForm
          screen={currentScreen}
          icon="email"
          type="email"
          placeholder={lang('RecoveryEmailTitle')}
          onSubmit={handleRecoveryEmail}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.TwoFaRecoveryEmailCode,
            SettingsScreens.TwoFaCongratulations,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaRecoveryEmailCode:
      return (
        <SettingsTwoFaEmailCode
          screen={currentScreen}
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          onSubmit={handleEmailCode}
          onScreenSelect={onScreenSelect}
          isActive={isActive || shownScreen === SettingsScreens.TwoFaCongratulations}
          onReset={onReset}
        />
      );

    default:
      return undefined;
  }
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({ ...global.twoFaSettings }),
)(SettingsTwoFa));
