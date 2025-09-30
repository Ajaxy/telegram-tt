import { addCallback } from '../../../lib/teact/teactn';

import type { LangCode } from '../../../types';
import type { ActionReturnType, GlobalState } from '../../types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_ELECTRON, IS_MULTIACCOUNT_SUPPORTED, IS_TAURI } from '../../../util/browser/globalEnvironment';
import {
  IS_ANDROID, IS_IOS, IS_LINUX,
  IS_MAC_OS, IS_SAFARI, IS_TOUCH_ENV, IS_WINDOWS,
} from '../../../util/browser/windowEnvironment';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { subscribe, unsubscribe } from '../../../util/notifications';
import { oldSetLanguage } from '../../../util/oldLangProvider';
import { decryptSessionByCurrentHash } from '../../../util/passcode';
import { applyPerformanceSettings } from '../../../util/perfomanceSettings';
import { hasStoredSession, storeSession } from '../../../util/sessions';
import switchTheme from '../../../util/switchTheme';
import { getSystemTheme, setSystemThemeChangeCallback } from '../../../util/systemTheme';
import { startWebsync, stopWebsync } from '../../../util/websync';
import { callApi } from '../../../api/gramjs';
import { clearCaching, setupCaching } from '../../cache';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateSharedSettings } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectCanAnimateInterface,
  selectPerformanceSettings,
  selectSettingsKeys,
  selectTabState,
  selectTheme,
} from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';
import { destroySharedStatePort, initSharedState } from '../../shared/sharedStateConnector';

const HISTORY_ANIMATION_DURATION = 450;

setSystemThemeChangeCallback((theme) => {
  let global = getGlobal();

  if (!global.isInited || !selectSharedSettings(global).shouldUseSystemTheme) return;

  global = updateSharedSettings(global, { theme });
  setGlobal(global);
});

addActionHandler('switchMultitabRole', async (global, actions, payload): Promise<void> => {
  const { isMasterTab, tabId = getCurrentTabId() } = payload;

  if (isMasterTab === selectTabState(global, tabId).isMasterTab) {
    callApi('broadcastLocalDbUpdateFull');
    return;
  }

  global = updateTabState(global, {
    isMasterTab,
  }, tabId);
  setGlobal(global, { forceSyncOnIOs: true });

  if (!isMasterTab) {
    void unsubscribe();
    actions.destroyConnection();
    stopWebsync();
    destroySharedStatePort();
    clearCaching();
    actions.onSomeTabSwitchedMultitabRole();
  } else {
    if (global.passcode.hasPasscode && !global.passcode.isScreenLocked) {
      const { sessionJson } = await decryptSessionByCurrentHash();
      const session = JSON.parse(sessionJson);
      storeSession(session);
    }

    if (hasStoredSession()) {
      setupCaching();
    }

    global = getGlobal();
    if (!global.passcode.hasPasscode || !global.passcode.isScreenLocked) {
      if (global.connectionState === 'connectionStateReady') {
        global = {
          ...global,
          connectionState: 'connectionStateConnecting',
        };
        setGlobal(global);
      }
      actions.initApi();
    }

    startWebsync();
    if (IS_MULTIACCOUNT_SUPPORTED) {
      initSharedState(global.sharedState);
    }
  }
});

addActionHandler('onSomeTabSwitchedMultitabRole', async (global): Promise<void> => {
  if (global.passcode.hasPasscode && !global.passcode.isScreenLocked) {
    const { sessionJson } = await decryptSessionByCurrentHash();
    const session = JSON.parse(sessionJson);
    storeSession(session);
  }

  callApi('broadcastLocalDbUpdateFull');
});

addActionHandler('initShared', (): ActionReturnType => {
  startWebsync();
});

