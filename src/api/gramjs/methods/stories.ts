import BigInt from 'big-integer';
import { invokeRequest } from './client';
import type {
  ApiUser, ApiUserStories, ApiReportReason, ApiTypeStory,
} from '../../types';
import type { PrivacyVisibility } from '../../../types';
import { Api as GramJs } from '../../../lib/gramjs';
import { addEntitiesToLocalDb, addStoryToLocalDb } from '../helpers';
import { buildApiUser } from '../apiBuilders/users';
import { buildApiStory, buildApiUsersStories } from '../apiBuilders/messages';
import { buildApiPeerId } from '../apiBuilders/peers';
import {
  buildInputPeer,
  buildInputPeerFromLocalDb,
  buildInputPrivacyRules,
  buildInputReportReason,
} from '../gramjsBuilders';
import { STORY_LIST_LIMIT } from '../../../config';
import { buildCollectionByCallback } from '../../../util/iteratees';

export async function fetchAllStories({
  stateHash,
  isFirstRequest = false,
  isHidden = false,
}: {
  isFirstRequest?: boolean;
  stateHash?: string;
  isHidden?: boolean;
}): Promise<
  undefined
  | { state: string }
  | { users: ApiUser[]; userStories: Record<string, ApiUserStories>; hasMore?: true; state: string }> {
  const params: ConstructorParameters<typeof GramJs.stories.GetAllStories>[0] = isFirstRequest
    ? (isHidden ? { hidden: true } : {})
    : { state: stateHash, next: true, ...(isHidden && { hidden: true }) };
  const result = await invokeRequest(new GramJs.stories.GetAllStories(params));

  if (!result) {
    return undefined;
  }

  if (result instanceof GramJs.stories.AllStoriesNotModified) {
    return {
      state: result.state,
    };
  }

  addEntitiesToLocalDb(result.users);
  result.userStories.forEach((userStories) => (
    userStories.stories.forEach((story) => addStoryToLocalDb(story, buildApiPeerId(userStories.userId, 'user')))
  ));

  const allUserStories = result.userStories.reduce<Record<string, ApiUserStories>>((acc, userStories) => {
    const userId = buildApiPeerId(userStories.userId, 'user');
    const stories = buildApiUsersStories(userStories);
    const { pinnedIds, orderedIds, lastUpdatedAt } = Object.values(stories).reduce<
    {
      pinnedIds: number[];
      orderedIds: number[];
      lastUpdatedAt?: number;
    }
    >((dataAcc, story) => {
      if ('isPinned' in story && story.isPinned) {
        dataAcc.pinnedIds.push(story.id);
      }
      if (!('isDeleted' in story)) {
        dataAcc.orderedIds.push(story.id);
        dataAcc.lastUpdatedAt = Math.max(story.date, dataAcc.lastUpdatedAt || 0);
      }

      return dataAcc;
    }, {
      pinnedIds: [],
      orderedIds: [],
      lastUpdatedAt: undefined,
    });

    if (orderedIds.length === 0) {
      return acc;
    }

    acc[userId] = {
      byId: stories,
      orderedIds,
      pinnedIds,
      lastUpdatedAt,
      lastReadId: userStories.maxReadId,
    };

    return acc;
  }, {});

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    userStories: allUserStories,
    hasMore: result.hasMore,
    state: result.state,
  };
}

