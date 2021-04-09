import { useMemo, useRef } from '../../../lib/teact/teact';

import { ApiChatMember, ApiMessage, ApiUser } from '../../../api/types';
import { ProfileTabType, SharedMediaType } from '../../../types';

import { MESSAGE_SEARCH_SLICE, SHARED_MEDIA_SLICE } from '../../../config';
import { getMessageContentIds, getSortedUserIds } from '../../../modules/helpers';
import useOnChange from '../../../hooks/useOnChange';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';

export default function useProfileViewportIds(
  isRightColumnShown: boolean,
  searchMessages: AnyToVoidFunction,
  tabType: ProfileTabType,
  mediaSearchType?: SharedMediaType,
  groupChatMembers?: ApiChatMember[],
  usersById?: Record<number, ApiUser>,
  chatMessages?: Record<number, ApiMessage>,
  foundIds?: number[],
  chatId?: number,
  lastSyncTime?: number,
) {
  const resultType = tabType === 'members' || !mediaSearchType ? tabType : mediaSearchType;

  const memberIds = useMemo(() => {
    if (!groupChatMembers || !usersById) {
      return undefined;
    }

    return getSortedUserIds(groupChatMembers.map(({ userId }) => userId), usersById);
  }, [groupChatMembers, usersById]);

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
      viewportIds = memberIds;
      getMore = undefined;
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
