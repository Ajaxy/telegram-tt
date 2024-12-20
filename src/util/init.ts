import type { GlobalState } from '../global/types';

import { IS_MOCKED_CLIENT } from '../config';
import { loadCache } from '../global/cache';
import {
  getGlobal, setGlobal,
} from '../global/index';
import { INITIAL_GLOBAL_STATE } from '../global/initialState';
import { updatePasscodeSettings } from '../global/reducers';
import { cloneDeep } from './iteratees';
import { clearStoredSession } from './sessions';

export async function initGlobal(force: boolean = false, prevGlobal?: GlobalState) {
  prevGlobal = prevGlobal || getGlobal();
  if (!force && 'byTabId' in prevGlobal) {
    return;
  }

  const initial = cloneDeep(INITIAL_GLOBAL_STATE);
  let global = await loadCache(initial) || initial;
  if (IS_MOCKED_CLIENT) global.authState = 'authorizationStateReady';

  const { hasPasscode, isScreenLocked } = global.passcode;
  if (hasPasscode && !isScreenLocked) {
    global = updatePasscodeSettings(global, {
      isScreenLocked: true,
    });

    clearStoredSession();
  }

  if (force) {
    global.byTabId = prevGlobal.byTabId;

    // Keep the theme if it was set before
    global.settings.byKey.theme = prevGlobal.settings.byKey.theme;
  }

  setGlobal(global);
}
