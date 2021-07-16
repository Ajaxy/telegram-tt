import { addReducer, setGlobal } from '../../../lib/teact/teactn';

import {
  exitMessageSelectMode, replaceThreadParam, updateCurrentMessageList,
} from '../../reducers';
import { selectCurrentMessageList } from '../../selectors';
import { closeLocalTextSearch } from './localSearch';

addReducer('openChat', (global, actions, payload) => {
  const {
    id, threadId = -1, type = 'thread',
  } = payload!;

  const currentMessageList = selectCurrentMessageList(global);

  if (!currentMessageList
    || (
      currentMessageList.chatId !== id
      || currentMessageList.threadId !== threadId
      || currentMessageList.type !== type
    )) {
    global = replaceThreadParam(global, id, threadId, 'replyStack', []);
    global = exitMessageSelectMode(global);
    global = closeLocalTextSearch(global);

    global = {
      ...global,
      messages: {
        ...global.messages,
        contentToBeScheduled: undefined,
      },
      ...(id !== global.forwardMessages.toChatId && {
        forwardMessages: {},
      }),
    };

    setGlobal(global);
  }

  return updateCurrentMessageList(global, id, threadId, type);
});

addReducer('openChatWithInfo', (global, actions, payload) => {
  setGlobal({
    ...global,
    isChatInfoShown: true,
  });

  actions.openChat(payload);
});

addReducer('resetChatCreation', (global) => {
  return {
    ...global,
    chatCreation: undefined,
  };
});

addReducer('setNewChatMembersDialogState', (global, actions, payload) => {
  return {
    ...global,
    newChatMembersProgress: payload,
  };
});

addReducer('openNextChat', (global, actions, payload) => {
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

  actions.openChat({ id: nextId });
});
