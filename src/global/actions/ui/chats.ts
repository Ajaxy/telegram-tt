import type { ProfileTabType } from '../../../types';
import type { ActionReturnType, GlobalState } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { createMessageHashUrl } from '../../../util/routing';
import { addActionHandler, execAfterActions, getGlobal, setGlobal } from '../../index';
import {
  closeMiddleSearch,
  exitMessageSelectMode, replaceTabThreadParam, updateCurrentMessageList, updateRequestedChatTranslation,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat, selectCurrentMessageList, selectTabState,
} from '../../selectors';

addActionHandler('processOpenChatOrThread', (global, actions, payload): ActionReturnType => {
  const {
    chatId,
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
  actions.hideEffectInComposer({ tabId });

  actions.closeStoryViewer({ tabId });
  actions.closeStarsBalanceModal({ tabId });
  actions.closeStarsTransactionModal({ tabId });
  actions.closeGiftInfoModal({ tabId });

  if (!currentMessageList || (
    currentMessageList.chatId !== chatId
    || currentMessageList.threadId !== threadId
    || currentMessageList.type !== type
  )) {
    if (chatId) {
      global = replaceTabThreadParam(global, chatId, threadId, 'replyStack', [], tabId);

      global = updateTabState(global, {
        activeReactions: {},
        shouldPreventComposerAnimation: true,
      }, tabId);

      global = closeMiddleSearch(global, chatId, threadId, tabId);
    }

    global = exitMessageSelectMode(global, tabId);

    global = updateTabState(global, {
      isStatisticsShown: false,
      monetizationStatistics: undefined,
      boostStatistics: undefined,
      contentToBeScheduled: undefined,
      ...(chatId !== selectTabState(global, tabId).forwardMessages.toChatId && {
        forwardMessages: {},
        isShareMessageModalShown: false,
      }),
      // Reset chat info state for new chat
      chatInfo: {
        isOpen: tabState.chatInfo.isOpen,
      },
    }, tabId);
  }

  if (chatId) {
    const chat = selectChat(global, chatId);

    if (chat?.isForum && !noForumTopicPanel) {
      actions.openForumPanel({ chatId, tabId });
    } else if (chatId !== selectTabState(global, tabId).forumPanelChatId) {
      actions.closeForumPanel({ tabId });
    }
  }

  actions.updatePageTitle({ tabId });

  return updateCurrentMessageList(global, chatId, threadId, type, shouldReplaceHistory, shouldReplaceLast, tabId);
});

addActionHandler('openChatInNewTab', (global, actions, payload): ActionReturnType => {
  const { chatId, threadId = MAIN_THREAD_ID } = payload;

  const hashUrl = createMessageHashUrl(chatId, 'thread', threadId);

  window.open(hashUrl, '_blank');
});

addActionHandler('openPreviousChat', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  actions.updatePageTitle({ tabId });
  return updateCurrentMessageList(global, undefined, undefined, undefined, undefined, undefined, tabId);
});

addActionHandler('openChatWithInfo', (global, actions, payload): ActionReturnType => {
  const { profileTab, forceScrollProfileTab, isOwnProfile, tabId = getCurrentTabId(), ...rest } = payload;

  const currentMessageList = selectCurrentMessageList(global, tabId);
  const isSameMessageList = currentMessageList?.chatId === rest.id
    && currentMessageList?.threadId === MAIN_THREAD_ID
    && currentMessageList?.type === (rest.type || 'thread');

  processChatInfoState({ global, isSameMessageList, profileTab, forceScrollProfileTab, isOwnProfile, tabId });

  actions.openChat({ ...rest, tabId });
});

addActionHandler('openThreadWithInfo', (global, actions, payload): ActionReturnType => {
  const { profileTab, forceScrollProfileTab, isOwnProfile, tabId = getCurrentTabId(), ...rest } = payload;

  const currentMessageList = selectCurrentMessageList(global, tabId);
  const isSameMessageList = currentMessageList?.chatId === rest.chatId
    && currentMessageList?.threadId === rest.threadId
    && currentMessageList?.type === (rest.type || 'thread');

  processChatInfoState({ global, isSameMessageList, profileTab, forceScrollProfileTab, isOwnProfile, tabId });

  actions.openThread({ ...rest, tabId });
});

function processChatInfoState<T extends GlobalState>({
  global,
  isSameMessageList,
  profileTab,
  forceScrollProfileTab,
  isOwnProfile,
  tabId,
}: {
  global: T;
  isSameMessageList: boolean;
  profileTab?: ProfileTabType;
  forceScrollProfileTab?: boolean;
  isOwnProfile?: boolean;
  tabId: number;
}) {
  const currentChatInfo = selectTabState(global, tabId).chatInfo;

  const newProfileTab = profileTab ?? (isSameMessageList ? currentChatInfo.profileTab : undefined);
  const newForceScrollProfileTab = forceScrollProfileTab
    ?? (isSameMessageList ? currentChatInfo.forceScrollProfileTab : undefined);
  const newIsOwnProfile = isOwnProfile ?? (isSameMessageList ? currentChatInfo.isOwnProfile : undefined);

  execAfterActions(() => {
    global = getGlobal();
    global = updateTabState(global, {
      ...selectTabState(global, tabId),
      chatInfo: {
        isOpen: true,
        profileTab: newProfileTab,
        forceScrollProfileTab: newForceScrollProfileTab,
        isOwnProfile: newIsOwnProfile,
      },
    }, tabId);
    global = { ...global, lastIsChatInfoShown: true };
    setGlobal(global);
  });
}

addActionHandler('openChatWithDraft', (global, actions, payload): ActionReturnType => {
  const {
    chatId, text, threadId = MAIN_THREAD_ID, files, filter, tabId = getCurrentTabId(),
  } = payload;

  if (chatId) {
    actions.openThread({ chatId, threadId, tabId });
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

addActionHandler('closeChatInviteModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    chatInviteModal: undefined,
  }, tabId);
});
