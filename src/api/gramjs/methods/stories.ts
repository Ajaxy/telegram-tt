import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiInputPrivacyRules } from '../../../types';
import type {
  ApiChat,
  ApiPeer,
  ApiPeerStories,
  ApiReaction,
  ApiReportReason,
  ApiStealthMode,
  ApiTypeStory,
  ApiUser,
} from '../../types';

import { STORY_LIST_LIMIT } from '../../../config';
import { buildCollectionByCallback } from '../../../util/iteratees';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import {
  buildApiPeerStories,
  buildApiStealthMode,
  buildApiStory,
  buildApiStoryView,
  buildApiStoryViews,
} from '../apiBuilders/stories';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildInputPeer,
  buildInputPrivacyRules,
  buildInputReaction,
  buildInputReportReason,
} from '../gramjsBuilders';
import { addEntitiesToLocalDb, addStoryToLocalDb } from '../helpers';
import { invokeRequest } from './client';

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
  | { state: string; stealthMode: ApiStealthMode }
  | {
    users: ApiUser[];
    chats: ApiChat[];
    peerStories: Record<string, ApiPeerStories>;
    hasMore?: true;
    state: string;
    stealthMode: ApiStealthMode;
  }> {
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
      stealthMode: buildApiStealthMode(result.stealthMode),
    };
  }

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);
  result.peerStories.forEach((peerStories) => (
    peerStories.stories.forEach((story) => addStoryToLocalDb(story, getApiChatIdFromMtpPeer(peerStories.peer)))
  ));

  const allUserStories = result.peerStories.reduce<Record<string, ApiPeerStories>>((acc, peerStories) => {
    const peerId = getApiChatIdFromMtpPeer(peerStories.peer);
    const stories = buildApiPeerStories(peerStories);
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

    acc[peerId] = {
      byId: stories,
      orderedIds,
      pinnedIds,
      lastUpdatedAt,
      lastReadId: peerStories.maxReadId,
    };

    return acc;
  }, {});

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
    peerStories: allUserStories,
    hasMore: result.hasMore,
    state: result.state,
    stealthMode: buildApiStealthMode(result.stealthMode),
  };
}

