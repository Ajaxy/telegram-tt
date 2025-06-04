import { throttleWithFullyIdle } from '../../../lib/teact/heavyAnimation';

import type { ApiUserStatus } from '../../../api/types';
import type { ActionReturnType } from '../../types';

import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  deleteContact,
  replaceUserStatuses,
  updateChat,
  updatePeerStoriesHidden,
  updateUser,
  updateUserFullInfo,
} from '../../reducers';
import {
  selectIsChatWithSelf, selectIsCurrentUserPremium, selectUser, selectUserFullInfo,
} from '../../selectors';

const updateStatusesOnFullyIdle = throttleWithFullyIdle(flushStatusUpdates);

let pendingStatusUpdates: Record<string, ApiUserStatus> = {};

function flushStatusUpdates() {
  let global = getGlobal();

  global = replaceUserStatuses(global, {
    ...global.users.statusesById,
    ...pendingStatusUpdates,
  });
  setGlobal(global);

  pendingStatusUpdates = {};
}

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'deleteContact': {
      return deleteContact(global, update.id);
    }

    case 'updateUser': {
      Object.values(global.byTabId).forEach(({ id: tabId }) => {
        if (selectIsChatWithSelf(global, update.id) && update.user.isPremium !== selectIsCurrentUserPremium(global)) {
          if (update.user.isPremium && global.byTabId[tabId].premiumModal) {
            actions.openPremiumModal({ isSuccess: true, tabId });
          }

          // Reset translation cache cause premium provides additional formatting
          global = {
            ...global,
            translations: {
              byChatId: {},
            },
          };
        }
      });

      const localUser = selectUser(global, update.id);

      global = updateUser(global, update.id, update.user);
      if (update.fullInfo) {
        global = updateUserFullInfo(global, update.id, update.fullInfo);
      }

      if (localUser?.areStoriesHidden !== update.user.areStoriesHidden) {
        global = updatePeerStoriesHidden(global, update.id, update.user.areStoriesHidden || false);
      }

      return global;
    }

    case 'updateRequestUserUpdate': {
      actions.loadFullUser({ userId: update.id });
      break;
    }

    case 'updateUserEmojiStatus': {
      global = updateUser(global, update.userId, { emojiStatus: update.emojiStatus });
      global = updateChat(global, update.userId, { emojiStatus: update.emojiStatus });
      return global;
    }

    case 'updateUserStatus': {
      // Status updates come very often so we throttle them
      pendingStatusUpdates[update.userId] = update.status;
      updateStatusesOnFullyIdle();
      return undefined;
    }

    case 'updateUserFullInfo': {
      const { id, fullInfo } = update;

      return updateUserFullInfo(global, id, fullInfo);
    }

    case 'updateBotMenuButton': {
      const { botId, button } = update;

      const targetUserFullInfo = selectUserFullInfo(global, botId);
      if (!targetUserFullInfo?.botInfo) {
        return undefined;
      }

      return updateUserFullInfo(global, botId, {
        botInfo: {
          ...targetUserFullInfo.botInfo,
          menuButton: button,
        },
      });
    }

    case 'updateBotCommands': {
      const { botId, commands } = update;
      const targetUserFullInfo = selectUserFullInfo(global, botId);
      if (!targetUserFullInfo?.botInfo) {
        return undefined;
      }

      return updateUserFullInfo(global, botId, {
        botInfo: {
          ...targetUserFullInfo.botInfo,
          commands,
        },
      });
    }

    case 'updatePeerSettings': {
      const { id, settings } = update;

      const targetUserFullInfo = selectUserFullInfo(global, id);
      if (!targetUserFullInfo?.botInfo) {
        actions.loadFullUser({ userId: id });
        return undefined;
      }

      global = updateUserFullInfo(global, id, {
        settings,
      });
      return global;
    }
  }

  return undefined;
});
