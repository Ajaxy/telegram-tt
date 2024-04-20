import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { StateProps } from './helpers/createMapStateToProps';
import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { getMessageDocument } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatMonthAndYear, toYearMonth } from '../../../util/date/dateFormat';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import { createMapStateToProps } from './helpers/createMapStateToProps';
import { getSenderName } from './helpers/getSenderName';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Document from '../../common/Document';
import NothingFound from '../../common/NothingFound';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';

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
  shouldWarnAboutSvg,
}) => {
  const {
    searchMessagesGlobal,
    focusMessage,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

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
      const [chatId, messageId] = id.split('_');
      const message = globalMessagesByChatId[chatId]?.byId[Number(messageId)];

      return message && getMessageDocument(message) ? message : undefined;
    }).filter(Boolean) as ApiMessage[];
  }, [globalMessagesByChatId, foundIds]);

  const handleMessageFocus = useCallback((messageId: number, chatId: string) => {
    focusMessage({ chatId, messageId });
  }, [focusMessage]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const isFirst = index === 0;
      const shouldDrawDateDivider = isFirst
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);
      return (
        <div
          className="ListItem small-icon"
          key={message.id}
        >
          {shouldDrawDateDivider && (
            <p
              className={buildClassName(
                'section-heading',
                isFirst && 'section-heading-first',
                !isFirst && 'section-heading-with-border',
              )}
              dir={lang.isRtl ? 'rtl' : undefined}
            >
              {formatMonthAndYear(lang, new Date(message.date * 1000))}
            </p>
          )}
          <Document
            message={message}
            withDate
            datetime={message.date}
            smaller
            sender={getSenderName(lang, message, chatsById, usersById)}
            className="scroll-item"
            isDownloading={activeDownloads[message.chatId]?.ids?.includes(message.id)}
            shouldWarnAboutSvg={shouldWarnAboutSvg}
            observeIntersection={observeIntersectionForMedia}
            onDateClick={handleMessageFocus}
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
)(FileResults));
