import type {
  ApiChatReactions,
  ApiMessage,
  ApiReaction,
  ApiReactions,
  ApiReactionCount,
} from '../../api/types';
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

export function areReactionsEmpty(reactions: ApiReactions) {
  return !reactions.results.some((l) => l.count > 0);
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
