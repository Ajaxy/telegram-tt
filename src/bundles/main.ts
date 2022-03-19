import { getActions, getGlobal } from '../global';

import { DEBUG } from '../config';

// eslint-disable-next-line import/no-cycle
export { default as Main } from '../components/main/Main';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH LOAD MAIN BUNDLE');
}

if (!getGlobal().connectionState) {
  getActions().initApi();
}
