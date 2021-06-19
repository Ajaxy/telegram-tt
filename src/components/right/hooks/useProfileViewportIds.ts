import { useMemo, useRef } from '../../../lib/teact/teact';

import { ApiChatMember, ApiMessage, ApiUser } from '../../../api/types';
import { ProfileTabType, SharedMediaType } from '../../../types';

import { MEMBERS_SLICE, MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { getMessageContentIds, sortUserIds } from '../../../modules/helpers';
import useOnChange from '../../../hooks/useOnChange';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';

export default function useProfileViewportIds(
  isRightColumnShown: boolean,
  loadMoreMembers: AnyToVoidFunction,
  searchMessages: AnyToVoidFunction,
  tabType: ProfileTabType,
  mediaSearchType?: SharedMediaType,
  groupChatMembers?: ApiChatMember[],
  usersById?: Record<number, ApiUser>,
  chatMessages?: Record<number, ApiMessage>,
  foundIds?: number[],
  chatId?: number,
  lastSyncTime?: number,
  serverTimeOffset = 0,
) {
  const resultType = tabType === 'members' || !mediaSearchType ? tabType : mediaSearchType;

  const memberIds = useMemo(() => {
    if (!groupChatMembers || !usersById) {
      return undefined;
    }

    return sortUserIds(groupChatMembers.map(({ userId }) => userId), usersById, undefined, serverTimeOffset);
  }, [groupChatMembers, serverTimeOffset, usersById]);

  const [memberViewportIds, getMoreMembers, noProfileInfoForMembers] = useInfiniteScrollForMembers(
    resultType, loadMoreMembers, lastSyncTime, memberIds,
  );

  const [mediaViewportIds, getMoreMedia, noProfileInfoForMedia] = useInfiniteScrollForSharedMedia(
    'media', resultType, searchMessages, lastSyncTime, chatMessages, foundIds,
  );

  const [documentViewportIds, getMoreDocuments, noProfileInfoForDocuments] = useInfiniteScrollForSharedMedia(
    'documents', resultType, searchMessages, lastSyncTime, chatMessages, foundIds,
  );

  const [linkViewportIds, getMoreLinks, noProfileInfoForLinks] = useInfiniteScrollForSharedMedia(
    'links', resultType, searchMessages, lastSyncTime, chatMessages, foundIds,
  );

  const [audioViewportIds, getMoreAudio, noProfileInfoForAudio] = useInfiniteScrollForSharedMedia(
    'audio', resultType, searchMessages, lastSyncTime, chatMessages, foundIds,
  );

  let viewportIds: number[] | undefined;
  let getMore: AnyToVoidFunction | undefined;
  let noProfileInfo = false;

  switch (resultType) {
    case 'members':
      viewportIds = memberViewportIds;
      getMore = getMoreMembers;
      noProfileInfo = noProfileInfoForMembers;
      break;
    case 'media':
      viewportIds = mediaViewportIds;
      getMore = getMoreMedia;
      noProfileInfo = noProfileInfoForMedia;
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
  }

  return [resultType, viewportIds, getMore, noProfileInfo] as const;
}

function useInfiniteScrollForMembers(
  currentResultType?: ProfileTabType,
  handleLoadMore?: AnyToVoidFunction,
  lastSyncTime?: number,
  memberIds?: number[],
) {
  const [viewportIds, getMore] = useInfiniteScroll(
    lastSyncTime ? handleLoadMore : undefined,
    memberIds,
    undefined,
    MEMBERS_SLICE,
  );

  const isOnTop = !viewportIds || !memberIds || viewportIds[0] === memberIds[0];

  return [viewportIds, getMore, !isOnTop] as const;
}

function useInfiniteScrollForSharedMedia(
  forSharedMediaType: SharedMediaType,
  currentResultType?: ProfileTabType,
  handleLoadMore?: AnyToVoidFunction,
  lastSyncTime?: number,
  chatMessages?: Record<number, ApiMessage>,
  foundIds?: number[],
) {
  const messageIdsRef = useRef<number[]>();

  useOnChange(() => {
    if (currentResultType === forSharedMediaType && chatMessages && foundIds) {
      messageIdsRef.current = getMessageContentIds(
        chatMessages,
        foundIds,
        forSharedMediaType,
      ).reverse();
    }
  }, [chatMessages, foundIds, currentResultType, forSharedMediaType]);

  const [viewportIds, getMore] = useInfiniteScroll(
    lastSyncTime ? handleLoadMore : undefined,
    messageIdsRef.current,
    undefined,
    forSharedMediaType === 'media' ? SHARED_MEDIA_SLICE : MESSAGE_SEARCH_SLICE,
  );

  const isOnTop = !viewportIds || !messageIdsRef.current || viewportIds[0] === messageIdsRef.current[0];

  return [viewportIds, getMore, !isOnTop] as const;
}