export async function fetchPeerStories({
  peer,
}: {
  peer: ApiPeer;
}) {
  const result = await invokeRequest(new GramJs.stories.GetPeerStories({
    peer: buildInputPeer(peer.id, peer.accessHash),
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  result.stories.stories.forEach((story) => addStoryToLocalDb(story, peer.id));

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const stories = buildCollectionByCallback(result.stories.stories, (story) => (
    [story.id, buildApiStory(peer.id, story)]
  ));

  return {
    chats,
    users,
    stories,
    lastReadStoryId: result.stories.maxReadId,
  };
}

export function fetchPeerPinnedStories({
  peer, offsetId,
}: {
  peer: ApiPeer;
  offsetId?: number;
}) {
  return fetchCommonStoriesRequest({
    method: new GramJs.stories.GetPinnedStories({
      peer: buildInputPeer(peer.id, peer.accessHash),
      offsetId,
      limit: STORY_LIST_LIMIT,
    }),
    peerId: peer.id,
  });
}

export function fetchStoriesArchive({
  peer,
  offsetId,
}: {
  peer: ApiPeer;
  offsetId?: number;
}) {
  return fetchCommonStoriesRequest({
    method: new GramJs.stories.GetStoriesArchive({
      peer: peer && buildInputPeer(peer.id, peer.accessHash),
      offsetId,
      limit: STORY_LIST_LIMIT,
    }),
    peerId: peer.id,
  });
}

export async function fetchPeerStoriesByIds({ peer, ids }: { peer: ApiPeer; ids: number[] }) {
  const result = await invokeRequest(new GramJs.stories.GetStoriesByID({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: ids,
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);
  result.stories.forEach((story) => addStoryToLocalDb(story, peer.id));

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const stories = ids.reduce<Record<string, ApiTypeStory>>((acc, id) => {
    const story = result.stories.find(({ id: currentId }) => currentId === id);
    if (story) {
      acc[id] = buildApiStory(peer.id, story);
    } else {
      acc[id] = {
        id,
        peerId: peer.id,
        isDeleted: true,
      };
    }

    return acc;
  }, {});

  return {
    chats,
    users,
    stories,
  };
}

export function viewStory({ peer, storyId }: { peer: ApiPeer; storyId: number }) {
  return invokeRequest(new GramJs.stories.IncrementStoryViews({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: [storyId],
  }));
}

export function markStoryRead({ peer, storyId }: { peer: ApiPeer; storyId: number }) {
  return invokeRequest(new GramJs.stories.ReadStories({
    peer: buildInputPeer(peer.id, peer.accessHash),
    maxId: storyId,
  }));
}

export function deleteStory({ peer, storyId }: { peer: ApiPeer; storyId: number }) {
  return invokeRequest(new GramJs.stories.DeleteStories({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: [storyId],
  }));
}

export function toggleStoryPinned({ peer, storyId, isPinned }: { peer: ApiPeer; storyId: number; isPinned?: boolean }) {
  return invokeRequest(new GramJs.stories.TogglePinned({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: [storyId],
    pinned: isPinned,
  }));
}

export async function fetchStoryViewList({
  peer,
  storyId,
  areJustContacts,
  query,
  areReactionsFirst,
  limit = STORY_LIST_LIMIT,
  offset = '',
}: {
  peer: ApiPeer;
  storyId: number;
  areJustContacts?: true;
  areReactionsFirst?: true;
  query?: string;
  limit?: number;
  offset?: string;
}) {
  const result = await invokeRequest(new GramJs.stories.GetStoryViewsList({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: storyId,
    justContacts: areJustContacts,
    q: query,
    reactionsFirst: areReactionsFirst,
    limit,
    offset,
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);
  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const views = result.views.map(buildApiStoryView).filter(Boolean);

  return {
    users,
    chats,
    views,
    nextOffset: result.nextOffset,
    reactionsCount: result.reactionsCount,
    viewsCount: result.count,
  };
}

export async function fetchStoriesViews({
  peer,
  storyIds,
}: {
  peer: ApiPeer;
  storyIds: number[];
}) {
  const result = await invokeRequest(new GramJs.stories.GetStoriesViews({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: storyIds,
  }));

  if (!result?.views[0]) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);

  const views = buildApiStoryViews(result.views[0]);
  const users = result.users.map(buildApiUser).filter(Boolean);

  return {
    views,
    users,
  };
}

export async function fetchStoryLink({ peer, storyId }: { peer: ApiPeer ; storyId: number }) {
  const result = await invokeRequest(new GramJs.stories.ExportStoryLink({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: storyId,
  }));

  if (!result) {
    return undefined;
  }

  return result.link;
}

export function reportStory({
  peer,
  storyId,
  reason,
  description,
}: {
  peer: ApiPeer; storyId: number; reason: ApiReportReason; description?: string;
}) {
  return invokeRequest(new GramJs.stories.Report({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id: [storyId],
    reason: buildInputReportReason(reason),
    message: description,
  }));
}

export function editStoryPrivacy({
  peer,
  id,
  privacy,
}: {
  peer: ApiPeer;
  id: number;
  privacy: ApiInputPrivacyRules;
}) {
  return invokeRequest(new GramJs.stories.EditStory({
    peer: buildInputPeer(peer.id, peer.accessHash),
    id,
    privacyRules: buildInputPrivacyRules(privacy),
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleStoriesHidden({
  peer,
  isHidden,
}: {
  peer: ApiPeer;
  isHidden: boolean;
}) {
  return invokeRequest(new GramJs.stories.TogglePeerStoriesHidden({
    peer: buildInputPeer(peer.id, peer.accessHash),
    hidden: isHidden,
  }));
}

export function fetchStoriesMaxIds({
  peers,
}: {
  peers: ApiPeer[];
}) {
  return invokeRequest(new GramJs.stories.GetPeerMaxIDs({
    id: peers.map((peer) => buildInputPeer(peer.id, peer.accessHash)),
  }), { shouldIgnoreErrors: true });
}

async function fetchCommonStoriesRequest({ method, peerId }: {
  method: GramJs.stories.GetPinnedStories | GramJs.stories.GetStoriesArchive;
  peerId: string;
}) {
  const result = await invokeRequest(method);

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);
  result.stories.forEach((story) => addStoryToLocalDb(story, peerId));

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const stories = buildCollectionByCallback(result.stories, (story) => (
    [story.id, buildApiStory(peerId, story)]
  ));

  return {
    users,
    chats,
    stories,
  };
}

export function sendStoryReaction({
  peer, storyId, reaction, shouldAddToRecent,
}: {
  peer: ApiPeer;
  storyId: number;
  reaction?: ApiReaction;
  shouldAddToRecent?: boolean;
}) {
  return invokeRequest(new GramJs.stories.SendReaction({
    reaction: reaction ? buildInputReaction(reaction) : new GramJs.ReactionEmpty(),
    peer: buildInputPeer(peer.id, peer.accessHash),
    storyId,
    ...(shouldAddToRecent && { addToRecent: true }),
  }), {
    shouldReturnTrue: true,
  });
}

export function activateStealthMode({
  isForPast,
  isForFuture,
}: {
  isForPast?: true;
  isForFuture?: true;
}) {
  return invokeRequest(new GramJs.stories.ActivateStealthMode({
    past: isForPast,
    future: isForFuture,
  }), {
    shouldReturnTrue: true,
  });
}
