import type {
  ApiAvailableReaction,
  ApiChatReactions,
  ApiMessage,
  ApiReaction,
  ApiReactionCount,
  ApiReactions,
} from '../../api/types';
import type { GlobalState } from '../types';

export function getMessageRecentReaction(message: Partial<ApiMessage>) {
  return message.isOutgoing ? message.reactions?.recentReactions?.[0] : undefined;
}
export function checkIfHasUnreadReactions(global: GlobalState, reactions: ApiReactions) {
  const { currentUserId } = global;
  return reactions?.recentReactions?.some(
    ({ isUnread, isOwn, peerId }) => isUnread && !isOwn && currentUserId !== peerId,
  );
}

export function areReactionsEmpty(reactions: ApiReactions) {
  return !reactions.results.some(({ count }) => count > 0);
}

export function isSameReaction(first?: ApiReaction, second?: ApiReaction) {
  if (!first || !second) {
    return false;
  }

  if ('emoticon' in first && 'emoticon' in second) {
    return first.emoticon === second.emoticon;
  }

  if ('documentId' in first && 'documentId' in second) {
    return first.documentId === second.documentId;
  }

  return false;
}

export function canSendReaction(reaction: ApiReaction, chatReactions: ApiChatReactions) {
  if (chatReactions.type === 'all') {
    return 'emoticon' in reaction || chatReactions.areCustomAllowed;
  }

  if (chatReactions.type === 'some') {
    return chatReactions.allowed.some((r) => isSameReaction(r, reaction));
  }

  return false;
}

export function sortReactions<T extends ApiAvailableReaction | ApiReaction>(
  reactions: T[],
  topReactions?: ApiReaction[],
): T[] {
  return reactions.slice().sort((left, right) => {
    const reactionOne = left ? ('reaction' in left ? left.reaction : left) as ApiReaction : undefined;
    const reactionTwo = right ? ('reaction' in right ? right.reaction : right) as ApiReaction : undefined;
    const indexOne = topReactions?.findIndex((reaction) => isSameReaction(reaction, reactionOne)) || 0;
    const indexTwo = topReactions?.findIndex((reaction) => isSameReaction(reaction, reactionTwo)) || 0;
    return (
      (indexOne > -1 ? indexOne : Infinity) - (indexTwo > -1 ? indexTwo : Infinity)
    );
  });
}

export function getUserReactions(message: ApiMessage): ApiReaction[] {
  return message.reactions?.results?.filter((r): r is Required<ApiReactionCount> => isReactionChosen(r))
    .sort((a, b) => a.chosenOrder - b.chosenOrder)
    .map((r) => r.reaction) || [];
}

export function getReactionUniqueKey(reaction: ApiReaction) {
  if ('emoticon' in reaction) {
    return reaction.emoticon;
  }

  return reaction.documentId;
}

export function isReactionChosen(reaction: ApiReactionCount) {
  return reaction.chosenOrder !== undefined;
}

export function updateReactionCount(reactionCount: ApiReactionCount[], newReactions: ApiReaction[]) {
  const results = reactionCount.map((current) => (
    isReactionChosen(current) ? {
      ...current,
      chosenOrder: undefined,
      count: current.count - 1,
    } : current
  )).filter(({ count }) => count > 0);

  newReactions.forEach((reaction, i) => {
    const existingIndex = results.findIndex((r) => isSameReaction(r.reaction, reaction));
    if (existingIndex > -1) {
      results[existingIndex] = {
        ...results[existingIndex],
        chosenOrder: i,
        count: results[existingIndex].count + 1,
      };
    } else {
      results.push({
        reaction,
        chosenOrder: i,
        count: 1,
      });
    }
  });

  return results;
}
