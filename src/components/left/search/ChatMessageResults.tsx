import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiMessage } from '../../../api/types';
import { GlobalActions } from '../../../global/types';
import { LoadMoreDirection } from '../../../types';

import { pick } from '../../../util/iteratees';
import { getMessageSummaryText } from '../../../modules/helpers';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import useLang from '../../../hooks/useLang';

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
  currentUserId?: number;
  foundIds?: string[];
  globalMessagesByChatId?: Record<number, { byId: Record<number, ApiMessage> }>;
  chatsById: Record<number, ApiChat>;
  fetchingStatus?: { chats?: boolean; messages?: boolean };
  lastSyncTime?: number;
};

type DispatchProps = Pick<GlobalActions, ('searchMessagesGlobal')>;

const runThrottled = throttle((cb) => cb(), 500, true);

const ChatMessageResults: FC<OwnProps & StateProps & DispatchProps> = ({
  searchQuery,
  currentUserId,
  dateSearchQuery,
  foundIds,
  globalMessagesByChatId,
  chatsById,
  fetchingStatus,
  lastSyncTime,
  searchMessagesGlobal,
  onSearchDateSelect,
}) => {
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
        const [chatId, messageId] = id.split('_').map(Number);

        return (
          globalMessagesByChatId && globalMessagesByChatId[chatId] && globalMessagesByChatId[chatId].byId[messageId]
        );
      })
      .filter<ApiMessage>(Boolean as any)
      .sort((a, b) => b.date - a.date);
  }, [foundIds, globalMessagesByChatId]);

  function renderFoundMessage(message: ApiMessage) {
    const text = getMessageSummaryText(lang, message);
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
        {!!foundMessages.length && foundMessages.map(renderFoundMessage)}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { byId: chatsById } = global.chats;
    const { currentUserId, messages: { byChatId: globalMessagesByChatId }, lastSyncTime } = global;
    const { fetchingStatus, resultsByType } = global.globalSearch;

    const { foundIds } = (resultsByType && resultsByType.text) || {};

    return {
      currentUserId,
      foundIds,
      globalMessagesByChatId,
      chatsById,
      fetchingStatus,
      lastSyncTime,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['searchMessagesGlobal']),
)(ChatMessageResults));
