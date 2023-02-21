import {
  addActionHandler, getGlobal, setGlobal,
} from './index';

import { INITIAL_GLOBAL_STATE, INITIAL_TAB_STATE } from './initialState';
import { IS_MULTITAB_SUPPORTED } from '../util/environment';
import { IS_MOCKED_CLIENT } from '../config';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';
import { replaceTabThreadParam, replaceThreadParam, updatePasscodeSettings } from './reducers';
import { clearStoredSession } from '../util/sessions';
import { parseLocationHash } from '../util/routing';
import { MAIN_THREAD_ID } from '../api/types';
import { selectTabState, selectThreadParam } from './selectors';
import { Bundles, loadBundle } from '../util/moduleLoader';
import { getCurrentTabId, reestablishMasterToSelf } from '../util/establishMultitabRole';
import { updateTabState } from './reducers/tabs';
import type { ActionReturnType, GlobalState } from './types';
import { getIsMobile } from '../hooks/useAppLayout';
import { isLocalMessageId } from './helpers';

initCache();

addActionHandler('initShared', (prevGlobal, actions, payload): ActionReturnType => {
  const { force } = payload || {};
  if (!force && 'byTabId' in prevGlobal) return prevGlobal;

  const initial = cloneDeep(INITIAL_GLOBAL_STATE);
  let global = loadCache(initial) || initial;
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
  }

  return global;
});

addActionHandler('init', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), isMasterTab } = payload || {};

  const initialTabState = cloneDeep(INITIAL_TAB_STATE);
  initialTabState.id = tabId;
  initialTabState.isChatInfoShown = Boolean(global.lastIsChatInfoShown);
  initialTabState.audioPlayer.playbackRate = global.audioPlayer.lastPlaybackRate;
  initialTabState.audioPlayer.isPlaybackRateActive = global.audioPlayer.isLastPlaybackRateActive;
  initialTabState.mediaViewer.playbackRate = global.mediaViewer.lastPlaybackRate;

  global = {
    ...global,
    byTabId: {
      ...global.byTabId,
      [tabId]: initialTabState,
    },
  };

  if (isMasterTab || !IS_MULTITAB_SUPPORTED) {
    initialTabState.isMasterTab = true;
  }

  Object.keys(global.messages.byChatId).forEach((chatId) => {
    const lastViewportIds = selectThreadParam(global, chatId, MAIN_THREAD_ID, 'lastViewportIds');
    // Check if migration from previous version is faulty
    if (!lastViewportIds?.every((id) => isLocalMessageId(id) || global.messages.byChatId[chatId]?.byId[id])) {
      global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'lastViewportIds', undefined);
      return;
    }
    global = replaceTabThreadParam(
      global,
      chatId,
      MAIN_THREAD_ID,
      'viewportIds',
      lastViewportIds,
      tabId,
    );
  });

  // Temporary state fix
  Object.keys(global.messages.byChatId).forEach((chatId) => {
    const threadsById = global.messages.byChatId[chatId].threadsById;
    const fixedThreadsById = Object.keys(threadsById).reduce((acc, key) => {
      const t = threadsById[Number(key)];
      acc[Number(key)] = {
        ...t,
        listedIds: t.lastViewportIds,
      };
      return acc;
    }, {} as GlobalState['messages']['byChatId'][string]['threadsById']);

    global = {
      ...global,
      messages: {
        ...global.messages,
        byChatId: {
          ...global.messages.byChatId,
          [chatId]: {
            ...global.messages.byChatId[chatId],
            threadsById: fixedThreadsById,
          },
        },
      },
    };
  });

  const parsedMessageList = !getIsMobile() ? parseLocationHash() : undefined;

  if (global.authState !== 'authorizationStateReady'
    && !global.passcode.hasPasscode && !global.passcode.isScreenLocked) {
    Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
      if (otherTabId === tabId) return;
      global = updateTabState(global, {
        isInactive: true,
      }, otherTabId);
    });
  }

  if (!IS_MULTITAB_SUPPORTED) {
    actions.initApi();
  }

  return updateTabState(global, {
    messageLists: parsedMessageList ? [parsedMessageList] : initialTabState.messageLists,
  }, tabId);
});

addActionHandler('requestMasterAndCallAction', async (
  global, actions, payload,
): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload;

  if (selectTabState(global, tabId).isMasterTab) {
    const { action, payload: actionPayload } = payload;
    // @ts-ignore
    actions[action](actionPayload);
    return;
  }

  if (global.phoneCall || global.groupCalls.activeGroupCallId) {
    await loadBundle(Bundles.Calls);
    if ('hangUp' in actions) actions.hangUp({ tabId });
    if ('leaveGroupCall' in actions) actions.leaveGroupCall({ tabId });
  } else {
    reestablishMasterToSelf();
  }

  global = getGlobal();
  global = updateTabState(global, {
    multitabNextAction: payload,
  }, tabId);
  setGlobal(global);
});

addActionHandler('clearMultitabNextAction', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    multitabNextAction: undefined,
  }, tabId);
});
