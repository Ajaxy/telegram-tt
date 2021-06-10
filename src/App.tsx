import { FC, useEffect } from './lib/teact/teact';
import React, { withGlobal } from './lib/teact/teactn';

import { GlobalActions, GlobalState } from './global/types';

import {
  GRAMJS_SESSION_ID_KEY, INACTIVE_MARKER, LEGACY_SESSION_KEY, PAGE_TITLE,
} from './config';
import { pick } from './util/iteratees';
import { updateSizes } from './util/windowSize';
import { addActiveTabChangeListener } from './util/activeTabMonitor';
import useFlag from './hooks/useFlag';

import Auth from './components/auth/Auth';
import UiLoader from './components/common/UiLoader';
import Main from './components/main/Main.async';
import AppInactive from './components/main/AppInactive';
// import Test from './components/test/TestNoRedundancy';

type StateProps = Pick<GlobalState, 'authState'>;
type DispatchProps = Pick<GlobalActions, 'disconnect'>;

const App: FC<StateProps & DispatchProps> = ({ authState, disconnect }) => {
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

  const hasSession = localStorage.getItem(GRAMJS_SESSION_ID_KEY);
  const hasLegacySession = localStorage.getItem(LEGACY_SESSION_KEY);

  return (hasSession || hasLegacySession) ? renderMain() : <Auth />;
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
  (setGlobal, actions): DispatchProps => pick(actions, ['disconnect']),
)(App);
