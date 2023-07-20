import './util/handleError';
import './util/setupServiceWorker';

import React from './lib/teact/teact';
import TeactDOM from './lib/teact/teact-dom';
import { enableStrict, requestMutation } from './lib/fasterdom/fasterdom';

import {
  getActions, getGlobal,
} from './global';
import updateWebmanifest from './util/updateWebmanifest';
import { IS_MULTITAB_SUPPORTED } from './util/windowEnvironment';
import './global/init';

import {
  DEBUG, MULTITAB_LOCALSTORAGE_KEY, STRICTERDOM_ENABLED,
} from './config';
import { establishMultitabRole, subscribeToMasterChange } from './util/establishMultitabRole';
import { requestGlobal, subscribeToMultitabBroadcastChannel } from './util/multitab';
import { onBeforeUnload } from './util/schedulers';
import { selectTabState } from './global/selectors';

import App from './components/App';

import './styles/index.scss';

if (STRICTERDOM_ENABLED) {
  enableStrict();
}

init();

async function init() {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> INIT');
  }

  if (!(window as any).isCompatTestPassed) return;

  if (IS_MULTITAB_SUPPORTED) {
    subscribeToMultitabBroadcastChannel();

    await requestGlobal(APP_VERSION);
    localStorage.setItem(MULTITAB_LOCALSTORAGE_KEY, '1');
    onBeforeUnload(() => {
      const global = getGlobal();
      if (Object.keys(global.byTabId).length === 1) {
        localStorage.removeItem(MULTITAB_LOCALSTORAGE_KEY);
      }
    });
  }

  getActions().initShared();
  getActions().init();

  getActions().updateShouldEnableDebugLog();
  getActions().updateShouldDebugExportedSenders();

  if (IS_MULTITAB_SUPPORTED) {
    establishMultitabRole();
    subscribeToMasterChange((isMasterTab) => {
      getActions()
        .switchMultitabRole({ isMasterTab }, { forceSyncOnIOs: true });
    });
  }

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> START INITIAL RENDER');
  }

  requestMutation(() => {
    updateWebmanifest();

    TeactDOM.render(
      <App />,
      document.getElementById('root')!,
    );
  });

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> FINISH INITIAL RENDER');
  }

  if (DEBUG) {
    document.addEventListener('dblclick', () => {
      // eslint-disable-next-line no-console
      console.warn('TAB STATE', selectTabState(getGlobal()));
      // eslint-disable-next-line no-console
      console.warn('GLOBAL STATE', getGlobal());
    });
  }
}

onBeforeUnload(() => {
  const actions = getActions();
  actions.leaveGroupCall?.({ isPageUnload: true });
  actions.hangUp?.({ isPageUnload: true });
});
