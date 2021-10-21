import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiMessage } from '../../../api/types';
import { GlobalActions } from '../../../global/types';
import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { createMapStateToProps, StateProps } from './helpers/createMapStateToProps';
import { pick } from '../../../util/iteratees';
import { formatMonthAndYear, toYearMonth } from '../../../util/dateFormat';
import { getSenderName } from './helpers/getSenderName';
import { throttle } from '../../../util/schedulers';
import { getMessageDocument } from '../../../modules/helpers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useLang from '../../../hooks/useLang';

import Document from '../../common/Document';
import InfiniteScroll from '../../ui/InfiniteScroll';
import NothingFound from '../../common/NothingFound';
import Loading from '../../ui/Loading';

export type OwnProps = {
  searchQuery?: string;
};

type DispatchProps = Pick<GlobalActions, ('searchMessagesGlobal' | 'focusMessage')>;

const CURRENT_TYPE = 'documents';
const runThrottled = throttle((cb) => cb(), 500, true);

const FileResults: FC<OwnProps & StateProps & DispatchProps> = ({
  searchQuery,
  searchChatId,
  isLoading,
  chatsById,
  usersById,
  globalMessagesByChatId,
  foundIds,
  activeDownloads,
  lastSyncTime,
  searchMessagesGlobal,
  focusMessage,
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
      const message = globalMessagesByChatId[chatId]?.byId[messageId];

      return message && getMessageDocument(message) ? message : undefined;
    }).filter(Boolean) as ApiMessage[];
  }, [globalMessagesByChatId, foundIds]);

  const handleMessageFocus = useCallback((messageId: number, chatId: number) => {
    focusMessage({ chatId, messageId });
  }, [focusMessage]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const shouldDrawDateDivider = index === 0
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);
      return (
        <div
          className="ListItem small-icon"
          key={message.id}
        >
          {shouldDrawDateDivider && (
            <p className="section-heading">{formatMonthAndYear(lang, new Date(message.date * 1000))}</p>
          )}
          <Document
            message={message}
            withDate
            datetime={message.date}
            smaller
            sender={getSenderName(lang, message, chatsById, usersById)}
            className="scroll-item"
            onDateClick={handleMessageFocus}
            isDownloading={activeDownloads[message.chatId]?.includes(message.id)}
          />
        </div>
      );
    });
  }

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <div className="LeftSearch">
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'searchMessagesGlobal',
    'focusMessage',
  ]),
)(FileResults));
