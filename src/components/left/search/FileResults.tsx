import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { StateProps } from './helpers/createMapStateToProps';
import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { getIsDownloading, getMessageDocument } from '../../../global/helpers';
import { formatMonthAndYear, toYearMonth } from '../../../util/dates/dateFormat';
import { parseSearchResultKey } from '../../../util/keys/searchResultKey';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import { createMapStateToProps } from './helpers/createMapStateToProps';
import { getSenderName } from './helpers/getSenderName';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useOldLang from '../../../hooks/useOldLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Document from '../../common/Document';
import NothingFound from '../../common/NothingFound';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition.tsx';

export type OwnProps = {
  searchQuery?: string;
};

const CURRENT_TYPE = 'documents';
const INTERSECTION_THROTTLE = 500;

const runThrottled = throttle((cb) => cb(), 500, true);

const FileResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  isLoading,
  chatsById,
  usersById,
  globalMessagesByChatId,
  foundIds,
  activeDownloads,
  shouldWarnAboutFiles,
}) => {
  const {
    searchMessagesGlobal,
    focusMessage,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();

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
  }, [searchQuery]);

  const foundMessages = useMemo(() => {
    if (!foundIds || !globalMessagesByChatId) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds.map((id) => {
      const [chatId, messageId] = parseSearchResultKey(id);
      const message = globalMessagesByChatId[chatId]?.byId[messageId];

      return message && getMessageDocument(message) ? message : undefined;
    }).filter(Boolean);
  }, [globalMessagesByChatId, foundIds]);

  const handleMessageFocus = useCallback((message: ApiMessage) => {
    focusMessage({ chatId: message.chatId, messageId: message.id });
  }, [focusMessage]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const isFirst = index === 0;
      const shouldDrawDateDivider = isFirst
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);
      return (
        <>
          {shouldDrawDateDivider && (
            <p
              className="section-heading"
              dir={lang.isRtl ? 'rtl' : undefined}
              key={message.date}
            >
              {formatMonthAndYear(lang, new Date(message.date * 1000))}
            </p>
          )}
          <div
            className="ListItem small-icon"
            key={message.id}
          >
            <Document
              document={getMessageDocument(message)!}
              message={message}
              datetime={message.date}
              smaller
              sender={getSenderName(lang, message, chatsById, usersById)}
              className="scroll-item"
              isDownloading={getIsDownloading(activeDownloads, message.content.document!)}
              shouldWarnAboutFiles={shouldWarnAboutFiles}
              observeIntersection={observeIntersectionForMedia}
              onDateClick={handleMessageFocus}
            />
          </div>
        </>
      );
    });
  }

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <Transition
      ref={containerRef}
      slideClassName="LeftSearch--content"
      name="fade"
      activeKey={canRenderContents ? 1 : 0}
      shouldCleanup
    >
      <InfiniteScroll
        className="search-content documents-list custom-scroll"
        items={canRenderContents ? foundMessages : undefined}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!canRenderContents && <Loading />}
        {canRenderContents && (!foundIds || foundIds.length === 0) && (
          <NothingFound
            withSticker
            text={lang('ChatList.Search.NoResults')}
            description={lang('ChatList.Search.NoResultsDescription')}
          />
        )}
        {canRenderContents && foundIds && foundIds.length > 0 && renderList()}
      </InfiniteScroll>
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  createMapStateToProps(CURRENT_TYPE),
)(FileResults));
