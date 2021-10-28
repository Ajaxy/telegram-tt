import './util/handleError';
import './util/setupServiceWorker';

import React, { getDispatch, getGlobal } from './lib/teact/teactn';
import TeactDOM from './lib/teact/teact-dom';

import './global';

import { DEBUG } from './config';

import App from './App';

import './styles/index.scss';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> INIT');
}

getDispatch().init();

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> START INITIAL RENDER');
}

TeactDOM.render(
  <App />,
  document.getElementById('root'),
);

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH INITIAL RENDER');
}

document.addEventListener('dblclick', () => {
  // eslint-disable-next-line no-console
  console.warn('GLOBAL STATE', getGlobal());
});
