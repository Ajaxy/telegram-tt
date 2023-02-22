import type { FC } from './lib/teact/teact';
import React, { useEffect } from './lib/teact/teact';
import { getActions, withGlobal } from './global';

import type { GlobalState } from './global/types';
import type { UiLoaderPage } from './components/common/UiLoader';

import { IS_INSTALL_PROMPT_SUPPORTED, IS_MULTITAB_SUPPORTED, PLATFORM_ENV } from './util/environment';
import { INACTIVE_MARKER, PAGE_TITLE } from './config';
import { selectTabState } from './global/selectors';
import { updateSizes } from './util/windowSize';
import { addActiveTabChangeListener } from './util/activeTabMonitor';
import { hasStoredSession } from './util/sessions';
import { setupBeforeInstallPrompt } from './util/installPrompt';
import buildClassName from './util/buildClassName';
import { parseInitialLocationHash } from './util/routing';
import useFlag from './hooks/useFlag';
import usePrevious from './hooks/usePrevious';
import useAppLayout from './hooks/useAppLayout';

import Auth from './components/auth/Auth';
import Main from './components/main/Main.async';
import LockScreen from './components/main/LockScreen.async';
import AppInactive from './components/main/AppInactive';
import Transition from './components/ui/Transition';
import UiLoader from './components/common/UiLoader';
// import Test from './components/test/TestNoRedundancy';

type StateProps = {
  authState: GlobalState['authState'];
  isScreenLocked?: boolean;
  hasPasscode?: boolean;
  isInactiveAuth?: boolean;
  hasWebAuthTokenFailed?: boolean;
};

enum AppScreens {
  auth,
  lock,
  main,
  inactive,
}

const INACTIVE_PAGE_TITLE = `${PAGE_TITLE} ${INACTIVE_MARKER}`;

const App: FC<StateProps> = ({
  authState,
  isScreenLocked,
  hasPasscode,
  hasWebAuthTokenFailed,
  isInactiveAuth,
}) => {
  const { disconnect, updatePageTitle } = getActions();

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

    if (IS_MULTITAB_SUPPORTED) return;

    addActiveTabChangeListener(() => {
      disconnect();
      document.title = INACTIVE_PAGE_TITLE;

      markInactive();
    });
  }, [activeKey, disconnect, markInactive, updatePageTitle]);

  useEffect(() => {
    if (isInactiveAuth) {
      document.title = INACTIVE_PAGE_TITLE;
      markInactive();
    } else {
      unmarkInactive();
    }
  }, [isInactiveAuth, markInactive, unmarkInactive, updatePageTitle]);

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

  return (
    <UiLoader key="Loader" page={page} isMobile={isMobile}>
      <Transition
        name="fade"
        activeKey={activeKey}
        shouldCleanup
        className={buildClassName(
          'full-height',
          (activeKey === AppScreens.auth || prevActiveKey === AppScreens.auth) && 'is-auth',
        )}
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
    };
  },
)(App);
