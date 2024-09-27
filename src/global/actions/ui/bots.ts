import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { addWebAppToOpenList } from '../../reducers/bots';

addActionHandler('openWebAppTab', (global, actions, payload): ActionReturnType => {
  const {
    webApp, tabId = getCurrentTabId(),
  } = payload;

  if (!webApp) return;

  global = getGlobal();
  global = addWebAppToOpenList(global, webApp, true, true, tabId);
  setGlobal(global);
});
