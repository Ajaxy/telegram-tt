import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { GlobalState } from '../../../../global/types';
import type { TwoFaDispatch, TwoFaState } from '../../../../hooks/reducers/useTwoFaReducer';
import { SettingsScreens } from '../../../../types';

import useLang from '../../../../hooks/useLang';
import useOldLang from '../../../../hooks/useOldLang';

import SettingsTwoFaPassword from '../SettingsPasswordForm';
import SettingsTwoFaCongratulations from './SettingsTwoFaCongratulations';
import SettingsTwoFaEmailCode from './SettingsTwoFaEmailCode';
import SettingsTwoFaEnabled from './SettingsTwoFaEnabled';
import SettingsTwoFaSkippableForm from './SettingsTwoFaSkippableForm';
import SettingsTwoFaStart from './SettingsTwoFaStart';

export type OwnProps = {
  state: TwoFaState;
  currentScreen: SettingsScreens;
  shownScreen: SettingsScreens;
  dispatch: TwoFaDispatch;
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = GlobalState['twoFaSettings'];

const SettingsTwoFa: FC<OwnProps & StateProps> = ({
  currentScreen,
  shownScreen,
  state,
  hint,
  isLoading,
  errorKey,
  waitingEmailCodeLength,
  dispatch,
  isActive,
  onReset,
}) => {
  const {
    updatePassword,
    checkPassword,
    clearTwoFaError,
    updateRecoveryEmail,
    provideTwoFaEmailCode,
    clearPassword,
    openSettingsScreen,
  } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  useEffect(() => {
    if (waitingEmailCodeLength) {
      if (currentScreen === SettingsScreens.TwoFaNewPasswordEmail) {
        openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordEmailCode });
      } else if (currentScreen === SettingsScreens.TwoFaRecoveryEmail) {
        openSettingsScreen({ screen: SettingsScreens.TwoFaRecoveryEmailCode });
      }
    }
  }, [currentScreen, waitingEmailCodeLength, openSettingsScreen]);

  const handleStartWizard = useCallback(() => {
    dispatch({ type: 'reset' });
    openSettingsScreen({ screen: SettingsScreens.TwoFaNewPassword });
  }, [dispatch, openSettingsScreen]);

  const handleNewPassword = useCallback((value: string) => {
    dispatch({ type: 'setPassword', payload: value });
    openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordConfirm });
  }, [dispatch, openSettingsScreen]);

  const handleNewPasswordConfirm = useCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordHint });
  }, [openSettingsScreen]);

  const handleNewPasswordHint = useCallback((value?: string) => {
    dispatch({ type: 'setHint', payload: value });
    openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordEmail });
  }, [dispatch, openSettingsScreen]);

  const handleNewPasswordEmail = useCallback((value?: string) => {
    dispatch({ type: 'setEmail', payload: value });
    updatePassword({
      ...state,
      email: value,
      onSuccess: () => {
        openSettingsScreen({ screen: SettingsScreens.TwoFaCongratulations });
      },
    });
  }, [dispatch, state, updatePassword, openSettingsScreen]);

  const handleChangePasswordCurrent = useCallback((value: string) => {
    dispatch({ type: 'setCurrentPassword', payload: value });
    checkPassword({
      currentPassword: value,
      onSuccess: () => {
        openSettingsScreen({ screen: SettingsScreens.TwoFaChangePasswordNew });
      },
    });
  }, [checkPassword, dispatch, openSettingsScreen]);

  const handleChangePasswordNew = useCallback((value: string) => {
    dispatch({ type: 'setPassword', payload: value });
    openSettingsScreen({ screen: SettingsScreens.TwoFaChangePasswordConfirm });
  }, [dispatch, openSettingsScreen]);

  const handleChangePasswordConfirm = useCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.TwoFaChangePasswordHint });
  }, [openSettingsScreen]);

  const handleChangePasswordHint = useCallback((value?: string) => {
    dispatch({ type: 'setHint', payload: value });
    updatePassword({
      ...state,
      hint: value,
      onSuccess: () => {
        openSettingsScreen({ screen: SettingsScreens.TwoFaCongratulations });
      },
    });
  }, [dispatch, state, updatePassword, openSettingsScreen]);

  const handleTurnOff = useCallback((value: string) => {
    clearPassword({
      currentPassword: value,
      onSuccess: () => {
        openSettingsScreen({ screen: SettingsScreens.Privacy });
      },
    });
  }, [clearPassword, openSettingsScreen]);

  const handleRecoveryEmailCurrentPassword = useCallback((value: string) => {
    dispatch({ type: 'setCurrentPassword', payload: value });
    checkPassword({
      currentPassword: value,
      onSuccess: () => {
        openSettingsScreen({ screen: SettingsScreens.TwoFaRecoveryEmail });
      },
    });
  }, [checkPassword, dispatch, openSettingsScreen]);

  const handleRecoveryEmail = useCallback((value?: string) => {
    dispatch({ type: 'setEmail', payload: value });
    updateRecoveryEmail({
      ...state,
      email: value!,
      onSuccess: () => {
        openSettingsScreen({ screen: SettingsScreens.TwoFaCongratulations });
      },
    });
  }, [dispatch, state, updateRecoveryEmail, openSettingsScreen]);

  const handleEmailCode = useCallback((code: string) => {
    provideTwoFaEmailCode({ code });
  }, [provideTwoFaEmailCode]);

  switch (currentScreen) {
    case SettingsScreens.TwoFaDisabled:
      return (
        <SettingsTwoFaStart
          onStart={handleStartWizard}
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
          placeholder={oldLang('PleaseEnterPassword')}
          submitLabel={oldLang('Continue')}
          onSubmit={handleNewPassword}
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
          expectedPassword={state.password}
          placeholder={oldLang('PleaseReEnterPassword')}
          submitLabel={oldLang('Continue')}
          onSubmit={handleNewPasswordConfirm}
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
          placeholder={oldLang('PasswordHintPlaceholder')}
          onSubmit={handleNewPasswordHint}
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
          error={errorKey && lang.withRegular(errorKey)}
          clearError={clearTwoFaError}
          placeholder={oldLang('RecoveryEmailTitle')}
          shouldConfirm
          onSubmit={handleNewPasswordEmail}
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
          error={errorKey && lang.withRegular(errorKey)}
          clearError={clearTwoFaError}
          onSubmit={handleEmailCode}
          isActive={isActive || shownScreen === SettingsScreens.TwoFaCongratulations}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaCongratulations:
      return (
        <SettingsTwoFaCongratulations
          isActive={isActive}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaEnabled:
      return (
        <SettingsTwoFaEnabled
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
          isLoading={isLoading}
          error={errorKey && lang.withRegular(errorKey)}
          onClearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleChangePasswordCurrent}
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
          placeholder={oldLang('PleaseEnterNewFirstPassword')}
          onSubmit={handleChangePasswordNew}
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
          expectedPassword={state.password}
          placeholder={oldLang('PleaseReEnterPassword')}
          onSubmit={handleChangePasswordConfirm}
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
          error={errorKey && lang.withRegular(errorKey)}
          clearError={clearTwoFaError}
          icon="hint"
          placeholder={oldLang('PasswordHintPlaceholder')}
          onSubmit={handleChangePasswordHint}
          isActive={isActive || shownScreen === SettingsScreens.TwoFaCongratulations}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaTurnOff:
      return (
        <SettingsTwoFaPassword
          isLoading={isLoading}
          error={errorKey && lang.withRegular(errorKey)}
          onClearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleTurnOff}
          isActive={isActive}
          onReset={onReset}
        />
      );

    case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
      return (
        <SettingsTwoFaPassword
          isLoading={isLoading}
          error={errorKey && lang.withRegular(errorKey)}
          onClearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleRecoveryEmailCurrentPassword}
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
          icon="email"
          type="email"
          placeholder={oldLang('RecoveryEmailTitle')}
          onSubmit={handleRecoveryEmail}
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
          isLoading={isLoading}
          error={errorKey && lang.withRegular(errorKey)}
          clearError={clearTwoFaError}
          onSubmit={handleEmailCode}
          isActive={isActive || shownScreen === SettingsScreens.TwoFaCongratulations}
          onReset={onReset}
        />
      );

    default:
      return undefined;
  }
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => ({ ...global.twoFaSettings } as Complete<StateProps>),
)(SettingsTwoFa));
