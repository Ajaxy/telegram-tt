import { getActions, getGlobal } from '../global';

import { IS_MULTITAB_SUPPORTED } from '../util/windowEnvironment';
import { DEBUG } from '../config';

export { default as Main } from '../components/main/Main';
export { default as LockScreen } from '../components/main/LockScreen';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH LOAD MAIN BUNDLE');
}

const { passcode: { isScreenLocked }, connectionState } = getGlobal();
if (!connectionState && !isScreenLocked && !IS_MULTITAB_SUPPORTED) {
  getActions().initApi();
}
