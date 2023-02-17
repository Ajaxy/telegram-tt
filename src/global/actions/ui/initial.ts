import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { ANIMATION_LEVEL_MAX } from '../../../config';
import {
  IS_ANDROID, IS_IOS, IS_MAC_OS, IS_SAFARI, IS_TOUCH_ENV,
} from '../../../util/environment';
import { setLanguage } from '../../../util/langProvider';
import switchTheme from '../../../util/switchTheme';
import { selectTabState, selectNotifySettings, selectTheme } from '../../selectors';
import { startWebsync, stopWebsync } from '../../../util/websync';
import { subscribe, unsubscribe } from '../../../util/notifications';
import { clearCaching, setupCaching } from '../../cache';
import { decryptSessionByCurrentHash } from '../../../util/passcode';
import { storeSession } from '../../../util/sessions';
import { callApi } from '../../../api/gramjs';
import type { ActionReturnType, GlobalState } from '../../types';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addCallback } from '../../../lib/teact/teactn';

const HISTORY_ANIMATION_DURATION = 450;

subscribeToSystemThemeChange();

addActionHandler('switchMultitabRole', async (global, actions, payload): Promise<void> => {
  const { isMasterTab, tabId = getCurrentTabId() } = payload;

  if (isMasterTab === selectTabState(global, tabId).isMasterTab) {
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
    clearCaching();
    actions.onSomeTabSwitchedMultitabRole();
  } else {
    if (global.passcode.hasPasscode && !global.passcode.isScreenLocked) {
      const { sessionJson } = await decryptSessionByCurrentHash();
      const session = JSON.parse(sessionJson);
      storeSession(session, session.userId);
    }

    setupCaching();

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

      const { hasWebNotifications, hasPushNotifications } = selectNotifySettings(global);
      if (hasWebNotifications && hasPushNotifications) {
        void subscribe();
      }
    }

    setGlobal(global);

    startWebsync();
  }
});

addActionHandler('onSomeTabSwitchedMultitabRole', async (global): Promise<void> => {
  if (global.passcode.hasPasscode && !global.passcode.isScreenLocked) {
    const { sessionJson } = await decryptSessionByCurrentHash();
    const session = JSON.parse(sessionJson);
    storeSession(session, session.userId);
  }

  callApi('broadcastLocalDbUpdateFull');
});

addActionHandler('initShared', (): ActionReturnType => {
  startWebsync();
});

addCallback((global: GlobalState) => {
  let isUpdated = false;
  const tabState = selectTabState(global, getCurrentTabId());
  if (!tabState?.shouldInit) return;

  global = getGlobal();

  global = updateTabState(global, {
    shouldInit: false,
  }, tabState.id);

  const { animationLevel, messageTextSize, language } = global.settings.byKey;
  const theme = selectTheme(global);

  void setLanguage(language, undefined, true);

  document.documentElement.style.setProperty(
    '--composer-text-size', `${Math.max(messageTextSize, IS_IOS ? 16 : 15)}px`,
  );
  document.documentElement.style.setProperty('--message-meta-height', `${Math.floor(messageTextSize * 1.3125)}px`);
  document.documentElement.style.setProperty('--message-text-size', `${messageTextSize}px`);
  document.documentElement.setAttribute('data-message-text-size', messageTextSize.toString());
  document.body.classList.add('initial');
  document.body.classList.add(`animation-level-${animationLevel}`);
  document.body.classList.add(IS_TOUCH_ENV ? 'is-touch-env' : 'is-pointer-env');

  switchTheme(theme, animationLevel === ANIMATION_LEVEL_MAX);

  startWebsync();

  if (IS_IOS) {
    document.body.classList.add('is-ios');
  } else if (IS_ANDROID) {
    document.body.classList.add('is-android');
  } else if (IS_MAC_OS) {
    document.body.classList.add('is-macos');
  }
  if (IS_SAFARI) {
    document.body.classList.add('is-safari');
  }

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
  const { uiReadyState, tabId = getCurrentTabId() } = payload!;

  if (uiReadyState === 2) {
    document.body.classList.remove('initial');
  }

  return updateTabState(global, {
    uiReadyState,
  }, tabId);
});

addActionHandler('setAuthPhoneNumber', (global, actions, payload): ActionReturnType => {
  const { phoneNumber } = payload!;

  return {
    ...global,
    authPhoneNumber: phoneNumber,
  };
});

addActionHandler('setAuthRememberMe', (global, actions, payload): ActionReturnType => {
  return {
    ...global,
    authRememberMe: Boolean(payload),
  };
});

addActionHandler('clearAuthError', (global): ActionReturnType => {
  return {
    ...global,
    authError: undefined,
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
    document.body.classList.remove('no-animate');
  }, HISTORY_ANIMATION_DURATION);

  global = updateTabState(global, {
    shouldSkipHistoryAnimations: true,
  }, tabId);
  setGlobal(global, { forceSyncOnIOs: true });
});

function subscribeToSystemThemeChange() {
  function handleSystemThemeChange() {
    const currentThemeMatch = document.documentElement.className.match(/theme-(\w+)/);
    const currentTheme = currentThemeMatch ? currentThemeMatch[1] : 'light';
    // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
    let global = getGlobal();
    const nextTheme = selectTheme(global);
    const { animationLevel } = global.settings.byKey;

    if (nextTheme !== currentTheme) {
      switchTheme(nextTheme, animationLevel === ANIMATION_LEVEL_MAX);
      // Force-update component containers
      global = { ...global };
      setGlobal(global);
    }
  }

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handleSystemThemeChange);
  } else if (typeof mql.addListener === 'function') {
    mql.addListener(handleSystemThemeChange);
  }
}