addActionHandler('initMain', (global): ActionReturnType => {
  const { hasWebNotifications, hasPushNotifications } = selectSettingsKeys(global);
  if (hasWebNotifications && hasPushNotifications) {
    // Most of the browsers only show the notifications permission prompt after the first user gesture.
    const events = ['click', 'keypress'];
    const subscribeAfterUserGesture = () => {
      void subscribe();
      events.forEach((event) => {
        document.removeEventListener(event, subscribeAfterUserGesture);
      });
    };
    events.forEach((event) => {
      document.addEventListener(event, subscribeAfterUserGesture, { once: true });
    });
  }
});

addCallback((global: GlobalState) => {
  let isUpdated = false;
  const tabState = selectTabState(global, getCurrentTabId());
  if (!tabState?.shouldInit) return;

  global = getGlobal();

  global = updateTabState(global, {
    shouldInit: false,
  }, tabState.id);

  const { messageTextSize, language, shouldUseSystemTheme } = selectSharedSettings(global);

  const globalTheme = selectTheme(global);
  const systemTheme = getSystemTheme();
  const theme = shouldUseSystemTheme ? systemTheme : globalTheme;

  const performanceType = selectPerformanceSettings(global);

  void oldSetLanguage(language as LangCode, undefined, true);

  requestMutation(() => {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(messageTextSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height', `${Math.floor(messageTextSize * 1.3125)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${messageTextSize}px`);
    document.documentElement.setAttribute('data-message-text-size', messageTextSize.toString());
    document.body.classList.add('initial');
    document.body.classList.add(IS_TOUCH_ENV ? 'is-touch-env' : 'is-pointer-env');
    applyPerformanceSettings(performanceType);

    if (IS_IOS) {
      document.body.classList.add('is-ios');
    } else if (IS_ANDROID) {
      document.body.classList.add('is-android');
    } else if (IS_MAC_OS) {
      document.body.classList.add('is-macos');
    } else if (IS_WINDOWS) {
      document.body.classList.add('is-windows');
    } else if (IS_LINUX) {
      document.body.classList.add('is-linux');
    }
    if (IS_SAFARI) {
      document.body.classList.add('is-safari');
    }
    if (IS_TAURI) {
      document.body.classList.add('is-tauri');
    }
    if (IS_ELECTRON) { // Legacy, pretend to be Tauri
      document.body.classList.add('is-tauri');
    }
  });

  const canAnimate = selectCanAnimateInterface(global);

  switchTheme(theme, canAnimate);
  // Make sure global has the latest theme. Will cause `switchTheme` on change
  global = updateSharedSettings(global, { theme });

  startWebsync();

  isUpdated = true;

  if (isUpdated) setGlobal(global);
});

addActionHandler('setInstallPrompt', (global, actions, payload): ActionReturnType => {
  const { canInstall, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    canInstall,
  }, tabId);
});

addActionHandler('setIsUiReady', (global, actions, payload): ActionReturnType => {
  const { uiReadyState, tabId = getCurrentTabId() } = payload;

  if (uiReadyState === 2) {
    requestMutation(() => {
      document.body.classList.remove('initial');
    });
  }

  return updateTabState(global, {
    uiReadyState,
  }, tabId);
});

addActionHandler('setAuthPhoneNumber', (global, actions, payload): ActionReturnType => {
  const { phoneNumber } = payload;

  return {
    ...global,
    authPhoneNumber: phoneNumber,
  };
});

addActionHandler('setAuthRememberMe', (global, actions, payload): ActionReturnType => {
  return {
    ...global,
    authRememberMe: Boolean(payload.value),
  };
});

addActionHandler('clearAuthErrorKey', (global): ActionReturnType => {
  return {
    ...global,
    authErrorKey: undefined,
  };
});

addActionHandler('disableHistoryAnimations', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  setTimeout(() => {
    global = getGlobal();
    global = updateTabState(global, {
      shouldSkipHistoryAnimations: false,
    }, tabId);
    setGlobal(global);

    requestMutation(() => {
      document.body.classList.remove('no-animate');
    });
  }, HISTORY_ANIMATION_DURATION);

  global = updateTabState(global, {
    shouldSkipHistoryAnimations: true,
  }, tabId);
  setGlobal(global, { forceSyncOnIOs: true });
});
