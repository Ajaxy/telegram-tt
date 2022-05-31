import { addActionHandler } from '../../index';
import type { ISettings, IThemeSettings, ThemeKey } from '../../../types';
import { replaceSettings, replaceThemeSettings } from '../../reducers';

addActionHandler('setSettingOption', (global, actions, payload?: Partial<ISettings>) => {
  return replaceSettings(global, payload);
});

addActionHandler('setThemeSettings', (global, actions, payload: { theme: ThemeKey } & Partial<IThemeSettings>) => {
  const { theme, ...settings } = payload;

  return replaceThemeSettings(global, theme, settings);
});

addActionHandler('requestNextSettingsScreen', (global, actions, nextScreen) => {
  return {
    ...global,
    settings: {
      ...global.settings,
      nextScreen,
    },
  };
});
