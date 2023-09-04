import type { ApiGeoPoint, ApiMessage, ApiReaction } from './messages';
import type { ApiPrivacySettings } from '../../types';

export interface ApiStory {
  '@type'?: 'story';
  id: number;
  userId: string;
  date: number;
  expireDate: number;
  content: ApiMessage['content'];
  isPinned?: boolean;
  isEdited?: boolean;
  isForCloseFriends?: boolean;
  isForContacts?: boolean;
  isForSelectedContacts?: boolean;
  isPublic?: boolean;
  noForwards?: boolean;
  viewsCount?: number;
  reactionsCount?: number;
  recentViewerIds?: string[];
  visibility?: ApiPrivacySettings;
  sentReaction?: ApiReaction;
  mediaAreas?: ApiMediaArea[];
}

export interface ApiStorySkipped {
  '@type'?: 'storySkipped';
  id: number;
  userId: string;
  isForCloseFriends?: boolean;
  date: number;
  expireDate: number;
}

export interface ApiStoryDeleted {
  '@type'?: 'storyDeleted';
  id: number;
  userId: string;
  isDeleted: true;
}

export type ApiTypeStory = ApiStory | ApiStorySkipped | ApiStoryDeleted;

export type ApiUserStories = {
  byId: Record<number, ApiTypeStory>;
  orderedIds: number[]; // Actual user stories
  pinnedIds: number[]; // Profile Shared Media: Pinned Stories tab
  archiveIds?: number[]; // Profile Shared Media: Archive Stories tab
  lastUpdatedAt?: number;
  lastReadId?: number;
};

export type ApiMessageStoryData = {
  id: number;
  userId: string;
  isMention?: boolean;
};

export type ApiWebPageStoryData = {
  id: number;
  userId: string;
};

export type ApiStoryView = {
  userId: string;
  date: number;
  reaction?: ApiReaction;
  isUserBlocked?: true;
  areStoriesBlocked?: true;
};

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

export type ApiMediaArea = ApiMediaAreaVenue | ApiMediaAreaGeoPoint;
