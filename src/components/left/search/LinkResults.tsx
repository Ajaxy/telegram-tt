import React, {
  FC, memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { createMapStateToProps, StateProps } from './helpers/createMapStateToProps';
import { formatMonthAndYear, toYearMonth } from '../../../util/dateFormat';
import { getSenderName } from './helpers/getSenderName';
import { throttle } from '../../../util/schedulers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useLang from '../../../hooks/useLang';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';

import InfiniteScroll from '../../ui/InfiniteScroll';
import WebLink from '../../common/WebLink';
import NothingFound from '../../common/NothingFound';
import Loading from '../../ui/Loading';

export type OwnProps = {
  searchQuery?: string;
};

const CURRENT_TYPE = 'links';
const INTERSECTION_THROTTLE = 500;

const runThrottled = throttle((cb) => cb(), 500, true);

const LinkResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  searchChatId,
  isLoading,
  chatsById,
  usersById,
  globalMessagesByChatId,
  foundIds,
  lastSyncTime,
  isChatProtected,
}) => {
  const {
    searchMessagesGlobal,
    focusMessage,
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

  const handleMessageFocus = useCallback((messageId: number, chatId: string) => {
    focusMessage({ chatId, messageId });
  }, [focusMessage]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const shouldDrawDateDivider = index === 0
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);
      return (
        <div
          className="ListItem small-icon"
          dir={lang.isRtl ? 'rtl' : undefined}
          key={message.id}
        >
          {shouldDrawDateDivider && (
            <p className="section-heading" dir={lang.isRtl ? 'rtl' : undefined}>
              {formatMonthAndYear(lang, new Date(message.date * 1000))}
            </p>
          )}
          <WebLink
            key={message.id}
            message={message}
            senderTitle={getSenderName(lang, message, chatsById, usersById)}
            isProtected={isChatProtected || message.isProtected}
            observeIntersection={observeIntersectionForMedia}
            onMessageClick={handleMessageFocus}
          />
        </div>
      );
    });
  }

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <div ref={containerRef} className="LeftSearch">
      <InfiniteScroll
        className="search-content documents-list custom-scroll"
        items={foundMessages}
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
        {canRenderContents && foundIds && foundIds.length > 0 && renderList()}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  createMapStateToProps(CURRENT_TYPE),
)(LinkResults));
