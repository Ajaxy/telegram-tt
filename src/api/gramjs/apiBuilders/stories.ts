import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiMediaArea,
  ApiMediaAreaCoordinates,
  ApiStealthMode,
  ApiStory,
  ApiStoryForwardInfo,
  ApiStoryView,
  ApiStoryViews,
  ApiTypeStory,
  ApiTypeStoryView,
  MediaContent,
} from '../../types';

import { buildCollectionByCallback, omitUndefined } from '../../../util/iteratees';
import { buildPrivacyRules } from './common';
import { buildGeoPoint, buildMessageMediaContent, buildMessageTextContent } from './messageContent';
import { buildApiMessage } from './messages';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildApiReaction, buildReactionCount } from './reactions';

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
    mediaAreas, sentReaction, out, fwdFrom, fromId,
  } = story;

  const content: MediaContent = {
    ...buildMessageMediaContent(media),
  };

  if (caption) {
    content.text = buildMessageTextContent(caption, entities);
  }

  return omitUndefined<ApiStory>({
    id,
    peerId,
    date,
    expireDate,
    content,
    isPublic,
    isEdited: edited,
    isPinned: pinned,
    isForContacts: contacts,
    isForSelectedContacts: selectedContacts,
    isForCloseFriends: closeFriends,
    noForwards: noforwards,
    views: views && buildApiStoryViews(views),
    isOut: out,
    visibility: privacy && buildPrivacyRules(privacy),
    mediaAreas: mediaAreas?.map(buildApiMediaArea).filter(Boolean),
    sentReaction: sentReaction && buildApiReaction(sentReaction),
    forwardInfo: fwdFrom && buildApiStoryForwardInfo(fwdFrom),
    fromId: fromId && getApiChatIdFromMtpPeer(fromId),
  });
}

export function buildApiStoryViews(views: GramJs.TypeStoryViews): ApiStoryViews {
  return omitUndefined<ApiStoryViews>({
    hasViewers: views.hasViewers,
    viewsCount: views.viewsCount,
    forwardsCount: views.forwardsCount,
    reactionsCount: views.reactionsCount,
    reactions: views.reactions?.map(buildReactionCount).filter(Boolean),
    recentViewerIds: views.recentViewers?.map((viewerId) => buildApiPeerId(viewerId, 'user')),
  });
}

export function buildApiStoryView(view: GramJs.TypeStoryView): ApiTypeStoryView | undefined {
  const {
    blockedMyStoriesFrom, blocked,
  } = view;

  if (view instanceof GramJs.StoryView) {
    return omitUndefined<ApiStoryView>({
      type: 'user',
      peerId: buildApiPeerId(view.userId, 'user'),
      date: view.date,
      reaction: view.reaction && buildApiReaction(view.reaction),
      areStoriesBlocked: blocked || blockedMyStoriesFrom,
      isUserBlocked: blocked,
    });
  }

  if (view instanceof GramJs.StoryViewPublicForward) {
    const message = buildApiMessage(view.message);
    if (!message) return undefined;
    return {
      type: 'forward',
      peerId: message.chatId,
      messageId: message.id,
      message,
      date: message.date,
      areStoriesBlocked: blocked || blockedMyStoriesFrom,
      isUserBlocked: blocked,
    };
  }

  if (view instanceof GramJs.StoryViewPublicRepost) {
    const peerId = getApiChatIdFromMtpPeer(view.peerId);
    const story = buildApiStory(peerId, view.story);
    if (!('content' in story)) return undefined;

    return {
      type: 'repost',
      peerId,
      storyId: view.story.id,
      date: story.date,
      story,
      areStoriesBlocked: blocked || blockedMyStoriesFrom,
      isUserBlocked: blocked,
    };
  }

  return undefined;
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

  if (area instanceof GramJs.MediaAreaChannelPost) {
    const { coordinates, channelId, msgId } = area;

    return {
      type: 'channelPost',
      coordinates: buildApiMediaAreaCoordinates(coordinates),
      channelId: buildApiPeerId(channelId, 'channel'),
      messageId: msgId,
    };
  }

  return undefined;
}

export function buildApiPeerStories(peerStories: GramJs.PeerStories) {
  const peerId = getApiChatIdFromMtpPeer(peerStories.peer);

  return buildCollectionByCallback(peerStories.stories, (story) => [story.id, buildApiStory(peerId, story)]);
}

export function buildApiStoryForwardInfo(forwardHeader: GramJs.TypeStoryFwdHeader): ApiStoryForwardInfo {
  const {
    from, fromName, storyId, modified,
  } = forwardHeader;

  return {
    storyId,
    fromPeerId: from && getApiChatIdFromMtpPeer(from),
    fromName,
    isModified: modified,
  };
}
