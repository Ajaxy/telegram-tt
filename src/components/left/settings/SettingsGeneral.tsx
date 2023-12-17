/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ISettings, SettingsScreens, TimeFormat } from '../../../types';
import type { IRadioOption } from '../../ui/RadioGroup';

import { pick } from '../../../util/iteratees';
import { setTimeFormat } from '../../../util/langProvider';
import { getSystemTheme } from '../../../util/systemTheme';
import {
  IS_ANDROID, IS_ELECTRON, IS_IOS, IS_MAC_OS, IS_WINDOWS,
} from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps =
  Pick<ISettings, (
    'messageTextSize' |
    'animationLevel' |
    'messageSendKeyCombo' |
    'timeFormat'
  )> & {
    theme: ISettings['theme'];
    shouldUseSystemTheme: boolean;
  };

const TIME_FORMAT_OPTIONS: IRadioOption[] = [{
  label: '12-hour',
  value: '12h',
}, {
  label: '24-hour',
  value: '24h',
}];

const SettingsGeneral: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  messageTextSize,
  messageSendKeyCombo,
  timeFormat,
  theme,
  shouldUseSystemTheme,
}) => {
  const {
    setSettingOption,
  } = getActions();

  const lang = useLang();

  const { isMobile } = useAppLayout();
  const isMobileDevice = isMobile && (IS_IOS || IS_ANDROID);

  const appearanceThemeOptions: IRadioOption[] = [{
    label: lang('EmptyChat.Appearance.Light'),
    value: 'light',
  }, {
    label: lang('EmptyChat.Appearance.Dark'),
    value: 'dark',
  }, {
    label: lang('EmptyChat.Appearance.System'),
    value: 'auto',
  }];

  const keyboardSendOptions = !isMobileDevice ? [
    { value: 'enter', label: lang('lng_settings_send_enter'), subLabel: 'New line by Shift + Enter' },
    {
      value: 'ctrl-enter',
      label: lang(IS_MAC_OS || IS_IOS ? 'lng_settings_send_cmdenter' : 'lng_settings_send_ctrlenter'),
      subLabel: 'New line by Enter',
    },
  ] : undefined;

  const handleMessageTextSizeChange = useCallback((newSize: number) => {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(newSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height', `${Math.floor(newSize * 1.3125)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${newSize}px`);
    document.documentElement.setAttribute('data-message-text-size', newSize.toString());

    setSettingOption({ messageTextSize: newSize });
  }, [setSettingOption]);

  const handleAppearanceThemeChange = useCallback((value: string) => {
    const newTheme = value === 'auto' ? getSystemTheme() : value as ISettings['theme'];

    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: value === 'auto' });
  }, [setSettingOption]);

  const handleTimeFormatChange = useCallback((newTimeFormat: string) => {
    setSettingOption({ timeFormat: newTimeFormat as TimeFormat });
    setSettingOption({ wasTimeFormatSetManually: true });

    setTimeFormat(newTimeFormat as TimeFormat);
  }, [setSettingOption]);

  const handleMessageSendComboChange = useCallback((newCombo: string) => {
    setSettingOption({ messageSendKeyCombo: newCombo as ISettings['messageSendKeyCombo'] });
  }, [setSettingOption]);

  const [isTrayIconEnabled, setIsTrayIconEnabled] = useState(false);
  useEffect(() => {
    window.electron?.getIsTrayIconEnabled().then(setIsTrayIconEnabled);
  }, []);

  const handleIsTrayIconEnabledChange = useCallback((isChecked: boolean) => {
    window.electron?.setIsTrayIconEnabled(isChecked);
  }, []);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item pt-3">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('SETTINGS')}</h4>

        <RangeSlider
          label={lang('TextSize')}
          min={12}
          max={20}
          value={messageTextSize}
          onChange={handleMessageTextSizeChange}
        />

        {/* <ListItem
          icon="photo"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.GeneralChatBackground)}
        >
          {lang('ChatBackground')}
        </ListItem> */}

        {IS_ELECTRON && IS_WINDOWS && (
          <Checkbox
            label={lang('GeneralSettings.StatusBarItem')}
            checked={Boolean(isTrayIconEnabled)}
            onCheck={handleIsTrayIconEnabledChange}
          />
        )}
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('Theme')}
        </h4>
        <RadioGroup
          name="theme"
          options={appearanceThemeOptions}
          selected={shouldUseSystemTheme ? 'auto' : theme}
          onChange={handleAppearanceThemeChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          Time Format
        </h4>
        <RadioGroup
          name="timeformat"
          options={TIME_FORMAT_OPTIONS}
          selected={timeFormat}
          onChange={handleTimeFormatChange}
        />
      </div>

      {keyboardSendOptions && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('VoiceOver.Keyboard')}</h4>

          <RadioGroup
            name="keyboard-send-settings"
            options={keyboardSendOptions}
            onChange={handleMessageSendComboChange}
            selected={messageSendKeyCombo}
          />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { theme, shouldUseSystemTheme } = global.settings.byKey;

    return {
      ...pick(global.settings.byKey, [
        'messageTextSize',
        'animationLevel',
        'messageSendKeyCombo',
        'isSensitiveEnabled',
        'canChangeSensitive',
        'timeFormat',
      ]),
      theme,
      shouldUseSystemTheme,
    };
  },
)(SettingsGeneral));
