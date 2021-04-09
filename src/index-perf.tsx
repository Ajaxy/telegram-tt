import React, { getGlobal, setGlobal } from './lib/teact/teactn';
import TeactDOM from './lib/teact/teact-dom';
// import './store';

import { Bundles, loadModule } from './util/moduleLoader';

import App from './App';

import './styles/index.scss';

function renderApp() {
  return TeactDOM.render(
    <App />,
    document.getElementById('root'),
  );
}

function renderNothing() {
  TeactDOM.render(
    <div />,
    document.getElementById('root'),
  );
}

function preloadMainBundle() {
  return loadModule(Bundles.Main, 'Main');
}

// getDispatch().init();
// renderApp();

(window as any).perf = {
  getGlobal,
  setGlobal,
  renderApp,
  renderNothing,
  preloadMainBundle,
};
