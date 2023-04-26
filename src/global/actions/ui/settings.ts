import { addCallback } from '../../../lib/teact/teactn';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { addActionHandler, getActions } from '../../index';

import { SettingsScreens } from '../../../types';
import type { ActionReturnType, GlobalState } from '../../types';

import { replaceSettings, replaceThemeSettings } from '../../reducers';
import switchTheme from '../../../util/switchTheme';
import { setLanguage, setTimeFormat } from '../../../util/langProvider';
import { IS_IOS } from '../../../util/windowEnvironment';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { applyPerformanceSettings } from '../../../util/perfomanceSettings';
import { selectCanAnimateInterface, selectChatFolder } from '../../selectors';

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
  const { screen, foldersAction, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    nextSettingsScreen: screen,
    nextFoldersAction: foldersAction,
  }, tabId);
});

addActionHandler('openEditChatFolder', (global, actions, payload): ActionReturnType => {
  const { folderId, isOnlyInvites, tabId = getCurrentTabId() } = payload;

  const chatFolder = selectChatFolder(global, folderId);
  if (!chatFolder) return;

  actions.requestNextSettingsScreen({
    screen: isOnlyInvites ? SettingsScreens.FoldersEditFolderInvites : SettingsScreens.FoldersEditFolderFromChatList,
    foldersAction: {
      type: 'editFolder',
      payload: chatFolder,
    },
    tabId,
  });
});

addActionHandler('openShareChatFolderModal', (global, actions, payload): ActionReturnType => {
  const {
    folderId, url, noRequestNextScreen, tabId = getCurrentTabId(),
  } = payload;

  const chatFolder = selectChatFolder(global, folderId);
  const isChatList = chatFolder?.isChatList;
  if (isChatList && !noRequestNextScreen) {
    actions.openEditChatFolder({ folderId, isOnlyInvites: true, tabId });
    return undefined;
  }

  if (!noRequestNextScreen) actions.requestNextSettingsScreen({ screen: SettingsScreens.FoldersShare, tabId });

  return updateTabState(global, {
    shareFolderScreen: {
      folderId,
      isFromSettings: Boolean(noRequestNextScreen),
      url,
    },
  }, tabId);
});

addActionHandler('closeShareChatFolderModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  actions.requestNextSettingsScreen({ screen: undefined, tabId });

  return updateTabState(global, {
    shareFolderScreen: undefined,
  }, tabId);
});
