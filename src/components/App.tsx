import type { FC } from '../lib/teact/teact';
import { useEffect, useLayoutEffect } from '../lib/teact/teact';
import { withGlobal } from '../global';

import type { GlobalState } from '../global/types';
import type { ThemeKey } from '../types';
import type { UiLoaderPage } from './common/UiLoader';

import { DARK_THEME_BG_COLOR, INACTIVE_MARKER, LIGHT_THEME_BG_COLOR, PAGE_TITLE, PAGE_TITLE_TAURI } from '../config';
import { forceMutation } from '../lib/fasterdom/stricterdom.ts';
import { selectTabState, selectTheme } from '../global/selectors';
import { IS_TAURI } from '../util/browser/globalEnvironment';
import { IS_INSTALL_PROMPT_SUPPORTED, PLATFORM_ENV } from '../util/browser/windowEnvironment';
import buildClassName from '../util/buildClassName';
import { setupBeforeInstallPrompt } from '../util/installPrompt';
import { ACCOUNT_SLOT, getAccountsInfo, getAccountSlotUrl } from '../util/multiaccount';
import { hasEncryptedSession } from '../util/passcode';
import { getInitialLocationHash, parseInitialLocationHash } from '../util/routing';
import { checkSessionLocked, hasStoredSession } from '../util/sessions';
import { updateSizes } from '../util/windowSize';

import useTauriDrag from '../hooks/tauri/useTauriDrag';
import useAppLayout from '../hooks/useAppLayout';
import usePrevious from '../hooks/usePrevious';
import { useSignalEffect } from '../hooks/useSignalEffect.ts';
import { getIsInBackground } from '../hooks/window/useBackgroundMode.ts';

// import Test from './test/TestLocale';
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
  inactiveReason?: 'auth' | 'otherClient';
  hasWebAuthTokenFailed?: boolean;
  isTestServer?: boolean;
  theme: ThemeKey;
};

enum AppScreens {
  auth,
  main,
  lock,
  inactive,
}

const TRANSITION_RENDER_COUNT = Object.keys(AppScreens).length / 2;
const ACTIVE_PAGE_TITLE = IS_TAURI ? PAGE_TITLE_TAURI : PAGE_TITLE;
const INACTIVE_PAGE_TITLE = `${ACTIVE_PAGE_TITLE} ${INACTIVE_MARKER}`;

const App: FC<StateProps> = ({
  authState,
  isScreenLocked,
  hasPasscode,
  inactiveReason,
  hasWebAuthTokenFailed,
  isTestServer,
  theme,
}) => {
  const { isMobile } = useAppLayout();
  const isMobileOs = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  useEffect(() => {
    if (IS_INSTALL_PROMPT_SUPPORTED) {
      setupBeforeInstallPrompt();
    }
  }, []);

  useEffect(() => {
    const hash = getInitialLocationHash();
    // If there is no stored session on first slot, navigate to any other slot with stored session
    if (!hasStoredSession() && !ACCOUNT_SLOT && !hash) {
      const accounts = getAccountsInfo();
      Object.keys(accounts)
        .map(Number)
        .sort((a, b) => b - a)
        .forEach((key) => {
          const slot = Number(key);
          const account = accounts[slot];
          if (account) {
            const url = getAccountSlotUrl(slot);
            window.location.href = `${url}#${hash || 'login'}`;
          }
        });
    }

    // TODO[Passcode]: Remove when multiacc passcode is implemented
    const checkMultiaccPasscode = async () => {
      if (checkSessionLocked() && ACCOUNT_SLOT && await hasEncryptedSession()) {
        const url = getAccountSlotUrl(1);
        window.location.href = url;
      }
    };
    checkMultiaccPasscode();
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

  let activeKey: AppScreens;
  let page: UiLoaderPage | undefined;

  if (inactiveReason) {
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
  } else if (hasStoredSession()) {
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
    if (inactiveReason) {
      document.title = INACTIVE_PAGE_TITLE;
    } else {
      document.title = ACTIVE_PAGE_TITLE;
    }
  }, [inactiveReason]);

  const prevActiveKey = usePrevious(activeKey);

  function renderContent() {
    switch (activeKey) {
      case AppScreens.auth:
        return <Auth />;
      case AppScreens.main:
        return <Main isMobile={isMobile} />;
      case AppScreens.lock:
        return <LockScreen isLocked={isScreenLocked} />;
      case AppScreens.inactive:
        return <AppInactive inactiveReason={inactiveReason!} />;
    }
  }

  useTauriDrag();

  useLayoutEffect(() => {
    document.body.classList.add(styles.bg);
  }, []);

  useLayoutEffect(() => {
    document.body.style.setProperty(
      '--theme-background-color',
      theme === 'dark' ? DARK_THEME_BG_COLOR : LIGHT_THEME_BG_COLOR,
    );
  }, [theme]);

  const getIsInBackgroundLocal = getIsInBackground;
  useSignalEffect(() => {
    // Mutation forced to avoid RAF throttling in background
    forceMutation(() => {
      document.body.classList.toggle('in-background', getIsInBackgroundLocal());
    }, document.body);
  }, [getIsInBackgroundLocal]);

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
      {activeKey === AppScreens.auth && isTestServer && <div className="test-server-badge">Test server</div>}
    </UiLoader>
  );
};

export default withGlobal(
  (global): Complete<StateProps> => {
    return {
      authState: global.authState,
      isScreenLocked: global.passcode?.isScreenLocked,
      hasPasscode: global.passcode?.hasPasscode,
      inactiveReason: selectTabState(global).inactiveReason,
      hasWebAuthTokenFailed: global.hasWebAuthTokenFailed || global.hasWebAuthTokenPasswordRequired,
      theme: selectTheme(global),
      isTestServer: global.config?.isTestServer,
    };
  },
)(App);
