import { Api as GramJs, errors } from '../../../lib/gramjs';

import type {
  ApiApplyBoostInfo,
  ApiBoostsStatus,
  ApiMediaArea, ApiMediaAreaCoordinates, ApiMessage, ApiStealthMode, ApiStoryView, ApiTypeStory,
} from '../../types';

import { buildCollectionByCallback } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { buildPrivacyRules } from './common';
import { buildGeoPoint, buildMessageMediaContent, buildMessageTextContent } from './messageContent';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildApiReaction, buildReactionCount } from './reactions';
import { buildStatisticsPercentage } from './statistics';

export function buildApiStory(peerId: string, story: GramJs.TypeStoryItem): ApiTypeStory {
  if (story instanceof GramJs.StoryItemDeleted) {
    return {
      id: story.id,
      peerId,
      isDeleted: true,
    };
  }

  if (story instanceof GramJs.StoryItemSkipped) {
    const {
      id, date, expireDate, closeFriends,
    } = story;

    return {
      id,
      peerId,
      ...(closeFriends && { isForCloseFriends: true }),
      date,
      expireDate,
    };
  }

  const {
    edited, pinned, expireDate, id, date, caption,
    entities, media, privacy, views,
    public: isPublic, noforwards, closeFriends, contacts, selectedContacts,
    mediaAreas, sentReaction, out,
  } = story;

  const content: ApiMessage['content'] = {
    ...buildMessageMediaContent(media),
  };

  if (caption) {
    content.text = buildMessageTextContent(caption, entities);
  }

  return {
    id,
    peerId,
    date,
    expireDate,
    content,
    ...(isPublic && { isPublic }),
    ...(edited && { isEdited: true }),
    ...(pinned && { isPinned: true }),
    ...(contacts && { isForContacts: true }),
    ...(selectedContacts && { isForSelectedContacts: true }),
    ...(closeFriends && { isForCloseFriends: true }),
    ...(noforwards && { noForwards: true }),
    ...(views?.viewsCount && { viewsCount: views.viewsCount }),
    ...(views?.reactionsCount && { reactionsCount: views.reactionsCount }),
    ...(views?.reactions && { reactions: views.reactions.map(buildReactionCount) }),
    ...(views?.recentViewers && {
      recentViewerIds: views.recentViewers.map((viewerId) => buildApiPeerId(viewerId, 'user')),
    }),
    ...(out && { isOut: true }),
    ...(privacy && { visibility: buildPrivacyRules(privacy) }),
    ...(mediaAreas && { mediaAreas: mediaAreas.map(buildApiMediaArea).filter(Boolean) }),
    ...(sentReaction && { sentReaction: buildApiReaction(sentReaction) }),
  };
}

export function buildApiStoryView(view: GramJs.TypeStoryView): ApiStoryView {
  const {
    userId, date, reaction, blockedMyStoriesFrom, blocked,
  } = view;
  return {
    userId: userId.toString(),
    date,
    ...(reaction && { reaction: buildApiReaction(reaction) }),
    areStoriesBlocked: blocked || blockedMyStoriesFrom,
    isUserBlocked: blocked,
  };
}

export function buildApiStealthMode(stealthMode: GramJs.TypeStoriesStealthMode): ApiStealthMode {
  return {
    activeUntil: stealthMode.activeUntilDate,
    cooldownUntil: stealthMode.cooldownUntilDate,
  };
}

function buildApiMediaAreaCoordinates(coordinates: GramJs.TypeMediaAreaCoordinates): ApiMediaAreaCoordinates {
  const {
    x, y, w, h, rotation,
  } = coordinates;

  return {
    x,
    y,
    width: w,
    height: h,
    rotation,
  };
}

export function buildApiMediaArea(area: GramJs.TypeMediaArea): ApiMediaArea | undefined {
  if (area instanceof GramJs.MediaAreaVenue) {
    const { geo, title, coordinates } = area;
    const point = buildGeoPoint(geo);

    if (!point) return undefined;

    return {
      type: 'venue',
      coordinates: buildApiMediaAreaCoordinates(coordinates),
      geo: point,
      title,
    };
  }

  if (area instanceof GramJs.MediaAreaGeoPoint) {
    const { geo, coordinates } = area;
    const point = buildGeoPoint(geo);

    if (!point) return undefined;

    return {
      type: 'geoPoint',
      coordinates: buildApiMediaAreaCoordinates(coordinates),
      geo: point,
    };
  }

  if (area instanceof GramJs.MediaAreaSuggestedReaction) {
    const {
      coordinates, reaction, dark, flipped,
    } = area;

    const apiReaction = buildApiReaction(reaction);
    if (!apiReaction) return undefined;

    return {
      type: 'suggestedReaction',
      coordinates: buildApiMediaAreaCoordinates(coordinates),
      reaction: apiReaction,
      ...(dark && { isDark: true }),
      ...(flipped && { isFlipped: true }),
    };
  }

  return undefined;
}

export function buildApiPeerStories(peerStories: GramJs.PeerStories) {
  const peerId = getApiChatIdFromMtpPeer(peerStories.peer);

  return buildCollectionByCallback(peerStories.stories, (story) => [story.id, buildApiStory(peerId, story)]);
}

export function buildApiApplyBoostInfo(
  applyBoostInfo: GramJs.stories.TypeCanApplyBoostResult,
): ApiApplyBoostInfo | undefined {
  if (applyBoostInfo instanceof GramJs.stories.CanApplyBoostOk) {
    return { type: 'ok' };
  }

  if (applyBoostInfo instanceof GramJs.stories.CanApplyBoostReplace) {
    return {
      type: 'replace',
      boostedChatId: getApiChatIdFromMtpPeer(applyBoostInfo.currentBoost),
    };
  }

  return undefined;
}

export function buildApiApplyBoostInfoFromError(
  error: unknown,
): ApiApplyBoostInfo | undefined {
  if (error instanceof errors.FloodWaitError) {
    return {
      type: 'wait',
      waitUntil: getServerTime() + error.seconds,
    };
  }

  if (error instanceof Error) {
    if (error.message === 'BOOST_NOT_MODIFIED') {
      return {
        type: 'already',
      };
    }
  }

  return undefined;
}

export function buildApiBoostsStatus(boostStatus: GramJs.stories.BoostsStatus): ApiBoostsStatus {
  const {
    level, boostUrl, boosts, myBoost, currentLevelBoosts, nextLevelBoosts, premiumAudience,
  } = boostStatus;
  return {
    level,
    currentLevelBoosts,
    boosts,
    hasMyBoost: Boolean(myBoost),
    boostUrl,
    nextLevelBoosts,
    ...(premiumAudience && { premiumAudience: buildStatisticsPercentage(premiumAudience) }),
  };
}
