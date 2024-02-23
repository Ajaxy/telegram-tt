import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAvailableReaction,
  ApiPeerReaction,
  ApiReaction,
  ApiReactionCount,
  ApiReactionEmoji,
  ApiReactions,
  ApiSavedReactionTag,
} from '../../types';

import { buildApiDocument } from './messageContent';
import { getApiChatIdFromMtpPeer } from './peers';

export function buildMessageReactions(reactions: GramJs.MessageReactions): ApiReactions {
  const {
    recentReactions, results, canSeeList, reactionsAsTags,
  } = reactions;

  return {
    areTags: reactionsAsTags,
    canSeeList,
    results: results.map(buildReactionCount).filter(Boolean).sort(reactionCountComparator),
    recentReactions: recentReactions?.map(buildMessagePeerReaction).filter(Boolean),
  };
}

function reactionCountComparator(a: ApiReactionCount, b: ApiReactionCount) {
  const diff = b.count - a.count;
  if (diff) return diff;
  if (a.chosenOrder !== undefined && b.chosenOrder !== undefined) {
    return a.chosenOrder - b.chosenOrder;
  }
  if (a.chosenOrder !== undefined) return 1;
  if (b.chosenOrder !== undefined) return -1;
  return 0;
}

export function buildReactionCount(reactionCount: GramJs.ReactionCount): ApiReactionCount | undefined {
  const { chosenOrder, count, reaction } = reactionCount;

  const apiReaction = buildApiReaction(reaction);
  if (!apiReaction) return undefined;

  return {
    chosenOrder,
    count,
    reaction: apiReaction,
  };
}

export function buildMessagePeerReaction(userReaction: GramJs.MessagePeerReaction): ApiPeerReaction | undefined {
  const {
    peerId, reaction, big, unread, date, my,
  } = userReaction;

  const apiReaction = buildApiReaction(reaction);
  if (!apiReaction) return undefined;

  return {
    peerId: getApiChatIdFromMtpPeer(peerId),
    reaction: apiReaction,
    addedDate: date,
    isUnread: unread,
    isBig: big,
    isOwn: my,
  };
}

export function buildApiReaction(reaction: GramJs.TypeReaction): ApiReaction | undefined {
  if (reaction instanceof GramJs.ReactionEmoji) {
    return {
      emoticon: reaction.emoticon,
    };
  }

  if (reaction instanceof GramJs.ReactionCustomEmoji) {
    return {
      documentId: reaction.documentId.toString(),
    };
  }

  return undefined;
}

export function buildApiSavedReactionTag(tag: GramJs.SavedReactionTag): ApiSavedReactionTag | undefined {
  const { reaction, title, count } = tag;
  const apiReaction = buildApiReaction(reaction);
  if (!apiReaction) return undefined;

  return {
    reaction: apiReaction,
    title,
    count,
  };
}

export function buildApiAvailableReaction(availableReaction: GramJs.AvailableReaction): ApiAvailableReaction {
  const {
    selectAnimation, staticIcon, reaction, title, appearAnimation,
    inactive, aroundAnimation, centerIcon, effectAnimation, activateAnimation,
    premium,
  } = availableReaction;

  return {
    selectAnimation: buildApiDocument(selectAnimation),
    appearAnimation: buildApiDocument(appearAnimation),
    activateAnimation: buildApiDocument(activateAnimation),
    effectAnimation: buildApiDocument(effectAnimation),
    staticIcon: buildApiDocument(staticIcon),
    aroundAnimation: aroundAnimation ? buildApiDocument(aroundAnimation) : undefined,
    centerIcon: centerIcon ? buildApiDocument(centerIcon) : undefined,
    reaction: { emoticon: reaction } as ApiReactionEmoji,
    title,
    isInactive: inactive,
    isPremium: premium,
  };
}
