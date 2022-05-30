import type { FC } from './lib/teact/teact';
import React, { useEffect } from './lib/teact/teact';
import { getActions, withGlobal } from './global';

import type { GlobalState } from './global/types';

import { INACTIVE_MARKER, PAGE_TITLE } from './config';
import { pick } from './util/iteratees';
import { updateSizes } from './util/windowSize';
import { addActiveTabChangeListener } from './util/activeTabMonitor';
import useFlag from './hooks/useFlag';

import Auth from './components/auth/Auth';
import UiLoader from './components/common/UiLoader';
import Main from './components/main/Main.async';
import AppInactive from './components/main/AppInactive';
import { hasStoredSession } from './util/sessions';
// import Test from './components/test/TestNoRedundancy';

type StateProps = Pick<GlobalState, 'authState'>;

const App: FC<StateProps> = ({ authState }) => {
  const { disconnect } = getActions();

  const [isInactive, markInactive] = useFlag(false);

  useEffect(() => {
    updateSizes();
    addActiveTabChangeListener(() => {
      disconnect();
      document.title = `${PAGE_TITLE}${INACTIVE_MARKER}`;

      markInactive();
    });
  }, [disconnect, markInactive]);

  // return <Test />;

  if (isInactive) {
    return <AppInactive />;
  }

  if (authState) {
    switch (authState) {
      case 'authorizationStateWaitPhoneNumber':
      case 'authorizationStateWaitCode':
      case 'authorizationStateWaitPassword':
      case 'authorizationStateWaitRegistration':
      case 'authorizationStateWaitQrCode':
        return <Auth />;
      case 'authorizationStateClosed':
      case 'authorizationStateClosing':
      case 'authorizationStateLoggingOut':
      case 'authorizationStateReady':
        return renderMain();
    }
  }

  return hasStoredSession(true) ? renderMain() : <Auth />;
};

function renderMain() {
  return (
    <UiLoader page="main" key="main">
      <Main />
    </UiLoader>
  );
}

export default withGlobal(
  (global): StateProps => pick(global, ['authState']),
)(App);
