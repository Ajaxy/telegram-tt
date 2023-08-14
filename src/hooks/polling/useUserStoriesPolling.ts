import { useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { isUserBot } from '../../global/helpers';
import { selectUserStatus } from '../../global/selectors';
import { throttle } from '../../util/schedulers';

const POLLING_INTERVAL = 60 * 60 * 1000;
const USER_LAST_POLLING_TIME = new Map<string, number>();
let USER_ID_QUEUE = new Set<string>();
const LIMIT_PER_REQUEST = 100;
const REQUEST_THROTTLE = 500;

const loadFromQueue = throttle(() => {
  const queue = Array.from(USER_ID_QUEUE);
  const queueToLoad = queue.slice(0, LIMIT_PER_REQUEST);
  const otherQueue = queue.slice(LIMIT_PER_REQUEST + 1);

  getActions().loadStoriesMaxIds({
    userIds: queueToLoad,
  });

  queueToLoad.forEach((id) => USER_LAST_POLLING_TIME.set(id, Date.now()));

  USER_ID_QUEUE = new Set(otherQueue);

  // Schedule next load
  if (USER_ID_QUEUE.size) {
    loadFromQueue();
  }
}, REQUEST_THROTTLE);

export default function useUserStoriesPolling(ids?: string[]) {
  const users = useMemo(() => {
    return ids?.map((id) => getGlobal().users.byId[id]).filter(Boolean);
  }, [ids]);

  const pollableUserIds = useMemo(() => {
    const global = getGlobal();
    return users?.filter((user) => {
      const lastPollingTime = USER_LAST_POLLING_TIME.get(user.id) || 0;
      if (Date.now() - lastPollingTime < POLLING_INTERVAL) {
        return false;
      }

      const status = selectUserStatus(global, user.id);
      const isStatusAvailable = status && status.type !== 'userStatusEmpty';
      return !user.isContact && !user.isSelf && !isUserBot(user) && !user.isSupport && isStatusAvailable;
    }).map((user) => user.id);
  }, [users]);

  useEffect(() => {
    if (pollableUserIds?.length) {
      pollableUserIds.forEach((id) => USER_ID_QUEUE.add(id));
      loadFromQueue();
    }
  }, [pollableUserIds]);
}
