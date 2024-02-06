import { getGlobal } from '../../../global';

import { selectChat, selectChatLastMessage } from '../../../global/selectors';
import { orderBy } from '../../../util/iteratees';

const VERIFIED_PRIORITY_BASE = 3e9;
const PINNED_PRIORITY_BASE = 3e8;

export default function sortChatIds(
  chatIds: string[],
  shouldPrioritizeVerified = false,
  priorityIds?: string[],
) {
  // Avoid calling sort on every global change
  const global = getGlobal();
  return orderBy(chatIds, (id) => {
    const chat = selectChat(global, id);
    if (!chat) {
      return 0;
    }

    let priority = 0;

    const lastMessage = selectChatLastMessage(global, id);
    if (lastMessage) {
      priority += lastMessage.date;
    }

    if (shouldPrioritizeVerified && chat.isVerified) {
      priority += VERIFIED_PRIORITY_BASE; // ~100 years in seconds
    }

    if (priorityIds && priorityIds.includes(id)) {
      priority = Date.now() + PINNED_PRIORITY_BASE + (priorityIds.length - priorityIds.indexOf(id));
    }

    return priority;
  }, 'desc');
}
