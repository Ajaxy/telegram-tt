import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { LoadMoreDirection, MediaViewerOrigin } from '../../../types';

import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { createMapStateToProps, StateProps } from './helpers/createMapStateToProps';
import { pick } from '../../../util/iteratees';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';
import useLang from '../../../hooks/useLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Media from '../../common/Media';
import ChatMessage from './ChatMessage';
import NothingFound from '../../common/NothingFound';
import Loading from '../../ui/Loading';

export type OwnProps = {
  searchQuery?: string;
};

type DispatchProps = Pick<GlobalActions, ('searchMessagesGlobal' | 'openMediaViewer')>;

const CURRENT_TYPE = 'media';
const runThrottled = throttle((cb) => cb(), 500, true);

const MediaResults: FC<OwnProps & StateProps & DispatchProps> = ({
  searchQuery,
  searchChatId,
  isLoading,
  globalMessagesByChatId,
  foundIds,
  lastSyncTime,
  searchMessagesGlobal,
  openMediaViewer,
}) => {
  const lang = useLang();

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
      const [chatId, messageId] = id.split('_').map(Number);

      return globalMessagesByChatId[chatId] && globalMessagesByChatId[chatId].byId[messageId];
    }).filter(Boolean);
  }, [globalMessagesByChatId, foundIds]);

  const handleSelectMedia = useCallback((messageId: number, chatId: number) => {
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
    <div className="LeftSearch">
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'searchMessagesGlobal',
    'openMediaViewer',
  ]),
)(MediaResults));
