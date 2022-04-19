import { addActionHandler, setGlobal } from '../../index';

import { MAIN_THREAD_ID } from '../../../api/types';

import {
  exitMessageSelectMode, replaceThreadParam, updateCurrentMessageList,
} from '../../reducers';
import { selectCurrentMessageList } from '../../selectors';
import { closeLocalTextSearch } from './localSearch';

addActionHandler('openChat', (global, actions, payload) => {
  const {
    id,
    threadId = MAIN_THREAD_ID,
    type = 'thread',
    shouldReplaceHistory = false,
  } = payload;

  const currentMessageList = selectCurrentMessageList(global);

  if (!currentMessageList
    || (
      currentMessageList.chatId !== id
      || currentMessageList.threadId !== threadId
      || currentMessageList.type !== type
    )) {
    if (id) {
      global = replaceThreadParam(global, id, threadId, 'replyStack', []);
    }

    global = exitMessageSelectMode(global);
    global = closeLocalTextSearch(global);

    global = {
      ...global,
      isStatisticsShown: false,
      messages: {
        ...global.messages,
        contentToBeScheduled: undefined,
      },
      ...(id !== global.forwardMessages.toChatId && {
        forwardMessages: {},
      }),
    };
  }

  return updateCurrentMessageList(global, id, threadId, type, shouldReplaceHistory);
});

addActionHandler('openPreviousChat', (global) => {
  return updateCurrentMessageList(global, undefined);
});

addActionHandler('openChatWithInfo', (global, actions, payload) => {
  setGlobal({
    ...global,
    isChatInfoShown: true,
  });

  actions.openChat(payload);
});

addActionHandler('resetChatCreation', (global) => {
  return {
    ...global,
    chatCreation: undefined,
  };
});

addActionHandler('setNewChatMembersDialogState', (global, actions, payload) => {
  return {
    ...global,
    newChatMembersProgress: payload,
  };
});

addActionHandler('openNextChat', (global, actions, payload) => {
  const { targetIndexDelta, orderedIds } = payload;

  const { chatId } = selectCurrentMessageList(global) || {};

  if (!chatId) {
    actions.openChat({ id: orderedIds[0] });
    return;
  }

  const position = orderedIds.indexOf(chatId);

  if (position === -1) {
    return;
  }
  const nextId = orderedIds[position + targetIndexDelta];

  actions.openChat({ id: nextId, shouldReplaceHistory: true });
});
