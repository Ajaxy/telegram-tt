import { addCallback } from '../../../lib/teact/teactn';

import type { ActionReturnType, GlobalState } from '../../types';
import { LeftColumnContent, SettingsScreens } from '../../../types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_IOS } from '../../../util/browser/windowEnvironment';
import { disableDebugConsole, initDebugConsole } from '../../../util/debugConsole';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { areSortedArraysEqual } from '../../../util/iteratees';
import { loadAndChangeLanguage, setTimeFormat } from '../../../util/localization';
import { applyPerformanceSettings } from '../../../util/perfomanceSettings';
import switchTheme, { hasActiveThemeTransition } from '../../../util/switchTheme';
import { buildThemePalette, isThemePaletteTransitionSafe, updatePeerColors } from '../../../util/theme';
import { removeWallpaperBlobIfUnused, updateSelectedWallpaperBlobs } from '../../../util/wallpaper/storage';
import { callApi, setShouldEnableDebugLog } from '../../../api/gramjs';
import { addTabStateResetterAction } from '../../helpers/meta';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import { replaceSettings, updateSharedSettings, updateThemeSettings } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectCanAnimateInterface, selectChatFolder, selectGlobalWallpaperBackgrounds,
  selectReferencedWallpaperBackgrounds, selectTabState,
} from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';

const MAX_RECENTLY_FOUND_SETTINGS = 5;

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  const { updatePageTitle, updateShouldDebugExportedSenders, updateShouldEnableDebugLog } = getActions();

  const oldGlobal = prevGlobal;
  prevGlobal = global;

  if (!oldGlobal) return;

  const oldSharedSettings = selectSharedSettings(oldGlobal);
  const sharedSettings = selectSharedSettings(global);

  const selectedBackgrounds = selectGlobalWallpaperBackgrounds(global);
  const previousBackgrounds = selectGlobalWallpaperBackgrounds(oldGlobal);
  if (!areSortedArraysEqual(selectedBackgrounds, previousBackgrounds)
    || sharedSettings.shouldKeepLockScreenBackground !== oldSharedSettings.shouldKeepLockScreenBackground) {
    updateCustomBackgroundCache(global);
    previousBackgrounds.forEach((background) => {
      if (!selectedBackgrounds.includes(background)) {
        removeWallpaperBlobIfUnused(background, getCurrentSelectedBackgrounds);
      }
    });
  }

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

  const themeSettings = sharedSettings.themes[sharedSettings.theme];
  const oldThemeSettings = oldSharedSettings.themes[oldSharedSettings.theme];

  if (sharedSettings.theme !== oldSharedSettings.theme
    || themeSettings?.serverThemeSettings !== oldThemeSettings?.serverThemeSettings) {
    const withThemeAnimation = document.hasFocus() && selectCanAnimateInterface(global);
    const palette = buildThemePalette(sharedSettings.theme, themeSettings?.serverThemeSettings);
    const oldPalette = buildThemePalette(oldSharedSettings.theme, oldThemeSettings?.serverThemeSettings);
    const shouldSnapMessageColors = hasActiveThemeTransition(document.documentElement)
      || !isThemePaletteTransitionSafe(oldPalette, palette);

    switchTheme(sharedSettings.theme, withThemeAnimation, palette.variables, shouldSnapMessageColors);
  }

  if (sharedSettings.language !== oldSharedSettings.language) {
    const langCode = sharedSettings.language;
    void loadAndChangeLanguage(langCode).then((hasChanged) => {
      global = getGlobal();
      if (!hasChanged || selectSharedSettings(global).language !== langCode) return undefined;
      return callApi('setLanguageCode', { langCode });
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to announce language:', err);
    });
  }

  if (sharedSettings.timeFormat !== oldSharedSettings.timeFormat) {
    setTimeFormat(sharedSettings.timeFormat);
  }

  if (sharedSettings.messageTextSize !== oldSharedSettings.messageTextSize) {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(sharedSettings.messageTextSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height',
      `${Math.floor(sharedSettings.messageTextSize * 1.25)}px`);
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

addActionHandler('updateMediaEditorSettings', (global, actions, payload): ActionReturnType => {
  return {
    ...global,
    mediaEditorSettings: {
      ...global.mediaEditorSettings,
      ...payload,
    },
  };
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

addActionHandler('syncGlobalWallpaperCache', (global, actions, { background }): ActionReturnType => {
  if (!selectGlobalWallpaperBackgrounds(global).includes(background)) return undefined;
  updateCustomBackgroundCache(global);
  return undefined;
});

function updateCustomBackgroundCache(global: GlobalState) {
  updateSelectedWallpaperBlobs(
    selectGlobalWallpaperBackgrounds(global),
    undefined,
    getCurrentSelectedBackgrounds,
    selectSharedSettings(global).shouldKeepLockScreenBackground,
  );
}

function getCurrentSelectedBackgrounds() {
  const global = getGlobal();
  return selectReferencedWallpaperBackgrounds(global);
}

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
  const { screen, highlight, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  actions.loadPrivacySettings({ skipIfCached: true });
  // Force settings only if new screen is passed, do not on resets
  if (payload.screen !== undefined) actions.openLeftColumnContent({ contentKey: LeftColumnContent.Settings, tabId });
  return updateTabState(global, {
    leftColumn: {
      ...tabState.leftColumn,
      settingsScreen: screen || SettingsScreens.Main,
      settingsHighlight: highlight,
    },
  }, tabId);
});

addActionHandler('clearSettingsHighlight', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tabState = selectTabState(global, tabId);
  if (!tabState.leftColumn.settingsHighlight) return undefined;

  return updateTabState(global, {
    leftColumn: {
      ...tabState.leftColumn,
      settingsHighlight: undefined,
    },
  }, tabId);
});

addActionHandler('addRecentlyFoundSettingId', (global, actions, payload): ActionReturnType => {
  const { id } = payload;
  const otherIds = global.recentlyFoundSettingIds?.filter((recentId) => recentId !== id) || [];

  return {
    ...global,
    recentlyFoundSettingIds: [id, ...otherIds].slice(0, MAX_RECENTLY_FOUND_SETTINGS),
  };
});

addActionHandler('removeRecentlyFoundSettingId', (global, actions, payload): ActionReturnType => {
  const { id } = payload;

  return {
    ...global,
    recentlyFoundSettingIds: global.recentlyFoundSettingIds?.filter((recentId) => recentId !== id),
  };
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

addActionHandler('openSettingsConfirmation', (global, actions, payload): ActionReturnType => {
  const { confirmation, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    settingsConfirmation: confirmation,
  }, tabId);
});

addTabStateResetterAction('closeSettingsConfirmation', 'settingsConfirmation');
addTabStateResetterAction('closeLanguageModal', 'languageModal');

addActionHandler('removeCustomLanguage', (global, actions, payload): ActionReturnType => {
  const { langCode } = payload;
  const { language, customLanguages } = selectSharedSettings(global);
  if (language === langCode) return undefined;

  return updateSharedSettings(global, {
    customLanguages: customLanguages?.filter((customLanguage) => customLanguage.langCode !== langCode),
  });
});
