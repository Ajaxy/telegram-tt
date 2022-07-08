import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { ApiUserStatus } from '../../../api/types';

import { deleteContact, replaceUserStatuses, updateUser } from '../../reducers';
import { throttle } from '../../../util/schedulers';
import { selectIsCurrentUserPremium, selectUser } from '../../selectors';

const STATUS_UPDATE_THROTTLE = 3000;

const flushStatusUpdatesThrottled = throttle(flushStatusUpdates, STATUS_UPDATE_THROTTLE, true);

let pendingStatusUpdates: Record<string, ApiUserStatus> = {};

function scheduleStatusUpdate(userId: string, statusUpdate: ApiUserStatus) {
  pendingStatusUpdates[userId] = statusUpdate;
  flushStatusUpdatesThrottled();
}

function flushStatusUpdates() {
  const global = getGlobal();

  setGlobal(replaceUserStatuses(global, {
    ...global.users.statusesById,
    ...pendingStatusUpdates,
  }));

  pendingStatusUpdates = {};
}

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'deleteContact': {
      return deleteContact(global, update.id);
    }

    case 'updateUser': {
      if (update.id === global.currentUserId && update.user.isPremium && !selectIsCurrentUserPremium(global)) {
        actions.openPremiumModal({ isSuccess: true });
      }
      return updateUser(global, update.id, update.user);
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
