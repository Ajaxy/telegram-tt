import { addActionHandler, getActions } from '../../index';
import { replaceSettings, replaceThemeSettings } from '../../reducers';
import switchTheme from '../../../util/switchTheme';
import { setLanguage, setTimeFormat } from '../../../util/langProvider';
import { IS_IOS } from '../../../util/windowEnvironment';
import type { ActionReturnType, GlobalState } from '../../types';
import { updateTabState } from '../../reducers/tabs';
import { addCallback } from '../../../lib/teact/teactn';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { applyPerformanceSettings } from '../../../util/perfomanceSettings';
import { selectCanAnimateInterface } from '../../selectors';

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  // eslint-disable-next-line eslint-multitab-tt/no-getactions-in-actions
  const { updatePageTitle } = getActions();

  const settings = global.settings.byKey;
  const prevSettings = prevGlobal?.settings.byKey;
  const performance = global.settings.performance;
  const prevPerformance = prevGlobal?.settings.performance;
  prevGlobal = global;

  if (!prevSettings) {
    return;
  }

  if (performance !== prevPerformance) {
    requestMutation(() => {
      applyPerformanceSettings(performance);
    });
  }

  if (settings.theme !== prevSettings.theme) {
    const withAnimation = document.hasFocus() ? selectCanAnimateInterface(global) : false;
    switchTheme(settings.theme, withAnimation);
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

  if (settings.canDisplayChatInTitle !== prevSettings.canDisplayChatInTitle) {
    updatePageTitle();
  }
});

addActionHandler('setSettingOption', (global, actions, payload): ActionReturnType => {
  return replaceSettings(global, payload);
});

addActionHandler('updatePerformanceSettings', (global, actions, payload): ActionReturnType => {
  global = {
    ...global,
    settings: {
      ...global.settings,
      performance: {
        ...global.settings.performance,
        ...payload,
      },
    },
  };

  return global;
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
