import { FC, useEffect } from './lib/teact/teact';
import React, { withGlobal } from './lib/teact/teactn';

import { GlobalState } from './global/types';

import { pick } from './util/iteratees';
import { updateSizes } from './util/windowSize';

import Auth from './components/auth/Auth';
import UiLoader from './components/common/UiLoader';
import Main from './components/main/Main.async';
// import Test from './components/test/TestNoRedundancy';

type StateProps = Pick<GlobalState, 'authState' | 'authIsSessionRemembered'>;

const App: FC<StateProps> = ({ authState, authIsSessionRemembered }) => {
  useEffect(() => {
    updateSizes();
  }, []);

  // return <Test />;

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

  return authIsSessionRemembered ? renderMain() : <Auth />;
};

function renderMain() {
  return (
    <UiLoader page="main" key="main">
      <Main />
    </UiLoader>
  );
}

export default withGlobal(
  (global): StateProps => pick(global, ['authState', 'authIsSessionRemembered']),
)(App);
