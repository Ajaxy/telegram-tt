import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { StateProps } from './helpers/createMapStateToProps';
import { LoadMoreDirection, MediaViewerOrigin } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { parseSearchResultKey } from '../../../util/keys/searchResultKey';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import { createMapStateToProps } from './helpers/createMapStateToProps';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useOldLang from '../../../hooks/useOldLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Media from '../../common/Media';
import NothingFound from '../../common/NothingFound';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import ChatMessage from './ChatMessage';

export type OwnProps = {
  searchQuery?: string;
};

const CURRENT_TYPE = 'media';
const INTERSECTION_THROTTLE = 500;

const runThrottled = throttle((cb) => cb(), 500, true);

const MediaResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  isLoading,
  globalMessagesByChatId,
  foundIds,
  isChatProtected,
}) => {
  const {
    searchMessagesGlobal,
    openMediaViewer,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = useOldLang();

  const { observe: observeIntersectionForMedia } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: CURRENT_TYPE,
        });
      });
    }
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps -- `searchQuery` is required to prevent infinite message loading
  }, [searchMessagesGlobal, searchQuery]);

  const foundMessages = useMemo(() => {
    if (!foundIds || !globalMessagesByChatId) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds.map((id) => {
      const [chatId, messageId] = parseSearchResultKey(id);

      return globalMessagesByChatId[chatId]?.byId[messageId];
    }).filter(Boolean);
  }, [globalMessagesByChatId, foundIds]);

  const handleSelectMedia = useCallback((id: number, chatId: string) => {
    openMediaViewer({
      chatId,
      messageId: id,
      origin: MediaViewerOrigin.SearchResult,
    });
  }, [openMediaViewer]);

  function renderGallery() {
    return (
      <div className="media-list" dir={lang.isRtl ? 'rtl' : undefined}>
        {foundMessages.map((message) => (
          <Media
            key={`${message.chatId}-${message.id}`}
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
    <div ref={containerRef} className="LeftSearch--content LeftSearch--media">
      <InfiniteScroll
        className={classNames}
        items={canRenderContents ? foundMessages : undefined}
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
