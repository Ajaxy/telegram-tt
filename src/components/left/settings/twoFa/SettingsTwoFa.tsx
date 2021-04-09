import React, {
  FC, memo, useCallback, useEffect,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../../../global/types';
import { SettingsScreens } from '../../../../types';

import { pick } from '../../../../util/iteratees';
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
  dispatch: TwoFaDispatch;
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = GlobalState['twoFaSettings'];

type DispatchProps = Pick<GlobalActions, (
  'updatePassword' | 'updateRecoveryEmail' | 'clearPassword' | 'provideTwoFaEmailCode' |
  'checkPassword' | 'clearTwoFaError'
)>;

const SettingsTwoFa: FC<OwnProps & StateProps & DispatchProps> = ({
  currentScreen,
  state,
  hint,
  isLoading,
  error,
  waitingEmailCodeLength,
  dispatch,
  onScreenSelect,
  updatePassword,
  checkPassword,
  clearTwoFaError,
  updateRecoveryEmail,
  provideTwoFaEmailCode,
  clearPassword,
}) => {
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
        />
      );

    case SettingsScreens.TwoFaNewPassword:
      return (
        <SettingsTwoFaPassword
          placeholder={lang('EnterPassword')}
          submitLabel={lang('Continue')}
          onSubmit={handleNewPassword}
        />
      );

    case SettingsScreens.TwoFaNewPasswordConfirm:
      return (
        <SettingsTwoFaPassword
          expectedPassword={state.password}
          placeholder={lang('PleaseReEnterPassword')}
          submitLabel={lang('Continue')}
          onSubmit={handleNewPasswordConfirm}
        />
      );

    case SettingsScreens.TwoFaNewPasswordHint:
      return (
        <SettingsTwoFaSkippableForm
          icon="hint"
          placeholder={lang('PasswordHintPlaceholder')}
          onSubmit={handleNewPasswordHint}
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
        />
      );

    case SettingsScreens.TwoFaNewPasswordEmailCode:
      return (
        <SettingsTwoFaEmailCode
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          onSubmit={handleEmailCode}
        />
      );

    case SettingsScreens.TwoFaCongratulations:
      return (
        <SettingsTwoFaCongratulations
          onScreenSelect={onScreenSelect}
        />
      );

    case SettingsScreens.TwoFaEnabled:
      return (
        <SettingsTwoFaEnabled
          onScreenSelect={onScreenSelect}
        />
      );

    case SettingsScreens.TwoFaChangePasswordCurrent:
      return (
        <SettingsTwoFaPassword
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleChangePasswordCurrent}
        />
      );

    case SettingsScreens.TwoFaChangePasswordNew:
      return (
        <SettingsTwoFaPassword
          placeholder={lang('PleaseEnterNewFirstPassword')}
          onSubmit={handleChangePasswordNew}
        />
      );

    case SettingsScreens.TwoFaChangePasswordConfirm:
      return (
        <SettingsTwoFaPassword
          expectedPassword={state.password}
          placeholder={lang('PleaseReEnterPassword')}
          onSubmit={handleChangePasswordConfirm}
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
        />
      );

    case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
      return (
        <SettingsTwoFaPassword
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          hint={hint}
          onSubmit={handleRecoveryEmailCurrentPassword}
        />
      );

    case SettingsScreens.TwoFaRecoveryEmail:
      return (
        <SettingsTwoFaSkippableForm
          icon="email"
          type="email"
          placeholder={lang('RecoveryEmailTitle')}
          onSubmit={handleRecoveryEmail}
        />
      );

    case SettingsScreens.TwoFaRecoveryEmailCode:
      return (
        <SettingsTwoFaEmailCode
          isLoading={isLoading}
          error={error}
          clearError={clearTwoFaError}
          onSubmit={handleEmailCode}
        />
      );

    default:
      return undefined;
  }
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({ ...global.twoFaSettings }),
  (setGlobal, actions): DispatchProps => pick(actions, [
    'updatePassword', 'updateRecoveryEmail', 'clearPassword', 'provideTwoFaEmailCode',
    'checkPassword', 'clearTwoFaError',
  ]),
)(SettingsTwoFa));
