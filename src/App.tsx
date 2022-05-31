import type { FC } from './lib/teact/teact';
import React, { useEffect } from './lib/teact/teact';
import { getActions, withGlobal } from './global';

import type { GlobalState } from './global/types';
import type { UiLoaderPage } from './components/common/UiLoader';

import { INACTIVE_MARKER, PAGE_TITLE } from './config';
import { PLATFORM_ENV } from './util/environment';
import { updateSizes } from './util/windowSize';
import { addActiveTabChangeListener } from './util/activeTabMonitor';
import { hasStoredSession } from './util/sessions';
import buildClassName from './util/buildClassName';
import useFlag from './hooks/useFlag';
import usePrevious from './hooks/usePrevious';

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
};

enum AppScreens {
  auth,
  lock,
  main,
  inactive,
}

const App: FC<StateProps> = ({
  authState,
  isScreenLocked,
}) => {
  const { disconnect } = getActions();

  const [isInactive, markInactive] = useFlag(false);
  const isMobile = PLATFORM_ENV === 'iOS' || PLATFORM_ENV === 'Android';

  useEffect(() => {
    updateSizes();
    addActiveTabChangeListener(() => {
      disconnect();
      document.title = `${PAGE_TITLE}${INACTIVE_MARKER}`;

      markInactive();
    });
  }, [disconnect, markInactive]);

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
  } else {
    page = isMobile ? 'authPhoneNumber' : 'authQrCode';
    activeKey = AppScreens.auth;
  }

  const prevActiveKey = usePrevious(activeKey);

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean) {
    switch (activeKey) {
      case AppScreens.auth:
        return <Auth isActive={isActive} />;
      case AppScreens.main:
        return <Main />;
      case AppScreens.lock:
        return <LockScreen isLocked={isScreenLocked} />;
      case AppScreens.inactive:
        return <AppInactive />;
    }
  }

  return (
    <UiLoader key="Loader" page={page}>
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
    };
  },
)(App);
