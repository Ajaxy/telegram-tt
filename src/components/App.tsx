/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FC } from '../lib/teact/teact';
import React, { useEffect, useLayoutEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import type { GlobalState } from '../global/types';
import type { ThemeKey } from '../types';
import type { UiLoaderPage } from './common/UiLoader';

import {
  DARK_THEME_BG_COLOR, INACTIVE_MARKER, LIGHT_THEME_BG_COLOR, PAGE_TITLE,
} from '../config';
import { selectTabState, selectTheme } from '../global/selectors';
import { addActiveTabChangeListener } from '../util/activeTabMonitor';
import buildClassName from '../util/buildClassName';
import { setupBeforeInstallPrompt } from '../util/installPrompt';
import { parseInitialLocationHash } from '../util/routing';
import { hasStoredSession } from '../util/sessions';
import { IS_INSTALL_PROMPT_SUPPORTED, IS_MULTITAB_SUPPORTED, PLATFORM_ENV } from '../util/windowEnvironment';
import { updateSizes } from '../util/windowSize';

import useAppLayout from '../hooks/useAppLayout';
import useFlag from '../hooks/useFlag';
import usePrevious from '../hooks/usePrevious';

// import Test from './test/TestSvg';
import Auth from './auth/Auth';
import UiLoader from './common/UiLoader';
import AppInactive from './main/AppInactive';
import LockScreen from './main/LockScreen.async';
import Main from './main/Main.async';
import Transition from './ui/Transition';

import styles from './App.module.scss';

type StateProps = {
  authState: GlobalState['authState'];
  isScreenLocked?: boolean;
  hasPasscode?: boolean;
  isInactiveAuth?: boolean;
  hasWebAuthTokenFailed?: boolean;
  theme: ThemeKey;
};

enum AppScreens {
  auth,
  main,
  lock,
  inactive,
}

const TRANSITION_RENDER_COUNT = Object.keys(AppScreens).length / 2;
const INACTIVE_PAGE_TITLE = `${PAGE_TITLE} ${INACTIVE_MARKER}`;

const App: FC<StateProps> = ({
  authState,
  isScreenLocked,
  hasPasscode,
  isInactiveAuth,
  hasWebAuthTokenFailed,
  theme,
}) => {
  const { disconnect } = getActions();

  const [isInactive, markInactive, unmarkInactive] = useFlag(false);
  const { isMobile } = useAppLayout();
  const isMobileOs = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  useEffect(() => {
    if (IS_INSTALL_PROMPT_SUPPORTED) {
      setupBeforeInstallPrompt();
    }
  }, []);

  // Prevent drop on elements that do not accept it
  useEffect(() => {
    const body = document.body;
    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer) return;
      if (!(e.target as HTMLElement).dataset.dropzone) {
        e.dataTransfer.dropEffect = 'none';
      } else {
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    body.addEventListener('drop', handleDrop);
    body.addEventListener('dragover', handleDrag);
    body.addEventListener('dragenter', handleDrag);

    return () => {
      body.removeEventListener('drop', handleDrop);
      body.removeEventListener('dragover', handleDrag);
      body.removeEventListener('dragenter', handleDrag);
    };
  }, []);

  // return <Test />;

  let activeKey: number;
  let page: UiLoaderPage | undefined;

  if (isInactive) {
    activeKey = AppScreens.inactive;
  } else if (isScreenLocked) {
    page = 'lock';
    activeKey = AppScreens.lock;
  } else if (authState) {
    switch (authState) {
      case 'authorizationStateWaitPhoneNumber':
        page = 'authPhoneNumber';
        activeKey = AppScreens.auth;
        break;
      case 'authorizationStateWaitCode':
        page = 'authCode';
        activeKey = AppScreens.auth;
        break;
      case 'authorizationStateWaitPassword':
        page = 'authPassword';
        activeKey = AppScreens.auth;
        break;
      case 'authorizationStateWaitRegistration':
        activeKey = AppScreens.auth;
        break;
      case 'authorizationStateWaitQrCode':
        page = 'authQrCode';
        activeKey = AppScreens.auth;
        break;
      case 'authorizationStateClosed':
      case 'authorizationStateClosing':
      case 'authorizationStateLoggingOut':
      case 'authorizationStateReady':
        page = 'main';
        activeKey = AppScreens.main;
        break;
    }
  } else if (hasStoredSession(true)) {
    page = 'main';
    activeKey = AppScreens.main;
  } else if (hasPasscode) {
    activeKey = AppScreens.lock;
  } else {
    page = isMobileOs ? 'authPhoneNumber' : 'authQrCode';
    activeKey = AppScreens.auth;
  }

  if (activeKey !== AppScreens.lock
    && activeKey !== AppScreens.inactive
    && activeKey !== AppScreens.main
    && parseInitialLocationHash()?.tgWebAuthToken
    && !hasWebAuthTokenFailed) {
    page = 'main';
    activeKey = AppScreens.main;
  }

  useEffect(() => {
    updateSizes();
  }, []);

  useEffect(() => {
    if (IS_MULTITAB_SUPPORTED) return;

    addActiveTabChangeListener(() => {
      disconnect();
      document.title = INACTIVE_PAGE_TITLE;

      markInactive();
    });
  }, [activeKey, disconnect, markInactive]);

  useEffect(() => {
    if (isInactiveAuth) {
      document.title = INACTIVE_PAGE_TITLE;
      markInactive();
    } else {
      document.title = PAGE_TITLE;
      unmarkInactive();
    }
  }, [isInactiveAuth, markInactive, unmarkInactive]);

  const prevActiveKey = usePrevious(activeKey);

  // eslint-disable-next-line consistent-return
  function renderContent() {
    switch (activeKey) {
      case AppScreens.auth:
        return <Auth />;
      case AppScreens.main:
        return <Main isMobile={isMobile} />;
      case AppScreens.lock:
        return <LockScreen isLocked={isScreenLocked} />;
      case AppScreens.inactive:
        return <AppInactive />;
    }
  }

  useLayoutEffect(() => {
    document.body.classList.add(styles.bg);
  }, []);

  /*  useLayoutEffect(() => {
    document.body.style.setProperty(
      '--theme-background-color',
      theme === 'dark' ? DARK_THEME_BG_COLOR : LIGHT_THEME_BG_COLOR,
    );
  }, [theme]); */

  return (
    <UiLoader page={page} isMobile={isMobile}>
      <Transition
        name="fade"
        activeKey={activeKey}
        shouldCleanup
        className={buildClassName(
          'full-height',
          (activeKey === AppScreens.auth || prevActiveKey === AppScreens.auth) && 'is-auth',
        )}
        renderCount={TRANSITION_RENDER_COUNT}
      >
        {renderContent}
      </Transition>
    </UiLoader>
  );
};

export default withGlobal(
  (global): StateProps => {
    return {
      authState: global.authState,
      isScreenLocked: global.passcode?.isScreenLocked,
      hasPasscode: global.passcode?.hasPasscode,
      isInactiveAuth: selectTabState(global).isInactive,
      hasWebAuthTokenFailed: global.hasWebAuthTokenFailed || global.hasWebAuthTokenPasswordRequired,
      theme: selectTheme(global),
    };
  },
)(App);
