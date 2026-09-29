import { useMemo, useRef } from '../../../lib/teact/teact';

import type {
  ApiChat, ApiChatMember, ApiMessage, ApiUser, ApiUserStatus,
} from '../../../api/types';
import type { ProfileTabType, SharedMediaType, ThreadId } from '../../../types';

import {
  MEMBERS_SLICE, MESSAGE_SEARCH_SLICE, PROFILE_POLLS_SLICE, SHARED_MEDIA_SLICE,
} from '../../../config';
import { getMessageContentIds, sortUserIds } from '../../../global/helpers';
import sortChatIds from '../../common/helpers/sortChatIds';

import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useSyncEffect from '../../../hooks/useSyncEffect';

const SHARED_MEDIA_TYPES: SharedMediaType[] = ['media', 'documents', 'links', 'audio', 'voice', 'gif', 'polls'];

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
  scrollToTopKey,
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
  scrollToTopKey: number;
}) {
  const resultType = mediaSearchType && SHARED_MEDIA_TYPES.includes(tabType as SharedMediaType)
    ? mediaSearchType : tabType;

  const handledScrollToTopKeyRef = useRef(scrollToTopKey);
  const shouldResetToTop = handledScrollToTopKeyRef.current !== scrollToTopKey;
  handledScrollToTopKeyRef.current = scrollToTopKey;

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

  const [memberViewportIds, getMoreMembers] = useInfiniteScrollForLoadableItems(
    shouldResetToTop, loadMoreMembers, memberIds,
  );

  const [mediaViewportIds, getMoreMedia] = useInfiniteScrollForSharedMedia(
    'media', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [gifViewportIds, getMoreGifs] = useInfiniteScrollForSharedMedia(
    'gif', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [documentViewportIds, getMoreDocuments] = useInfiniteScrollForSharedMedia(
    'documents', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [linkViewportIds, getMoreLinks] = useInfiniteScrollForSharedMedia(
    'links', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [audioViewportIds, getMoreAudio] = useInfiniteScrollForSharedMedia(
    'audio', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [voiceViewportIds, getMoreVoices] = useInfiniteScrollForSharedMedia(
    'voice', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [pollViewportIds, getMorePolls] = useInfiniteScrollForSharedMedia(
    'polls', shouldResetToTop, resultType, searchMessages, chatMessages, foundIds, threadId,
  );

  const [commonChatViewportIds, getMoreCommonChats] = useInfiniteScrollForLoadableItems(
    shouldResetToTop, loadCommonChats, chatIds,
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

  const [storyViewportIds, getMoreStories] = useInfiniteScrollForLoadableItems(
    shouldResetToTop, loadStories, sortedStoryIds,
  );

  const [archiveStoryViewportIds, getMoreStoriesArchive] = useInfiniteScrollForLoadableItems(
    shouldResetToTop, loadStoriesArchive, archiveStoryIds,
  );

  let viewportIds: number[] | string[] | undefined;
  let getMore: AnyToVoidFunction | undefined;

  switch (resultType) {
    case 'members':
      viewportIds = memberViewportIds;
      getMore = getMoreMembers;
      break;
    case 'commonChats':
      viewportIds = commonChatViewportIds;
      getMore = getMoreCommonChats;
      break;
    case 'media':
      viewportIds = mediaViewportIds;
      getMore = getMoreMedia;
      break;
    case 'gif':
      viewportIds = gifViewportIds;
      getMore = getMoreGifs;
      break;
    case 'documents':
      viewportIds = documentViewportIds;
      getMore = getMoreDocuments;
      break;
    case 'links':
      viewportIds = linkViewportIds;
      getMore = getMoreLinks;
      break;
    case 'audio':
      viewportIds = audioViewportIds;
      getMore = getMoreAudio;
      break;
    case 'voice':
      viewportIds = voiceViewportIds;
      getMore = getMoreVoices;
      break;
    case 'polls':
      viewportIds = pollViewportIds;
      getMore = getMorePolls;
      break;
    case 'stories':
      viewportIds = storyViewportIds;
      getMore = getMoreStories;
      break;
    case 'storiesArchive':
      viewportIds = archiveStoryViewportIds;
      getMore = getMoreStoriesArchive;
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
  }

  const noProfileInfo = resultType === 'dialogs';

  return [resultType, viewportIds, getMore, noProfileInfo] as const;
}

function useInfiniteScrollForLoadableItems<ListId extends string | number>(
  shouldResetToTop: boolean,
  handleLoadMore?: AnyToVoidFunction,
  itemIds?: ListId[],
) {
  return useInfiniteScroll(
    handleLoadMore,
    itemIds,
    undefined,
    MEMBERS_SLICE,
    shouldResetToTop ? itemIds?.[0] : undefined,
  );
}

function useInfiniteScrollForSharedMedia(
  forSharedMediaType: SharedMediaType,
  shouldResetToTop: boolean,
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

  return useInfiniteScroll(
    handleLoadMore,
    messageIdsRef.current,
    undefined,
    getListSlice(forSharedMediaType),
    shouldResetToTop ? messageIdsRef.current?.[0] : undefined,
  );
}

function getListSlice(type: SharedMediaType) {
  switch (type) {
    case 'polls':
      return PROFILE_POLLS_SLICE;
    case 'media':
      return SHARED_MEDIA_SLICE;
    default:
      return MESSAGE_SEARCH_SLICE;
  }
}