export async function fetchUserStories({
  user,
}: {
  user: ApiUser;
}) {
  const result = await invokeRequest(new GramJs.stories.GetUserStories({
    userId: buildInputPeer(user.id, user.accessHash),
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  result.stories.stories.forEach((story) => addStoryToLocalDb(story, user.id));

  const users = result.users.map(buildApiUser).filter(Boolean);
  const stories = buildCollectionByCallback(result.stories.stories, (story) => (
    [story.id, buildApiStory(user.id, story)]
  ));

  return {
    users,
    stories,
    lastReadStoryId: result.stories.maxReadId,
  };
}

export function fetchUserPinnedStories({
  user, offsetId,
}: {
  user: ApiUser;
  offsetId?: number;
}) {
  return fetchCommonStoriesRequest({
    method: new GramJs.stories.GetPinnedStories({
      userId: buildInputPeer(user.id, user.accessHash),
      offsetId,
      limit: STORY_LIST_LIMIT,
    }),
    userId: user.id,
  });
}

export function fetchStoriesArchive({
  currentUserId,
  offsetId,
}: {
  currentUserId: string;
  offsetId?: number;
}) {
  return fetchCommonStoriesRequest({
    method: new GramJs.stories.GetStoriesArchive({
      offsetId,
      limit: STORY_LIST_LIMIT,
    }),
    userId: currentUserId,
  });
}

export async function fetchUserStoriesByIds({ user, ids }: { user: ApiUser; ids: number[] }) {
  const result = await invokeRequest(new GramJs.stories.GetStoriesByID({
    userId: buildInputPeer(user.id, user.accessHash),
    id: ids,
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  result.stories.forEach((story) => addStoryToLocalDb(story, user.id));

  const users = result.users.map(buildApiUser).filter(Boolean);
  const stories = ids.reduce<Record<string, ApiTypeStory>>((acc, id) => {
    const story = result.stories.find(({ id: currentId }) => currentId === id);
    if (story) {
      acc[id] = buildApiStory(user.id, story);
    } else {
      acc[id] = {
        id,
        userId: user.id,
        isDeleted: true,
      };
    }

    return acc;
  }, {});

  return {
    users,
    stories,
  };
}

export function viewStory({ user, storyId }: { user: ApiUser; storyId: number }) {
  return invokeRequest(new GramJs.stories.IncrementStoryViews({
    userId: buildInputPeer(user.id, user.accessHash),
    id: [storyId],
  }));
}

export function markStoryRead({ user, storyId }: { user: ApiUser; storyId: number }) {
  return invokeRequest(new GramJs.stories.ReadStories({
    userId: buildInputPeer(user.id, user.accessHash),
    maxId: storyId,
  }));
}

export function deleteStory({ storyId }: { storyId: number }) {
  return invokeRequest(new GramJs.stories.DeleteStories({ id: [storyId] }));
}

export function toggleStoryPinned({ storyId, isPinned }: { storyId: number; isPinned?: boolean }) {
  return invokeRequest(new GramJs.stories.TogglePinned({ id: [storyId], pinned: isPinned }));
}

export async function fetchStorySeenBy({
  storyId, limit = STORY_LIST_LIMIT, offsetDate = 0, offsetId = 0,
}: {
  storyId: number;
  limit?: number;
  offsetDate?: number;
  offsetId?: number;
}) {
  const result = await invokeRequest(new GramJs.stories.GetStoryViewsList({
    id: storyId,
    limit,
    offsetDate,
    offsetId: BigInt(offsetId),
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const seenByDates = result.views.reduce<Record<string, number>>((acc, view) => {
    acc[buildApiPeerId(view.userId, 'user')] = view.date;

    return acc;
  }, {});

  return { users, seenByDates, count: result.count };
}

export async function fetchStoryLink({ userId, storyId }: { userId: string; storyId: number }) {
  const inputUser = buildInputPeerFromLocalDb(userId);
  if (!inputUser) {
    return undefined;
  }

  const result = await invokeRequest(new GramJs.stories.ExportStoryLink({
    userId: inputUser,
    id: storyId,
  }));

  if (!result) {
    return undefined;
  }

  return result.link;
}

export function reportStory({
  user,
  storyId,
  reason,
  description,
}: {
  user: ApiUser; storyId: number; reason: ApiReportReason; description?: string;
}) {
  return invokeRequest(new GramJs.stories.Report({
    userId: buildInputPeer(user.id, user.accessHash),
    id: [storyId],
    reason: buildInputReportReason(reason),
    message: description,
  }));
}

export function editStoryPrivacy({
  id, visibility, allowedUserList, deniedUserList,
}: {
  id: number;
  visibility: PrivacyVisibility;
  allowedUserList?: ApiUser[];
  deniedUserList?: ApiUser[];
}) {
  return invokeRequest(new GramJs.stories.EditStory({
    id,
    privacyRules: buildInputPrivacyRules(visibility, allowedUserList, deniedUserList),
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleStoriesHidden({
  user,
  isHidden,
}: {
  user: ApiUser;
  isHidden: boolean;
}) {
  return invokeRequest(new GramJs.contacts.ToggleStoriesHidden({
    id: buildInputPeer(user.id, user.accessHash),
    hidden: isHidden,
  }));
}

export function fetchStoriesMaxIds({
  users,
}: {
  users: ApiUser[];
}) {
  return invokeRequest(new GramJs.users.GetStoriesMaxIDs({
    id: users.map((user) => buildInputPeer(user.id, user.accessHash)),
  }));
}

async function fetchCommonStoriesRequest({ method, userId }: {
  method: GramJs.stories.GetPinnedStories | GramJs.stories.GetStoriesArchive;
  userId: string;
}) {
  const result = await invokeRequest(method);

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  result.stories.forEach((story) => addStoryToLocalDb(story, userId));

  const users = result.users.map(buildApiUser).filter(Boolean);
  const stories = buildCollectionByCallback(result.stories, (story) => (
    [story.id, buildApiStory(userId, story)]
  ));

  return {
    users,
    stories,
  };
}
