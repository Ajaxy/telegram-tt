import { addReducer, setGlobal } from '../../../lib/teact/teactn';

import { ApiUpdate } from '../../../api/types';
import { GlobalState } from '../../../global/types';
import { addNotifyException, updateChat, updateNotifySettings } from '../../reducers';

addReducer('apiUpdate', (global, actions, update: ApiUpdate): GlobalState | undefined => {
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
  }

  return undefined;
});
