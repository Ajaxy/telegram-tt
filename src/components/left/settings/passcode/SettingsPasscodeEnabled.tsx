import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { IRadioOption } from '../../../ui/RadioGroup';
import { SettingsScreens } from '../../../../types';

import { IS_WEBAUTHN_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import { LOCAL_TGS_URLS } from '../../../common/helpers/animatedAssets';

import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../common/AnimatedIconWithPreview';
import Island, { IslandDescription, IslandTitle } from '../../../gili/layout/Island';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import ListItem from '../../../ui/ListItem';
import RadioGroup from '../../../ui/RadioGroup';

import lockPreviewUrl from '../../../../assets/lock.png';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  autolockDuration?: number;
  hasPasskey?: boolean;
  isLoading?: boolean;
  shouldKeepBackground: boolean;
};

const AUTOLOCK_DURATIONS_MS = {
  disabled: 0,
  oneMinute: 60 * 1000,
  fiveMinutes: 5 * 60 * 1000,
  thirtyMinutes: 30 * 60 * 1000,
  oneHour: 60 * 60 * 1000,
};

const SettingsPasscodeEnabled = ({
  isActive, autolockDuration, hasPasskey, isLoading, shouldKeepBackground, onReset,
}: OwnProps & StateProps) => {
  const {
    openSettingsScreen,
    setPasscodeAutolockDuration,
    setPasscodeKeepBackground,
  } = getActions();

  const lang = useLang();

  useHistoryBack({ isActive, onBack: onReset });

  const autolockOptions = useMemo((): IRadioOption[] => [
    { value: String(AUTOLOCK_DURATIONS_MS.disabled), label: lang('PasscodeAutoLockDisabled') },
    { value: String(AUTOLOCK_DURATIONS_MS.oneMinute), label: lang('PasscodeAutoLock1Min') },
    { value: String(AUTOLOCK_DURATIONS_MS.fiveMinutes), label: lang('PasscodeAutoLock5Min') },
    { value: String(AUTOLOCK_DURATIONS_MS.thirtyMinutes), label: lang('PasscodeAutoLock30Min') },
    { value: String(AUTOLOCK_DURATIONS_MS.oneHour), label: lang('PasscodeAutoLock1Hour') },
  ], [lang]);

  const handleAutolockChange = useLastCallback((value: string) => {
    setPasscodeAutolockDuration({ duration: Number(value) || undefined });
  });

  const handlePasskeyClick = useLastCallback(() => {
    openSettingsScreen({
      screen: hasPasskey
        ? SettingsScreens.PasscodePasskeyRemoveConfirm
        : SettingsScreens.PasscodePasskeyAddConfirm,
    });
  });

  const handleKeepBackgroundToggle = useLastCallback((isChecked: boolean) => {
    setPasscodeKeepBackground({ shouldKeep: isChecked });
  });

  return (
    <div className="settings-content local-passcode custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Lock}
          previewUrl={lockPreviewUrl}
          size={160}
          className="settings-content-icon"
        />
      </div>

      <Island>
        <ListItem
          icon="edit"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PasscodeChangePasscodeCurrent })}
        >
          {lang('PasscodeChange')}
        </ListItem>
        <ListItem
          icon="lock-crossed"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PasscodeTurnOff })}
        >
          {lang('PasscodeTurnOff')}
        </ListItem>
      </Island>

      {IS_WEBAUTHN_SUPPORTED && (
        <>
          <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('PasscodePasskeyTitle')}</IslandTitle>
          <Island>
            <Button
              className="settings-button"
              color={hasPasskey ? 'danger' : 'primary'}
              iconName={hasPasskey ? 'delete' : 'key'}
              isText
              disabled={isLoading}
              noForcedUpperCase
              onClick={handlePasskeyClick}
            >
              {lang(hasPasskey ? 'PasskeyDeleteTitle' : 'PasscodePasskeyEnable')}
            </Button>
          </Island>
          <IslandDescription dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('PasscodePasskeyDescription')}
          </IslandDescription>
        </>
      )}

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('PasscodeLockScreenTitle')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('PasscodeKeepBackground')}
          subLabel={lang('PasscodeKeepBackgroundInfo')}
          checked={shouldKeepBackground}
          teactExperimentControlled
          onCheck={handleKeepBackgroundToggle}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('PasscodeAutoLockTitle')}</IslandTitle>
      <Island>
        <RadioGroup
          name="passcode-autolock"
          options={autolockOptions}
          selected={String(autolockDuration || 0)}
          onChange={handleAutolockChange}
        />
      </Island>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      autolockDuration: global.passcode.autolockDuration,
      hasPasskey: global.passcode.hasPasskey,
      isLoading: global.passcode.isLoading,
      shouldKeepBackground: global.sharedState.settings.shouldKeepLockScreenBackground,
    };
  },
)(SettingsPasscodeEnabled));
