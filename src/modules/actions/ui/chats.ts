import { addReducer, getDispatch, setGlobal } from '../../../lib/teact/teactn';
import {
  exitMessageSelectMode,
  updateCurrentMessageList,
} from '../../reducers';
import { selectCurrentMessageList } from '../../selectors';

window.addEventListener('popstate', (e) => {
  if (!e.state) {
    return;
  }

  const { chatId: id, threadId, messageListType: type } = e.state;

  getDispatch().openChat({
    id, threadId, type, noPushState: true,
  });
});

addReducer('openChat', (global, actions, payload) => {
  const {
    id, threadId = -1, type = 'thread', noPushState,
  } = payload!;

  const currentMessageList = selectCurrentMessageList(global);

  if (!currentMessageList
    || (
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

    if (!noPushState) {
      window.history.pushState({ chatId: id, threadId, messageListType: type }, '');
    }
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
