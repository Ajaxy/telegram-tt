import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiMessage } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { selectTabState } from '../../../global/selectors';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';
import useLang from '../../../hooks/useLang';
import useAppLayout from '../../../hooks/useAppLayout';

import InfiniteScroll from '../../ui/InfiniteScroll';
import NothingFound from '../../common/NothingFound';
import ChatMessage from './ChatMessage';
import DateSuggest from './DateSuggest';
import LeftSearchResultTopic from './LeftSearchResultTopic';

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
  foundTopicIds?: number[];
  searchChatId?: string;
  lastSyncTime?: number;
};

const runThrottled = throttle((cb) => cb(), 500, true);

const ChatMessageResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  dateSearchQuery,
  foundIds,
  globalMessagesByChatId,
  chatsById,
  fetchingStatus,
  lastSyncTime,
  foundTopicIds,
  searchChatId,
  onSearchDateSelect,
  onReset,
}) => {
  const { searchMessagesGlobal, openChat } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (lastSyncTime && direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: 'text',
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchQuery` is required to prevent infinite message loading
  }, [lastSyncTime, searchMessagesGlobal, searchQuery]);

  const handleTopicClick = useCallback(
    (id: number) => {
      openChat({ id: searchChatId, threadId: id, shouldReplaceHistory: true });

      if (!isMobile) {
        onReset();
      }
    },
    [openChat, searchChatId, isMobile, onReset],
  );

  const foundMessages = useMemo(() => {
    if (!foundIds || foundIds.length === 0) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds
      .map((id) => {
        const [chatId, messageId] = id.split('_');

        return globalMessagesByChatId?.[chatId]?.byId[Number(messageId)];
      })
      .filter(Boolean)
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

  const nothingFound = fetchingStatus && !fetchingStatus.chats && !fetchingStatus.messages && !foundMessages.length
    && !foundTopicIds?.length;

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
        {Boolean(foundTopicIds?.length) && (
          <div className="pb-2">
            <h3 className="section-heading topic-search-heading" dir={lang.isRtl ? 'auto' : undefined}>
              {lang('Topics')}
            </h3>
            {foundTopicIds!.map((id) => {
              return (
                <LeftSearchResultTopic
                  chatId={searchChatId!}
                  topicId={id}
                  onClick={handleTopicClick}
                />
              );
            })}
          </div>
        )}
        {Boolean(foundMessages.length) && (
          <div className="pb-2">
            <h3 className="section-heading topic-search-heading" dir={lang.isRtl ? 'auto' : undefined}>
              {lang('SearchMessages')}
            </h3>
            {foundMessages.map(renderFoundMessage)}
          </div>
        )}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { byId: chatsById } = global.chats;
    const { currentUserId, messages: { byChatId: globalMessagesByChatId }, lastSyncTime } = global;
    const {
      fetchingStatus, resultsByType, foundTopicIds, chatId: searchChatId,
    } = selectTabState(global).globalSearch;

    const { foundIds } = (resultsByType?.text) || {};

    return {
      currentUserId,
      foundIds,
      globalMessagesByChatId,
      chatsById,
      fetchingStatus,
      foundTopicIds,
      lastSyncTime,
      searchChatId,
    };
  },
)(ChatMessageResults));
