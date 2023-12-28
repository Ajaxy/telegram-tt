import type { ApiPrivacySettings } from '../../types';
import type {
  ApiGeoPoint, ApiMessage, ApiReaction, ApiReactionCount, ApiStoryForwardInfo, MediaContent,
} from './messages';

export interface ApiStory {
  '@type'?: 'story';
  id: number;
  peerId: string;
  date: number;
  expireDate: number;
  content: MediaContent;
  isPinned?: boolean;
  isEdited?: boolean;
  isForCloseFriends?: boolean;
  isForContacts?: boolean;
  isForSelectedContacts?: boolean;
  isPublic?: boolean;
  isOut?: true;
  noForwards?: boolean;
  views?: ApiStoryViews;
  visibility?: ApiPrivacySettings;
  sentReaction?: ApiReaction;
  mediaAreas?: ApiMediaArea[];
  forwardInfo?: ApiStoryForwardInfo;
}

export interface ApiStoryViews {
  viewsCount?: number;
  forwardsCount?: number;
  reactionsCount?: number;
  reactions?: ApiReactionCount[];
  recentViewerIds?: string[];
}

export interface ApiStorySkipped {
  '@type'?: 'storySkipped';
  id: number;
  peerId: string;
  isForCloseFriends?: boolean;
  date: number;
  expireDate: number;
}

export interface ApiStoryDeleted {
  '@type'?: 'storyDeleted';
  id: number;
  peerId: string;
  isDeleted: true;
}

export type ApiTypeStory = ApiStory | ApiStorySkipped | ApiStoryDeleted;

export type ApiPeerStories = {
  byId: Record<number, ApiTypeStory>;
  orderedIds: number[]; // Actual peer stories
  pinnedIds: number[]; // Profile Shared Media: Pinned Stories tab
  archiveIds?: number[]; // Profile Shared Media: Archive Stories tab
  lastUpdatedAt?: number;
  lastReadId?: number;
};

export type ApiMessageStoryData = {
  id: number;
  peerId: string;
  isMention?: boolean;
};

export type ApiWebPageStoryData = {
  id: number;
  peerId: string;
};

export type ApiStoryViewPublicForward = {
  type: 'forward';
  peerId: string;
  messageId: number;
  message: ApiMessage;
  date: number;
  isUserBlocked?: true;
  areStoriesBlocked?: true;
};

export type ApiStoryViewPublicRepost = {
  type: 'repost';
  isUserBlocked?: true;
  areStoriesBlocked?: true;
  date: number;
  peerId: string;
  storyId: number;
  story: ApiStory;
};

export type ApiStoryView = {
  type: 'user';
  peerId: string;
  date: number;
  reaction?: ApiReaction;
  isUserBlocked?: true;
  areStoriesBlocked?: true;
};

export type ApiTypeStoryView = ApiStoryView | ApiStoryViewPublicForward | ApiStoryViewPublicRepost;

export type ApiStealthMode = {
  activeUntil?: number;
  cooldownUntil?: number;
};

export type ApiMediaAreaCoordinates = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type ApiMediaAreaVenue = {
  type: 'venue';
  coordinates: ApiMediaAreaCoordinates;
  geo: ApiGeoPoint;
  title: string;
};

export type ApiMediaAreaGeoPoint = {
  type: 'geoPoint';
  coordinates: ApiMediaAreaCoordinates;
  geo: ApiGeoPoint;
};

export type ApiMediaAreaSuggestedReaction = {
  type: 'suggestedReaction';
  coordinates: ApiMediaAreaCoordinates;
  reaction: ApiReaction;
  isDark?: boolean;
  isFlipped?: boolean;
};

export type ApiMediaAreaChannelPost = {
  type: 'channelPost';
  coordinates: ApiMediaAreaCoordinates;
  channelId: string;
  messageId: number;
};

export type ApiMediaArea = ApiMediaAreaVenue | ApiMediaAreaGeoPoint | ApiMediaAreaSuggestedReaction
| ApiMediaAreaChannelPost;
