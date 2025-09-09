import type {
  ApiDocument,
  ApiGeoPoint,
  ApiMessage,
  ApiPhoto,
  ApiReaction,
  ApiReactionCount,
  ApiSticker,
  ApiStoryForwardInfo,
  MediaContent,
} from './messages';
import type { ApiPrivacySettings } from './settings';

export interface ApiStory {
  '@type'?: 'story';
  id: number;
  peerId: string;
  date: number;
  expireDate: number;
  content: MediaContent;
  isInProfile?: boolean;
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
  fromId?: string;
}

export interface ApiStoryViews {
  hasViewers?: true;
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
  profileIds: number[]; // Profile Shared Media: Profile Stories tab
  isFullyLoaded?: boolean;
  pinnedIds?: number[]; // Profile Shared Media: Pinned profile stories
  archiveIds?: number[]; // Profile Shared Media: Archive Stories tab
  isArchiveFullyLoaded?: boolean;
  lastUpdatedAt?: number;
  lastReadId?: number;
  idsByAlbumId?: Record<number, {
    ids: number[];
    isFullyLoaded?: boolean;
  }>; // Story IDs grouped by album ID with loading state
};

export type ApiMessageStoryData = {
  mediaType: 'storyData';
  id: number;
  peerId: string;
  isMention?: boolean;
};

export type ApiWebPageStoryData = {
  id: number;
  peerId: string;
};

export type ApiWebPageStickerData = {
  documents: ApiSticker[];
  isEmoji?: boolean;
  isWithTextColor?: boolean;
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
  radius?: number;
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

export type ApiMediaAreaUrl = {
  type: 'url';
  coordinates: ApiMediaAreaCoordinates;
  url: string;
};

export type ApiMediaAreaWeather = {
  type: 'weather';
  coordinates: ApiMediaAreaCoordinates;
  emoji: string;
  temperatureC: number;
  color: number;
};

export type ApiMediaAreaUniqueGift = {
  type: 'uniqueGift';
  coordinates: ApiMediaAreaCoordinates;
  slug: string;
};

export type ApiMediaArea = ApiMediaAreaVenue | ApiMediaAreaGeoPoint | ApiMediaAreaSuggestedReaction
  | ApiMediaAreaChannelPost | ApiMediaAreaUrl | ApiMediaAreaWeather | ApiMediaAreaUniqueGift;

export type ApiStoryAlbum = {
  albumId: number;
  title: string;
  iconPhoto?: ApiPhoto;
  iconVideo?: ApiDocument;
};
