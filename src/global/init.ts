import { addActionHandler } from './index';

import { INITIAL_STATE } from './initialState';
import { IS_MOCKED_CLIENT } from '../config';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';
import { updatePasscodeSettings } from './reducers';

initCache();

addActionHandler('init', () => {
  const initial = cloneDeep(INITIAL_STATE);
  let global = loadCache(initial) || initial;
  if (IS_MOCKED_CLIENT) global.authState = 'authorizationStateReady';

  const { hasPasscode, isScreenLocked } = global.passcode;
  if (hasPasscode && !isScreenLocked) {
    global = updatePasscodeSettings(global, {
      isScreenLocked: true,
    });
  }

  return global;
});
