import { addReducer, setGlobal } from '../../../lib/teact/teactn';
import {
  exitMessageSelectMode,
  updateCurrentMessageList,
} from '../../reducers';
import { selectCurrentMessageList, selectRightColumnContentKey } from '../../selectors';
import { HistoryWrapper } from '../../../util/history';

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
      if (id !== undefined) {
        HistoryWrapper.pushState({
          type: 'chat',
          chatId: id,
          threadId,
          messageListType: type,
        });
      } else {
        HistoryWrapper.back();
      }
    }
  }

  return updateCurrentMessageList(global, id, threadId, type);
});

addReducer('openChatWithInfo', (global, actions, payload) => {
  setGlobal({
    ...global,
    isChatInfoShown: true,
  });

  HistoryWrapper.pushState({
    type: 'right',
    contentKey: selectRightColumnContentKey(global),
  });

  actions.openChat(payload);
});

addReducer('resetChatCreation', (global) => {
  return {
    ...global,
    chatCreation: undefined,
  };
});
