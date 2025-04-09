import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAvailableEffect,
  ApiAvailableReaction,
  ApiMessageReactor,
  ApiPaidReactionPrivacyType,
  ApiPeerReaction,
  ApiReaction,
  ApiReactionCount,
  ApiReactions,
  ApiReactionWithPaid,
  ApiSavedReactionTag,
} from '../../types';

import { buildApiDocument } from './messageContent';
import { getApiChatIdFromMtpPeer } from './peers';

export function buildMessageReactions(reactions: GramJs.MessageReactions): ApiReactions {
  const {
    recentReactions, results, canSeeList, reactionsAsTags, topReactors,
  } = reactions;

  return {
    areTags: reactionsAsTags,
    canSeeList,
    results: results.map(buildReactionCount).filter(Boolean).sort(reactionCountComparator),
    recentReactions: recentReactions?.map(buildMessagePeerReaction).filter(Boolean),
    topReactors: topReactors?.map(buildApiMessageReactor).filter(Boolean),
  };
}

function reactionCountComparator(a: ApiReactionCount, b: ApiReactionCount) {
  if (a.reaction.type === 'paid') return -1;
  if (b.reaction.type === 'paid') return 1;

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

  const apiReaction = buildApiReaction(reaction, true);
  if (!apiReaction) return undefined;

  return {
    chosenOrder,
    count,
    reaction: apiReaction,
  };
}

export function buildApiMessageReactor(reactor: GramJs.MessageReactor): ApiMessageReactor {
  const {
    count, my, top, anonymous, peerId,
  } = reactor;

  return {
    peerId: peerId && getApiChatIdFromMtpPeer(peerId),
    count,
    isMy: my,
    isTop: top,
    isAnonymous: anonymous,
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

export function buildApiReaction(reaction: GramJs.TypeReaction, withPaid?: never): ApiReaction | undefined;
export function buildApiReaction(reaction: GramJs.TypeReaction, withPaid: true): ApiReactionWithPaid | undefined;
export function buildApiReaction(reaction: GramJs.TypeReaction, withPaid?: true): ApiReactionWithPaid | undefined {
  if (reaction instanceof GramJs.ReactionEmoji) {
    return {
      type: 'emoji',
      emoticon: reaction.emoticon,
    };
  }

  if (reaction instanceof GramJs.ReactionCustomEmoji) {
    return {
      type: 'custom',
      documentId: reaction.documentId.toString(),
    };
  }

  if (withPaid && reaction instanceof GramJs.ReactionPaid) {
    return {
      type: 'paid',
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
    reaction: { type: 'emoji', emoticon: reaction },
    title,
    isInactive: inactive,
    isPremium: premium,
  };
}

export function buildApiAvailableEffect(availableEffect: GramJs.AvailableEffect): ApiAvailableEffect {
  const {
    id, emoticon, premiumRequired, staticIconId, effectStickerId, effectAnimationId,
  } = availableEffect;

  return {
    id: id.toString(),
    emoticon,
    isPremium: premiumRequired,
    staticIconId: staticIconId?.toString(),
    effectStickerId: effectStickerId.toString(),
    effectAnimationId: effectAnimationId?.toString(),
  };
}

export function buildApiPaidReactionPrivacy(privacy: GramJs.TypePaidReactionPrivacy) : ApiPaidReactionPrivacyType {
  if (privacy instanceof GramJs.PaidReactionPrivacyAnonymous) {
    return { type: 'anonymous' };
  }

  if (privacy instanceof GramJs.PaidReactionPrivacyPeer) {
    return {
      type: 'peer',
      peerId: getApiChatIdFromMtpPeer(privacy.peer),
    };
  }

  return { type: 'default' };
}
