import React from '../src/lib/teact/teact';
import TeactDOM from '../src/lib/teact/teact-dom';
import { addReducer, getDispatch } from '../src/lib/teact/teactn';
import '../src/global';
import Main from '../src/components/main/Main';

export default () => {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    document.body.appendChild(root);

    getDispatch().init();
    getDispatch().initApi();

    TeactDOM.render(
      <Main />,
      root,
    );

    addReducer('saveSession', () => {
      resolve();
    });
  });
};
