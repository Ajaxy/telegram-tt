import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiMessage } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import useLang from '../../../hooks/useLang';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import InfiniteScroll from '../../ui/InfiniteScroll';
import ChatMessage from './ChatMessage';
import NothingFound from '../../common/NothingFound';
import DateSuggest from './DateSuggest';

export type OwnProps = {
  searchQuery?: string;
  dateSearchQuery?: string;
  onReset: () => void;
  onSearchDateSelect: (value: Date) => void;
};

type StateProps = {
  currentUserId?: string;
  foundIds?: string[];
  globalMessagesByChatId?: Record<string, { byId: Record<number, ApiMessage> }>;
  chatsById: Record<string, ApiChat>;
  fetchingStatus?: { chats?: boolean; messages?: boolean };
  lastSyncTime?: number;
};

const runThrottled = throttle((cb) => cb(), 500, true);

const ChatMessageResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  currentUserId,
  dateSearchQuery,
  foundIds,
  globalMessagesByChatId,
  chatsById,
  fetchingStatus,
  lastSyncTime,
  onSearchDateSelect,
}) => {
  const { searchMessagesGlobal } = getDispatch();

  const lang = useLang();
  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (lastSyncTime && direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: 'text',
          query: searchQuery,
          chatId: currentUserId,
        });
      });
    }
  }, [currentUserId, lastSyncTime, searchMessagesGlobal, searchQuery]);

  const foundMessages = useMemo(() => {
    if (!foundIds || foundIds.length === 0) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds
      .map((id) => {
        const [chatId, messageId] = id.split('_');

        return globalMessagesByChatId?.[chatId]?.byId[Number(messageId)];
      })
      .filter<ApiMessage>(Boolean as any)
      .sort((a, b) => b.date - a.date);
  }, [foundIds, globalMessagesByChatId]);

  function renderFoundMessage(message: ApiMessage) {
    const text = renderMessageSummary(lang, message);
    const chat = chatsById[message.chatId];

    if (!text || !chat) {
      return undefined;
    }

    return (
      <ChatMessage
        chatId={message.chatId}
        message={message}
        searchQuery={searchQuery}
      />
    );
  }

  const nothingFound = fetchingStatus && !fetchingStatus.chats && !fetchingStatus.messages && !foundMessages.length;

  return (
    <div className="LeftSearch">
      <InfiniteScroll
        className="search-content custom-scroll chat-list"
        items={foundMessages}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {dateSearchQuery && (
          <div className="chat-selection no-selection no-scrollbar">
            <DateSuggest
              searchDate={dateSearchQuery}
              onSelect={onSearchDateSelect}
            />
          </div>
        )}
        {nothingFound && (
          <NothingFound
            text={lang('ChatList.Search.NoResults')}
            description={lang('ChatList.Search.NoResultsDescription')}
          />
        )}
        {foundMessages.map(renderFoundMessage)}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { byId: chatsById } = global.chats;
    const { currentUserId, messages: { byChatId: globalMessagesByChatId }, lastSyncTime } = global;
    const { fetchingStatus, resultsByType } = global.globalSearch;

    const { foundIds } = (resultsByType?.text) || {};

    return {
      currentUserId,
      foundIds,
      globalMessagesByChatId,
      chatsById,
      fetchingStatus,
      lastSyncTime,
    };
  },
)(ChatMessageResults));
