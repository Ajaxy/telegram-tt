import { useMemo, useRef } from '../../../lib/teact/teact';

import type {
  ApiChat, ApiChatMember, ApiMessage, ApiUser, ApiUserStatus,
} from '../../../api/types';
import type { ProfileTabType, SharedMediaType, ThreadId } from '../../../types';

import { MEMBERS_SLICE, MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { getMessageContentIds, sortUserIds } from '../../../global/helpers';
import sortChatIds from '../../common/helpers/sortChatIds';

import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useSyncEffect from '../../../hooks/useSyncEffect';

export default function useProfileViewportIds({
  loadMoreMembers,
  loadCommonChats,
  searchMessages,
  loadStories,
  loadStoriesArchive,
  loadMoreGifts,
  tabType,
  mediaSearchType,
  groupChatMembers,
  commonChatIds,
  usersById,
  userStatusesById,
  chatsById,
  chatMessages,
  foundIds,
  threadId,
  storyIds,
  giftIds,
  pinnedStoryIds,
  archiveStoryIds,
  similarChannels,
  similarBots,
}: {
  loadMoreMembers: AnyToVoidFunction;
  loadCommonChats: AnyToVoidFunction;
  searchMessages: AnyToVoidFunction;
  loadStories: AnyToVoidFunction;
  loadStoriesArchive: AnyToVoidFunction;
  loadMoreGifts: AnyToVoidFunction;
  tabType: ProfileTabType;
  mediaSearchType?: SharedMediaType;
  groupChatMembers?: ApiChatMember[];
  commonChatIds?: string[];
  usersById?: Record<string, ApiUser>;
  userStatusesById?: Record<string, ApiUserStatus>;
  chatsById?: Record<string, ApiChat>;
  chatMessages?: Record<number, ApiMessage>;
  foundIds?: number[];
  threadId?: ThreadId;
  storyIds?: number[];
  giftIds?: string[];
  pinnedStoryIds?: number[];
  archiveStoryIds?: number[];
  similarChannels?: string[];
  similarBots?: string[];
}) {
  const resultType = tabType === 'members' || !mediaSearchType ? tabType : mediaSearchType;

  const memberIds = useMemo(() => {
    if (!groupChatMembers || !usersById || !userStatusesById) {
      return undefined;
    }

    return sortUserIds(
      groupChatMembers.map(({ userId }) => userId),
      usersById,
      userStatusesById,
    );
  }, [groupChatMembers, usersById, userStatusesById]);

  const chatIds = useMemo(() => {
    if (!commonChatIds || !chatsById) {
      return undefined;
    }

    return sortChatIds(commonChatIds, true);
  }, [chatsById, commonChatIds]);

  const [memberViewportIds, getMoreMembers, noProfileInfoForMembers] = useInfiniteScrollForLoadableItems(
    loadMoreMembers, memberIds,
  );

  const [mediaViewportIds, getMoreMedia, noProfileInfoForMedia] = useInfiniteScrollForSharedMedia(
    'media', resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [gifViewportIds, getMoreGifs, noProfileInfoForGifs] = useInfiniteScrollForSharedMedia(
    'gif', resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [documentViewportIds, getMoreDocuments, noProfileInfoForDocuments] = useInfiniteScrollForSharedMedia(
    'documents', resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [linkViewportIds, getMoreLinks, noProfileInfoForLinks] = useInfiniteScrollForSharedMedia(
    'links', resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [audioViewportIds, getMoreAudio, noProfileInfoForAudio] = useInfiniteScrollForSharedMedia(
    'audio', resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [voiceViewportIds, getMoreVoices, noProfileInfoForVoices] = useInfiniteScrollForSharedMedia(
    'voice', resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [commonChatViewportIds, getMoreCommonChats, noProfileInfoForCommonChats] = useInfiniteScrollForLoadableItems(
    loadCommonChats, chatIds,
  );

  const sortedStoryIds = useMemo(() => {
    if (!storyIds?.length) return storyIds;
    const pinnedStoryIdsSet = new Set(pinnedStoryIds);
    return storyIds.slice().sort((a, b) => {
      const aIsPinned = pinnedStoryIdsSet.has(a);
      const bIsPinned = pinnedStoryIdsSet.has(b);
      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;
      return b - a;
    });
  }, [storyIds, pinnedStoryIds]);

  const [storyViewportIds, getMoreStories, noProfileInfoForStories] = useInfiniteScrollForLoadableItems(
    loadStories, sortedStoryIds,
  );

  const [
    archiveStoryViewportIds,
    getMoreStoriesArchive,
    noProfileInfoForStoriesArchive,
  ] = useInfiniteScrollForLoadableItems(
    loadStoriesArchive, archiveStoryIds,
  );

  let viewportIds: number[] | string[] | undefined;
  let getMore: AnyToVoidFunction | undefined;
  let noProfileInfo = false;

  switch (resultType) {
    case 'members':
      viewportIds = memberViewportIds;
      getMore = getMoreMembers;
      noProfileInfo = noProfileInfoForMembers;
      break;
    case 'commonChats':
      viewportIds = commonChatViewportIds;
      getMore = getMoreCommonChats;
      noProfileInfo = noProfileInfoForCommonChats;
      break;
    case 'media':
      viewportIds = mediaViewportIds;
      getMore = getMoreMedia;
      noProfileInfo = noProfileInfoForMedia;
      break;
    case 'gif':
      viewportIds = gifViewportIds;
      getMore = getMoreGifs;
      noProfileInfo = noProfileInfoForGifs;
      break;
    case 'documents':
      viewportIds = documentViewportIds;
      getMore = getMoreDocuments;
      noProfileInfo = noProfileInfoForDocuments;
      break;
    case 'links':
      viewportIds = linkViewportIds;
      getMore = getMoreLinks;
      noProfileInfo = noProfileInfoForLinks;
      break;
    case 'audio':
      viewportIds = audioViewportIds;
      getMore = getMoreAudio;
      noProfileInfo = noProfileInfoForAudio;
      break;
    case 'voice':
      viewportIds = voiceViewportIds;
      getMore = getMoreVoices;
      noProfileInfo = noProfileInfoForVoices;
      break;
    case 'stories':
      viewportIds = storyViewportIds;
      getMore = getMoreStories;
      noProfileInfo = noProfileInfoForStories;
      break;
    case 'storiesArchive':
      viewportIds = archiveStoryViewportIds;
      getMore = getMoreStoriesArchive;
      noProfileInfo = noProfileInfoForStoriesArchive;
      break;
    case 'similarChannels':
      viewportIds = similarChannels;
      break;
    case 'similarBots':
      viewportIds = similarBots;
      break;
    case 'gifts':
      viewportIds = giftIds;
      getMore = loadMoreGifts;
      break;
    case 'dialogs':
      noProfileInfo = true;
      break;
  }

  return [resultType, viewportIds, getMore, noProfileInfo] as const;
}

function useInfiniteScrollForLoadableItems<ListId extends string | number>(
  handleLoadMore?: AnyToVoidFunction,
  itemIds?: ListId[],
) {
  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMore,
    itemIds,
    undefined,
    MEMBERS_SLICE,
  );

  const isOnTop = !viewportIds || !itemIds || viewportIds[0] === itemIds[0];

  return [viewportIds, getMore, !isOnTop] as const;
}

function useInfiniteScrollForSharedMedia(
  forSharedMediaType: SharedMediaType,
  currentResultType?: ProfileTabType,
  handleLoadMore?: AnyToVoidFunction,
  chatMessages?: Record<number, ApiMessage>,
  foundIds?: number[],
  threadId?: ThreadId,
) {
  const messageIdsRef = useRef<number[]>();

  useSyncEffect(() => {
    messageIdsRef.current = undefined;
  }, [threadId]);

  useSyncEffect(() => {
    if (currentResultType === forSharedMediaType && chatMessages && foundIds) {
      messageIdsRef.current = getMessageContentIds(
        chatMessages,
        foundIds,
        forSharedMediaType,
      );
    }
  }, [chatMessages, foundIds, currentResultType, forSharedMediaType]);

  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMore,
    messageIdsRef.current,
    undefined,
    forSharedMediaType === 'media' ? SHARED_MEDIA_SLICE : MESSAGE_SEARCH_SLICE,
  );

  const isOnTop = !viewportIds || !messageIdsRef.current || viewportIds[0] === messageIdsRef.current[0];

  return [viewportIds, getMore, !isOnTop] as const;
}
