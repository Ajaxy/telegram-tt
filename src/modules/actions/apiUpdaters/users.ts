import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { ApiUpdate, ApiUserStatus } from '../../../api/types';

import { deleteUser, updateUser } from '../../reducers';
import { throttle } from '../../../lib/lovely-chart/utils';

const STATUS_UPDATE_THROTTLE = 3000;

const flushStatusUpdatesThrottled = throttle(flushStatusUpdates, STATUS_UPDATE_THROTTLE, true);

let pendingStatusUpdates: [number, ApiUserStatus][] = [];

function scheduleStatusUpdate(userId: number, statusUpdate: ApiUserStatus) {
  pendingStatusUpdates.push([userId, statusUpdate]);
  flushStatusUpdatesThrottled();
}

function flushStatusUpdates() {
  let global = getGlobal();
  pendingStatusUpdates.forEach(([userId, statusUpdate]) => {
    global = updateUser(global, userId, {
      status: statusUpdate,
    });
  });
  setGlobal(global);

  pendingStatusUpdates = [];
}

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'deleteUser': {
      return deleteUser(global, update.id);
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
