import { ApiMessage, ApiReactions } from '../../api/types';

export function getMessageRecentReaction(message: Partial<ApiMessage>) {
  return message.isOutgoing ? message.reactions?.recentReactions?.[0] : undefined;
}

export function checkIfReactionAdded(oldReactions?: ApiReactions, newReactions?: ApiReactions) {
  if (!oldReactions || !oldReactions.recentReactions) return true;
  if (!newReactions || !newReactions.recentReactions) return false;
  const oldReactionsMap = oldReactions.results.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.reaction] = reaction.count;
    return acc;
  }, {});
  return newReactions.results.some(r => !oldReactionsMap[r.reaction] || oldReactionsMap[r.reaction] < r.count);
}
