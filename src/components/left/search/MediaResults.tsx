import React, {
  FC, memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../modules';

import { LoadMoreDirection, MediaViewerOrigin } from '../../../types';

import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { createMapStateToProps, StateProps } from './helpers/createMapStateToProps';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';
import useLang from '../../../hooks/useLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Media from '../../common/Media';
import ChatMessage from './ChatMessage';
import NothingFound from '../../common/NothingFound';
import Loading from '../../ui/Loading';

export type OwnProps = {
  searchQuery?: string;
};

const CURRENT_TYPE = 'media';
const INTERSECTION_THROTTLE = 500;

const runThrottled = throttle((cb) => cb(), 500, true);

const MediaResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  searchChatId,
  isLoading,
  globalMessagesByChatId,
  foundIds,
  lastSyncTime,
  isChatProtected,
}) => {
  const {
    searchMessagesGlobal,
    openMediaViewer,
  } = getDispatch();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const { observe: observeIntersectionForMedia } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (lastSyncTime && direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: CURRENT_TYPE,
          query: searchQuery,
          chatId: searchChatId,
        });
      });
    }
  }, [lastSyncTime, searchMessagesGlobal, searchQuery, searchChatId]);

  const foundMessages = useMemo(() => {
    if (!foundIds || !globalMessagesByChatId) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds.map((id) => {
      const [chatId, messageId] = id.split('_');

      return globalMessagesByChatId[chatId]?.byId[Number(messageId)];
    }).filter(Boolean);
  }, [globalMessagesByChatId, foundIds]);

  const handleSelectMedia = useCallback((messageId: number, chatId: string) => {
    openMediaViewer({
      chatId,
      messageId,
      origin: MediaViewerOrigin.SearchResult,
    });
  }, [openMediaViewer]);

  function renderGallery() {
    return (
      <div className="media-list" dir={lang.isRtl ? 'rtl' : undefined}>
        {foundMessages.map((message) => (
          <Media
            key={message.id}
            idPrefix="search-media"
            message={message}
            isProtected={isChatProtected || message.isProtected}
            observeIntersection={observeIntersectionForMedia}
            onClick={handleSelectMedia}
          />
        ))}
      </div>
    );
  }

  function renderSearchResult() {
    return foundMessages.map((message) => (
      <ChatMessage
        key={message.id}
        chatId={message.chatId}
        message={message}
      />
    ));
  }

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;
  const isMediaGrid = canRenderContents && foundIds && foundIds.length > 0 && !searchQuery;
  const isMessageList = canRenderContents && foundIds && foundIds.length > 0 && searchQuery;

  const classNames = buildClassName(
    'search-content custom-scroll',
    isMessageList && 'chat-list',
  );

  return (
    <div ref={containerRef} className="LeftSearch">
      <InfiniteScroll
        className={classNames}
        items={foundMessages}
        itemSelector={!searchQuery ? '.Media' : '.ListItem'}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!canRenderContents && <Loading />}
        {canRenderContents && (!foundIds || foundIds.length === 0) && (
          <NothingFound
            text={lang('ChatList.Search.NoResults')}
            description={lang('ChatList.Search.NoResultsDescription')}
          />
        )}
        {isMediaGrid && renderGallery()}
        {isMessageList && renderSearchResult()}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  createMapStateToProps(CURRENT_TYPE),
)(MediaResults));
