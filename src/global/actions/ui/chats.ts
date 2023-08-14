import { addActionHandler, setGlobal } from '../../index';

import { IS_ELECTRON } from '../../../config';
import { MAIN_THREAD_ID } from '../../../api/types';

import {
  exitMessageSelectMode, replaceTabThreadParam, updateCurrentMessageList, updateRequestedChatTranslation,
} from '../../reducers';
import {
  selectChat, selectCurrentMessageList, selectTabState,
} from '../../selectors';
import { closeLocalTextSearch } from './localSearch';
import type { ActionReturnType } from '../../types';
import { updateTabState } from '../../reducers/tabs';
import { createMessageHashUrl } from '../../../util/routing';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('openChat', (global, actions, payload): ActionReturnType => {
  const {
    id,
    threadId = MAIN_THREAD_ID,
    type = 'thread',
    shouldReplaceHistory = false,
    shouldReplaceLast = false,
    noForumTopicPanel,
    tabId = getCurrentTabId(),
  } = payload;

  const currentMessageList = selectCurrentMessageList(global, tabId);

  const tabState = selectTabState(global, tabId);
  if (tabState.premiumModal?.promo && tabState.premiumModal?.isOpen) {
    global = updateTabState(global, {
      premiumModal: {
        ...tabState.premiumModal,
        isOpen: false,
      },
    }, tabId);
  }

  if (!currentMessageList || (
    currentMessageList.chatId !== id
    || currentMessageList.threadId !== threadId
    || currentMessageList.type !== type
  )) {
    if (id) {
      global = replaceTabThreadParam(global, id, threadId, 'replyStack', [], tabId);

      global = updateTabState(global, {
        activeReactions: {},
      }, tabId);
    }

    global = exitMessageSelectMode(global, tabId);
    global = closeLocalTextSearch(global, tabId);

    global = updateTabState(global, {
      isStatisticsShown: false,
      contentToBeScheduled: undefined,
      ...(id !== selectTabState(global, tabId).forwardMessages.toChatId && {
        forwardMessages: {},
      }),
    }, tabId);
  }

  if (id) {
    const chat = selectChat(global, id);

    if (chat?.isForum && !noForumTopicPanel) {
      actions.openForumPanel({ chatId: id!, tabId });
    } else if (id !== selectTabState(global, tabId).forumPanelChatId) {
      actions.closeForumPanel({ tabId });
    }
  }

  actions.updatePageTitle({ tabId });

  return updateCurrentMessageList(global, id, threadId, type, shouldReplaceHistory, shouldReplaceLast, tabId);
});

addActionHandler('openChatInNewTab', (global, actions, payload): ActionReturnType => {
  const { chatId, threadId = MAIN_THREAD_ID } = payload;

  const hashUrl = createMessageHashUrl(chatId, 'thread', threadId);

  if (IS_ELECTRON) {
    window.electron!.openNewWindow(hashUrl);
  } else {
    window.open(hashUrl, '_blank');
  }
});

addActionHandler('openPreviousChat', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  actions.updatePageTitle({ tabId });
  return updateCurrentMessageList(global, undefined, undefined, undefined, undefined, undefined, tabId);
});

addActionHandler('openChatWithInfo', (global, actions, payload): ActionReturnType => {
  const { profileTab, tabId = getCurrentTabId() } = payload;

  global = updateTabState(global, {
    ...selectTabState(global, tabId),
    isChatInfoShown: true,
    nextProfileTab: profileTab,
  }, tabId);
  global = { ...global, lastIsChatInfoShown: true };
  setGlobal(global);

  actions.openChat({ ...payload, tabId });
});

addActionHandler('openChatWithDraft', (global, actions, payload): ActionReturnType => {
  const {
    chatId, text, threadId, files, filter, tabId = getCurrentTabId(),
  } = payload;

  if (chatId) {
    actions.openChat({ id: chatId, threadId, tabId });
  }

  return updateTabState(global, {
    requestedDraft: {
      chatId,
      text,
      files,
      filter,
    },
  }, tabId);
});

addActionHandler('resetChatCreation', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    chatCreation: undefined,
  }, tabId);
});

addActionHandler('setNewChatMembersDialogState', (global, actions, payload): ActionReturnType => {
  const { newChatMembersProgress, tabId = getCurrentTabId() } = payload;
  return updateTabState(global, {
    newChatMembersProgress,
  }, tabId);
});

addActionHandler('openNextChat', (global, actions, payload): ActionReturnType => {
  const { targetIndexDelta, orderedIds, tabId = getCurrentTabId() } = payload;

  const { chatId } = selectCurrentMessageList(global, tabId) || {};

  if (!chatId) {
    actions.openChat({ id: orderedIds[0], tabId });
    return;
  }

  const position = orderedIds.indexOf(chatId);

  if (position === -1) {
    return;
  }
  const nextId = orderedIds[position + targetIndexDelta];

  actions.openChat({ id: nextId, shouldReplaceHistory: true, tabId });
});

addActionHandler('closeDeleteChatFolderModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    deleteFolderDialogModal: undefined,
  }, tabId);
});

addActionHandler('closeChatlistModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    chatlistModal: undefined,
  }, tabId);
});

addActionHandler('requestChatTranslation', (global, actions, payload): ActionReturnType => {
  const { chatId, toLanguageCode, tabId = getCurrentTabId() } = payload;
  return updateRequestedChatTranslation(global, chatId, toLanguageCode, tabId);
});
