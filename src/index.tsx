import './util/handleError';
import './util/setupServiceWorker';

import React from './lib/teact/teact';
import TeactDOM from './lib/teact/teact-dom';

import { getActions, getGlobal } from './global';
import updateWebmanifest from './util/updateWebmanifest';
import './global/init';

import { DEBUG } from './config';

import App from './App';

import './styles/index.scss';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> INIT');
}

getActions().init();

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> START INITIAL RENDER');
}

updateWebmanifest();

TeactDOM.render(
  <App />,
  document.getElementById('root')!,
);

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH INITIAL RENDER');
}

document.addEventListener('dblclick', () => {
  // eslint-disable-next-line no-console
  console.warn('GLOBAL STATE', getGlobal());
});
