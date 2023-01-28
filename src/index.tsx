import './util/handleError';
import './util/setupServiceWorker';

import React from './lib/teact/teact';
import TeactDOM from './lib/teact/teact-dom';

import {
  getActions, getGlobal,
} from './global';
import updateWebmanifest from './util/updateWebmanifest';
import { setupBeforeInstallPrompt } from './util/installPrompt';
import { IS_INSTALL_PROMPT_SUPPORTED, IS_MULTITAB_SUPPORTED } from './util/environment';
import './global/init';

import { DEBUG, MULTITAB_LOCALSTORAGE_KEY } from './config';
import { establishMultitabRole, subscribeToMasterChange } from './util/establishMultitabRole';
import { requestGlobal, subscribeToMultitabBroadcastChannel } from './util/multitab';
import { onBeforeUnload } from './util/schedulers';
import { selectTabState } from './global/selectors';

import App from './App';

import './styles/index.scss';

async function init() {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('>>> INIT');
  }

  if (IS_MULTITAB_SUPPORTED) {
    subscribeToMultitabBroadcastChannel();

    await requestGlobal();
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

  updateWebmanifest();

  if (IS_INSTALL_PROMPT_SUPPORTED) {
    setupBeforeInstallPrompt();
  }

  TeactDOM.render(
    <App />,
    document.getElementById('root')!,
  );

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

init();
