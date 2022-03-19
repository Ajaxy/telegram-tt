import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { ApiUpdate, ApiUserStatus } from '../../../api/types';

import { deleteContact, replaceUserStatuses, updateUser } from '../../reducers';
import { throttle } from '../../../util/schedulers';

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

addActionHandler('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'deleteContact': {
      return deleteContact(global, update.id);
    }

    case 'updateUser': {
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
  }

  return undefined;
});
