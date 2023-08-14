import type { ApiMessage } from './messages';
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
  recentViewerIds?: string[];
  visibility?: ApiPrivacySettings;
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
