import { getActions, getGlobal } from '../global';

import { DEBUG } from '../config';

// eslint-disable-next-line import/no-cycle
export { default as Main } from '../components/main/Main';
export { default as LockScreen } from '../components/main/LockScreen';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH LOAD MAIN BUNDLE');
}

const { connectionState, passcode: { isScreenLocked } } = getGlobal();
if (!connectionState && !isScreenLocked) {
  getActions().initApi();
}
