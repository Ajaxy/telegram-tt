import { addActionHandler } from '../../index';
import { replaceSettings, replaceThemeSettings } from '../../reducers';
import switchTheme from '../../../util/switchTheme';
import { ANIMATION_LEVEL_MAX, ANIMATION_LEVEL_MED, ANIMATION_LEVEL_MIN } from '../../../config';
import { setLanguage, setTimeFormat } from '../../../util/langProvider';
import { IS_IOS } from '../../../util/environment';
import type { ActionReturnType, GlobalState } from '../../types';
import { updateTabState } from '../../reducers/tabs';
import { addCallback } from '../../../lib/teact/teactn';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  const settings = global.settings.byKey;
  const prevSettings = prevGlobal?.settings.byKey;
  prevGlobal = global;

  if (!prevSettings) {
    return;
  }

  if (settings.animationLevel !== prevSettings.animationLevel) {
    [ANIMATION_LEVEL_MIN, ANIMATION_LEVEL_MED, ANIMATION_LEVEL_MAX].forEach((i) => {
      document.body.classList.toggle(`animation-level-${i}`, settings.animationLevel === i);
    });
  }

  if (settings.theme !== prevSettings.theme) {
    const animationLevel = document.hasFocus() ? global.settings.byKey.animationLevel : ANIMATION_LEVEL_MIN;
    switchTheme(settings.theme, animationLevel === ANIMATION_LEVEL_MAX);
  }

  if (settings.language !== prevSettings.language) {
    setLanguage(settings.language);
  }

  if (settings.timeFormat !== prevSettings.timeFormat) {
    setTimeFormat(settings.timeFormat);
  }

  if (settings.messageTextSize !== prevSettings.messageTextSize) {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(settings.messageTextSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height',
      `${Math.floor(settings.messageTextSize * 1.3125)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${settings.messageTextSize}px`);
    document.documentElement.setAttribute('data-message-text-size', settings.messageTextSize.toString());
  }
});

addActionHandler('setSettingOption', (global, actions, payload): ActionReturnType => {
  return replaceSettings(global, payload);
});

addActionHandler('setThemeSettings', (global, actions, payload): ActionReturnType => {
  const { theme, ...settings } = payload;

  return replaceThemeSettings(global, theme, settings);
});

addActionHandler('requestNextSettingsScreen', (global, actions, payload): ActionReturnType => {
  const { screen, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    nextSettingsScreen: screen,
  }, tabId);
});
