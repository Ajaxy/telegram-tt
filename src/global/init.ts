import './intervals';

import type { ActionReturnType, GlobalState } from './types';

import { IS_MULTIACCOUNT_SUPPORTED } from '../util/browser/globalEnvironment';
import { isCacheApiSupported } from '../util/cacheApi';
import { getCurrentTabId, reestablishMasterToSelf } from '../util/establishMultitabRole';
import { initGlobal } from '../util/init';
import { cloneDeep } from '../util/iteratees';
import { isLocalMessageId } from '../util/keys/messageKey';
import { Bundles, loadBundle } from '../util/moduleLoader';
import { parseLocationHash } from '../util/routing';
import { updatePeerColors } from '../util/theme';
import { initializeChatMediaSearchResults } from './reducers/middleSearch';
import { updateTabState } from './reducers/tabs';
import { initSharedState } from './shared/sharedStateConnector';
import { initCache } from './cache';
import {
  addActionHandler, getGlobal, setGlobal,
} from './index';
import { INITIAL_TAB_STATE } from './initialState';
import { replaceTabThreadParam, replaceThreadParam } from './reducers';
import { selectTabState, selectThreadParam } from './selectors';

initCache();

addActionHandler('initShared', async (prevGlobal, actions, payload): Promise<void> => {
  const { force } = payload || {};
  await initGlobal(force, prevGlobal);
});

addActionHandler('init', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), isMasterTab } = payload || {};

  const initialTabState = cloneDeep(INITIAL_TAB_STATE);
  initialTabState.id = tabId;
  initialTabState.audioPlayer.playbackRate = global.audioPlayer.lastPlaybackRate;
  initialTabState.audioPlayer.isPlaybackRateActive = global.audioPlayer.isLastPlaybackRateActive;
  initialTabState.mediaViewer.playbackRate = global.mediaViewer.lastPlaybackRate;
  if (global.lastIsChatInfoShown) {
    initialTabState.chatInfo = {
      isOpen: true,
    };
  }

  global = {
    ...global,
    byTabId: {
      ...global.byTabId,
      [tabId]: initialTabState,
    },
  };

  if (isMasterTab) {
    initialTabState.isMasterTab = true;
  }

  if (IS_MULTIACCOUNT_SUPPORTED && initialTabState.isMasterTab) {
    initSharedState(global.sharedState);
  }

  Object.keys(global.messages.byChatId).forEach((chatId) => {
    const threadsById = global.messages.byChatId[chatId].threadsById;
    Object.keys(threadsById).forEach((thread) => {
      const threadId = Number(thread);
      const lastViewportIds = selectThreadParam(global, chatId, threadId, 'lastViewportIds');
      // Check if migration from previous version is faulty
      if (!lastViewportIds?.every((id) => isLocalMessageId(id) || global.messages.byChatId[chatId]?.byId[id])) {
        global = replaceThreadParam(global, chatId, threadId, 'lastViewportIds', undefined);
        return;
      }
      global = initializeChatMediaSearchResults(global, chatId, threadId, tabId);
      global = replaceTabThreadParam(
        global,
        chatId,
        threadId,
        'viewportIds',
        lastViewportIds,
        tabId,
      );
    });
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

  const parsedMessageList = parseLocationHash(global.currentUserId);

  if (global.authState !== 'authorizationStateReady'
    && !global.passcode.hasPasscode && !global.passcode.isScreenLocked) {
    Object.values(global.byTabId).forEach(({ id: otherTabId }) => {
      if (otherTabId === tabId) return;
      global = updateTabState(global, {
        inactiveReason: 'auth',
      }, otherTabId);
    });
  }

  isCacheApiSupported().then((isSupported) => {
    global = getGlobal();
    global.isCacheApiSupported = isSupported;
    setGlobal(global);
  });

  if (global.peerColors) {
    updatePeerColors(global.peerColors.general);
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
