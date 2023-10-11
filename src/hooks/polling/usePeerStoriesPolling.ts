import { useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';

import { isChatChannel, isUserBot, isUserId } from '../../global/helpers';
import { selectPeer, selectUserStatus } from '../../global/selectors';
import { throttle } from '../../util/schedulers';

const POLLING_INTERVAL = 60 * 60 * 1000;
const PEER_LAST_POLLING_TIME = new Map<string, number>();
let PEER_ID_QUEUE = new Set<string>();
const LIMIT_PER_REQUEST = 100;
const REQUEST_THROTTLE = 500;

const loadFromQueue = throttle(() => {
  const queue = Array.from(PEER_ID_QUEUE);
  const queueToLoad = queue.slice(0, LIMIT_PER_REQUEST);
  const otherQueue = queue.slice(LIMIT_PER_REQUEST + 1);

  getActions().loadStoriesMaxIds({
    peerIds: queueToLoad,
  });

  queueToLoad.forEach((id) => PEER_LAST_POLLING_TIME.set(id, Date.now()));

  PEER_ID_QUEUE = new Set(otherQueue);

  // Schedule next load
  if (PEER_ID_QUEUE.size) {
    loadFromQueue();
  }
}, REQUEST_THROTTLE);

export default function usePeerStoriesPolling(ids?: string[]) {
  const peers = useMemo(() => {
    const global = getGlobal();
    return ids?.map((id) => selectPeer(global, id)).filter(Boolean);
  }, [ids]);

  const pollablePeerIds = useMemo(() => {
    const global = getGlobal();
    return peers?.filter((peer) => {
      const lastPollingTime = PEER_LAST_POLLING_TIME.get(peer.id) || 0;
      if (Date.now() - lastPollingTime < POLLING_INTERVAL) {
        return false;
      }

      if (isUserId(peer.id)) {
        const user = peer as ApiUser;
        const status = selectUserStatus(global, user.id);
        const isStatusAvailable = status && status.type !== 'userStatusEmpty';
        return !user.isContact && !user.isSelf && !isUserBot(user) && !peer.isSupport && isStatusAvailable;
      } else {
        const chat = peer as ApiChat;
        return isChatChannel(chat);
      }
    }).map((user) => user.id);
  }, [peers]);

  useEffect(() => {
    if (pollablePeerIds?.length) {
      pollablePeerIds.forEach((id) => PEER_ID_QUEUE.add(id));
      loadFromQueue();
    }
  }, [pollablePeerIds]);
}
