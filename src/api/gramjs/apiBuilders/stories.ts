import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiMediaArea, ApiMediaAreaCoordinates, ApiMessage, ApiStealthMode, ApiStoryView, ApiTypeStory,
} from '../../types';

import { buildCollectionByCallback } from '../../../util/iteratees';
import { buildPrivacyRules } from './common';
import { buildGeoPoint, buildMessageMediaContent, buildMessageTextContent } from './messageContent';
import { buildApiPeerId } from './peers';
import { buildApiReaction } from './reactions';

export function buildApiStory(userId: string, story: GramJs.TypeStoryItem): ApiTypeStory {
  if (story instanceof GramJs.StoryItemDeleted) {
    return {
      id: story.id,
      userId,
      isDeleted: true,
    };
  }

  if (story instanceof GramJs.StoryItemSkipped) {
    const {
      id, date, expireDate, closeFriends,
    } = story;

    return {
      id,
      userId,
      ...(closeFriends && { isForCloseFriends: true }),
      date,
      expireDate,
    };
  }

  const {
    edited, pinned, expireDate, id, date, caption,
    entities, media, privacy, views,
    public: isPublic, noforwards, closeFriends, contacts, selectedContacts,
    mediaAreas, sentReaction,
  } = story;

  const content: ApiMessage['content'] = {
    ...buildMessageMediaContent(media),
  };

  if (caption) {
    content.text = buildMessageTextContent(caption, entities);
  }

  return {
    id,
    userId,
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
    ...(views?.recentViewers && {
      recentViewerIds: views.recentViewers.map((viewerId) => buildApiPeerId(viewerId, 'user')),
    }),
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

  return undefined;
}

export function buildApiUsersStories(userStories: GramJs.UserStories) {
  const userId = buildApiPeerId(userStories.userId, 'user');

  return buildCollectionByCallback(userStories.stories, (story) => [story.id, buildApiStory(userId, story)]);
}
