import type { ApiMessage, ApiReactions } from '../../api/types';
import type { GlobalState } from '../types';

export function getMessageRecentReaction(message: Partial<ApiMessage>) {
  return message.isOutgoing ? message.reactions?.recentReactions?.[0] : undefined;
}
export function checkIfHasUnreadReactions(global: GlobalState, reactions: ApiReactions) {
  const { currentUserId } = global;
  return reactions?.recentReactions?.some(
    ({ isUnread, userId }) => isUnread && userId !== currentUserId,
  );
}
