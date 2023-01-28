import { addActionHandler, setGlobal } from '../../index';

import {
  addNotifyException, updateChat, updateTopic, updateNotifySettings,
} from '../../reducers';
import type { ActionReturnType } from '../../types';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
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

      global = addNotifyException(global, chatId, { isMuted, isSilent, shouldShowPreviews });
      setGlobal(global);
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
