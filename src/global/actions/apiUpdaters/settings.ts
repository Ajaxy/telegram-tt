import { addActionHandler, setGlobal } from '../../index';

import {
  addNotifyException, updateChat, updateTopic, updateNotifySettings,
} from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updateNotifySettings': {
      return updateNotifySettings(global, update.peerType, update.isSilent, update.shouldShowPreviews);
    }

    case 'updateNotifyExceptions': {
      const {
        chatId, isMuted, isSilent, shouldShowPreviews,
      } = update;
      const chat = global.chats.byId[chatId];

      if (chat) {
        global = updateChat(global, chatId, { isMuted });
      }

      setGlobal(addNotifyException(global, chatId, { isMuted, isSilent, shouldShowPreviews }));
      break;
    }

    case 'updateTopicNotifyExceptions': {
      const {
        chatId, topicId, isMuted,
      } = update;

      global = updateTopic(global, chatId, topicId, { isMuted });

      setGlobal(global);
      break;
    }
  }

  return undefined;
});
