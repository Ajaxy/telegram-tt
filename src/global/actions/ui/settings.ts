import { addCallback } from '../../../lib/teact/teactn';

import type { ActionReturnType, GlobalState } from '../../types';
import { type LangCode, LeftColumnContent, SettingsScreens } from '../../../types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_IOS } from '../../../util/browser/windowEnvironment';
import { disableDebugConsole, initDebugConsole } from '../../../util/debugConsole';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { oldSetLanguage, setTimeFormat } from '../../../util/oldLangProvider';
import { applyPerformanceSettings } from '../../../util/perfomanceSettings';
import switchTheme from '../../../util/switchTheme';
import { updatePeerColors } from '../../../util/theme';
import { callApi, setShouldEnableDebugLog } from '../../../api/gramjs';
import { addTabStateResetterAction } from '../../helpers/meta';
import {
  addActionHandler, getActions, setGlobal,
} from '../../index';
import { replaceSettings, updateSharedSettings, updateThemeSettings } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectCanAnimateInterface, selectChatFolder, selectTabState } from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  const { updatePageTitle, updateShouldDebugExportedSenders, updateShouldEnableDebugLog } = getActions();

  const oldGlobal = prevGlobal;
  prevGlobal = global;

  if (!oldGlobal) return;

  const oldSharedSettings = selectSharedSettings(oldGlobal);
  const sharedSettings = selectSharedSettings(global);

  const performance = sharedSettings.performance;
  const prevPerformance = oldSharedSettings.performance;
  const peerColors = global.peerColors;
  const prevPeerColors = oldGlobal.peerColors;

  if (peerColors && peerColors !== prevPeerColors) {
    updatePeerColors(peerColors.general);
  }

  if (performance !== prevPerformance) {
    requestMutation(() => {
      applyPerformanceSettings(performance);
    });
  }

  if (sharedSettings.theme !== oldSharedSettings.theme) {
    const withAnimation = document.hasFocus() ? selectCanAnimateInterface(global) : false;
    switchTheme(sharedSettings.theme, withAnimation);
  }

  if (sharedSettings.language !== oldSharedSettings.language) {
    oldSetLanguage(sharedSettings.language as LangCode);
  }

  if (sharedSettings.timeFormat !== oldSharedSettings.timeFormat) {
    setTimeFormat(sharedSettings.timeFormat);
  }

  if (sharedSettings.messageTextSize !== oldSharedSettings.messageTextSize) {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(sharedSettings.messageTextSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height',
      `${Math.floor(sharedSettings.messageTextSize * 1.3125)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${sharedSettings.messageTextSize}px`);
    document.documentElement.setAttribute('data-message-text-size', sharedSettings.messageTextSize.toString());
  }

  if (sharedSettings.canDisplayChatInTitle !== oldSharedSettings.canDisplayChatInTitle) {
    updatePageTitle();
  }

  if (sharedSettings.shouldForceHttpTransport !== oldSharedSettings.shouldForceHttpTransport) {
    callApi('setForceHttpTransport', Boolean(sharedSettings.shouldForceHttpTransport));
  }

  if (sharedSettings.shouldAllowHttpTransport !== oldSharedSettings.shouldAllowHttpTransport) {
    callApi('setAllowHttpTransport', Boolean(sharedSettings.shouldAllowHttpTransport));
    if (!sharedSettings.shouldAllowHttpTransport && sharedSettings.shouldForceHttpTransport) {
      global = updateSharedSettings(global, {
        shouldForceHttpTransport: false,
      });
      setGlobal(global);
    }
  }

  if (sharedSettings.shouldDebugExportedSenders !== oldSharedSettings.shouldDebugExportedSenders) {
    updateShouldDebugExportedSenders();
  }

  if (sharedSettings.shouldCollectDebugLogs !== oldSharedSettings.shouldCollectDebugLogs) {
    updateShouldEnableDebugLog();
  }
});

addActionHandler('updateShouldEnableDebugLog', (global): ActionReturnType => {
  const settings = selectSharedSettings(global);

  if (settings.shouldCollectDebugLogs) {
    setShouldEnableDebugLog(true);
    initDebugConsole();
  } else {
    setShouldEnableDebugLog(false);
    disableDebugConsole();
  }
});

addActionHandler('updateShouldDebugExportedSenders', (global): ActionReturnType => {
  const settings = selectSharedSettings(global);
  callApi('setShouldDebugExportedSenders', Boolean(settings.shouldDebugExportedSenders));
});

addActionHandler('setSettingOption', (global, actions, payload): ActionReturnType => {
  return replaceSettings(global, payload);
});

addActionHandler('setSharedSettingOption', (global, actions, payload): ActionReturnType => {
  return updateSharedSettings(global, payload);
});

addActionHandler('updatePerformanceSettings', (global, actions, payload): ActionReturnType => {
  const settings = selectSharedSettings(global);
  global = updateSharedSettings(global, {
    performance: {
      ...settings.performance,
      ...payload,
    },
    wasAnimationLevelSetManually: true,
  });

  return global;
});

addActionHandler('setThemeSettings', (global, actions, payload): ActionReturnType => {
  const { theme, ...settings } = payload;

  return updateThemeSettings(global, theme, settings);
});

addActionHandler('requestNextFoldersAction', (global, actions, payload): ActionReturnType => {
  const { foldersAction, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    nextFoldersAction: foldersAction,
  }, tabId);
});

addActionHandler('openLeftColumnContent', (global, actions, payload): ActionReturnType => {
  const { contentKey = LeftColumnContent.ChatList, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    leftColumn: {
      ...tabState.leftColumn,
      contentKey,
    },
  }, tabId);
});

addActionHandler('openSettingsScreen', (global, actions, payload): ActionReturnType => {
  const { screen, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  actions.loadPrivacySettings({ skipIfCached: true });
  // Force settings only if new screen is passed, do not on resets
  if (payload.screen !== undefined) actions.openLeftColumnContent({ contentKey: LeftColumnContent.Settings, tabId });
  return updateTabState(global, {
    leftColumn: {
      ...tabState.leftColumn,
      settingsScreen: screen || SettingsScreens.Main,
    },
  }, tabId);
});

addActionHandler('openEditChatFolder', (global, actions, payload): ActionReturnType => {
  const { folderId, isOnlyInvites, tabId = getCurrentTabId() } = payload;

  const chatFolder = selectChatFolder(global, folderId);
  if (!chatFolder) return;

  actions.openSettingsScreen({
    screen: isOnlyInvites ? SettingsScreens.FoldersEditFolderInvites : SettingsScreens.FoldersEditFolderFromChatList,
    tabId,
  });
  actions.requestNextFoldersAction({
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

  if (!noRequestNextScreen) actions.openSettingsScreen({ screen: SettingsScreens.FoldersShare, tabId });

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

  actions.openSettingsScreen({ screen: undefined, tabId });

  return updateTabState(global, {
    shareFolderScreen: undefined,
  }, tabId);
});

addActionHandler('openPasskeyModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    isPasskeyModalOpen: true,
  }, tabId);
});

addTabStateResetterAction('closePasskeyModal', 'isPasskeyModalOpen');
