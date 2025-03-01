import type {
  ApiAvailableReaction,
  ApiChatReactions,
  ApiMessage,
  ApiReactionCount,
  ApiReactionKey,
  ApiReactions,
  ApiReactionWithPaid,
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
  return !reactions.results.some(({ count, localAmount }) => count || localAmount);
}

export function getReactionKey(reaction: ApiReactionWithPaid): ApiReactionKey {
  switch (reaction.type) {
    case 'emoji':
      return `emoji-${reaction.emoticon}`;
    case 'custom':
      return `document-${reaction.documentId}`;
    case 'paid':
      return 'paid';
    default: {
      // Legacy reactions
      const uniqueValue = (reaction as any).emoticon || (reaction as any).documentId;
      return `unsupported-${uniqueValue}`;
    }
  }
}

export function isSameReaction(first?: ApiReactionWithPaid, second?: ApiReactionWithPaid) {
  if (first === second) {
    return true;
  }

  if (!first || !second) {
    return false;
  }

  return getReactionKey(first) === getReactionKey(second);
}

export function canSendReaction(reaction: ApiReactionWithPaid, chatReactions: ApiChatReactions) {
  if (chatReactions.type === 'all') {
    return reaction.type === 'emoji' || chatReactions.areCustomAllowed;
  }

  if (chatReactions.type === 'some') {
    return chatReactions.allowed.some((r) => isSameReaction(r, reaction));
  }

  return false;
}

export function sortReactions<T extends ApiAvailableReaction | ApiReactionWithPaid>(
  reactions: T[],
  topReactions?: ApiReactionWithPaid[],
): T[] {
  return reactions.slice().sort((left, right) => {
    const reactionOne = left ? ('reaction' in left ? left.reaction : left) as ApiReactionWithPaid : undefined;
    const reactionTwo = right ? ('reaction' in right ? right.reaction : right) as ApiReactionWithPaid : undefined;

    if (reactionOne?.type === 'paid') return -1;
    if (reactionTwo?.type === 'paid') return 1;

    const indexOne = topReactions?.findIndex((reaction) => isSameReaction(reaction, reactionOne)) || 0;
    const indexTwo = topReactions?.findIndex((reaction) => isSameReaction(reaction, reactionTwo)) || 0;
    return (
      (indexOne > -1 ? indexOne : Infinity) - (indexTwo > -1 ? indexTwo : Infinity)
    );
  });
}

export function getUserReactions(message: ApiMessage): ApiReactionWithPaid[] {
  return message.reactions?.results?.filter((r): r is Required<ApiReactionCount> => isReactionChosen(r))
    .sort((a, b) => a.chosenOrder - b.chosenOrder)
    .map((r) => r.reaction) || [];
}

export function isReactionChosen(reaction: ApiReactionCount) {
  return reaction.chosenOrder !== undefined;
}

export function updateReactionCount(reactionCount: ApiReactionCount[], newReactions: ApiReactionWithPaid[]) {
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

export function addPaidReaction(
  reactionCount: ApiReactionCount[], count: number, isAnonymous?: boolean, peerId?: string,
): ApiReactionCount[] {
  const results: ApiReactionCount[] = [];
  const hasPaid = reactionCount.some((current) => current.reaction.type === 'paid');
  if (hasPaid) {
    reactionCount.forEach((current) => {
      if (current.reaction.type === 'paid') {
        results.push({
          ...current,
          localAmount: (current.localAmount || 0) + count,
          chosenOrder: -1,
          localIsPrivate: isAnonymous !== undefined ? isAnonymous : current.localIsPrivate,
          localPeerId: peerId || current.localPeerId,
          localPreviousChosenOrder: current.chosenOrder,
        });
        return;
      }

      results.push(current);
    });

    return results;
  }

  return [
    {
      reaction: { type: 'paid' },
      count: 0,
      chosenOrder: -1,
      localAmount: count,
      localIsPrivate: isAnonymous,
      localPeerId: peerId,
    },
    ...reactionCount,
  ];
}
