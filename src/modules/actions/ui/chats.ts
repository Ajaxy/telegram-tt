import { addReducer, setGlobal } from '../../../lib/teact/teactn';
import {
  exitMessageSelectMode,
  updateCurrentMessageList,
} from '../../reducers';
import { selectCurrentMessageList } from '../../selectors';

addReducer('openChat', (global, actions, payload) => {
  const { id, threadId, type } = payload!;

  const currentMessageList = selectCurrentMessageList(global);

  if (currentMessageList
    && (
      currentMessageList.chatId !== id
      || currentMessageList.threadId !== threadId
      || currentMessageList.type !== type
    )) {
    global = exitMessageSelectMode(global);

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
