import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { ApiUserStatus } from '../../../api/types';

import { deleteContact, replaceUserStatuses, updateUser } from '../../reducers';
import { throttle } from '../../../util/schedulers';
import { selectIsCurrentUserPremium, selectUser } from '../../selectors';
import type { ActionReturnType, RequiredGlobalState } from '../../types';

const STATUS_UPDATE_THROTTLE = 3000;

const flushStatusUpdatesThrottled = throttle(flushStatusUpdates, STATUS_UPDATE_THROTTLE, true);

let pendingStatusUpdates: Record<string, ApiUserStatus> = {};

function scheduleStatusUpdate(userId: string, statusUpdate: ApiUserStatus) {
  pendingStatusUpdates[userId] = statusUpdate;
  flushStatusUpdatesThrottled();
}

function flushStatusUpdates() {
  // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
  let global = getGlobal() as RequiredGlobalState;

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
        if (update.id === global.currentUserId && update.user.isPremium !== selectIsCurrentUserPremium(global)) {
          // TODO Do not display modal if premium is bought from another device
          if (update.user.isPremium) actions.openPremiumModal({ isSuccess: true, tabId });

          // Reset translation cache cause premium provides additional formatting
          global = {
            ...global,
            translations: {
              byChatId: {},
            },
          };
        }
      });

      return updateUser(global, update.id, update.user);
    }

    case 'updateRequestUserUpdate': {
      actions.loadFullUser({ userId: update.id });
      break;
    }

    case 'updateUserEmojiStatus': {
      return updateUser(global, update.userId, { emojiStatus: update.emojiStatus });
    }

    case 'updateUserStatus': {
      // Status updates come very often so we throttle them
      scheduleStatusUpdate(update.userId, update.status);
      return undefined;
    }

    case 'updateUserFullInfo': {
      const { id, fullInfo } = update;
      const targetUser = global.users.byId[id];
      if (!targetUser) {
        return undefined;
      }

      return updateUser(global, id, {
        fullInfo: {
          ...targetUser.fullInfo,
          ...fullInfo,
        },
      });
    }

    case 'updateBotMenuButton': {
      const { botId, button } = update;

      const targetUser = selectUser(global, botId);
      if (!targetUser?.fullInfo?.botInfo) {
        return undefined;
      }

      return updateUser(global, botId, {
        fullInfo: {
          ...targetUser.fullInfo,
          botInfo: {
            ...targetUser.fullInfo.botInfo,
            menuButton: button,
          },
        },
      });
    }
  }

  return undefined;
});
