import { getDispatch } from '../lib/teact/teactn';

import { DEBUG } from '../config';

export { default as Main } from '../components/main/Main';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH LOAD MAIN BUNDLE');
}

getDispatch().initApi();
