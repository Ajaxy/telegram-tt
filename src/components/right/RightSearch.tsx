import React, { FC, useMemo, memo } from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../lib/teact/teactn';

import { ApiMessage, ApiUser, ApiChat } from '../../api/types';
import { GlobalActions } from '../../global/types';

import {
  selectUser,
  selectChatMessages,
  selectChat,
  selectCurrentTextSearch,
} from '../../modules/selectors';
import {
  getMessageSummaryText,
  getChatTitle,
  getUserFullName,
  isChatChannel,
} from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';
import { orderBy, pick } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';

import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import LastMessageMeta from '../common/LastMessageMeta';
import Avatar from '../common/Avatar';

import './RightSearch.scss';

export type OwnProps = {
  chatId: number;
  threadId: number;
};

type StateProps = {
  chat?: ApiChat;
  messagesById?: Record<number, ApiMessage>;
  query?: string;
  totalCount?: number;
  foundIds?: number[];
};

type DispatchProps = Pick<GlobalActions, 'searchTextMessagesLocal' | 'focusMessage'>;

interface Result {
  message: ApiMessage;
  senderUser?: ApiUser;
  senderChat?: ApiChat;
  onClick: NoneToVoidFunction;
}

const RightSearch: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  threadId,
  chat,
  messagesById,
  query,
  totalCount,
  foundIds,
  searchTextMessagesLocal,
  focusMessage,
}) => {
  const lang = useLang();

  const foundResults = useMemo(() => {
    if (!query || !foundIds || !foundIds.length || !messagesById) {
      return MEMO_EMPTY_ARRAY;
    }

    const results = foundIds.map((id) => {
      const message = messagesById[id];
      if (!message) {
        return undefined;
      }

      const senderUser = message.senderId ? selectUser(getGlobal(), message.senderId) : undefined;

      let senderChat;
      if (chat && isChatChannel(chat)) {
        senderChat = chat;
      } else if (message.forwardInfo) {
        const { isChannelPost, fromChatId } = message.forwardInfo;
        senderChat = isChannelPost && fromChatId ? selectChat(getGlobal(), fromChatId) : undefined;
      } else {
        senderChat = message.senderId ? selectChat(getGlobal(), message.senderId) : undefined;
      }

      return {
        message,
        senderUser,
        senderChat,
        onClick: () => focusMessage({ chatId, threadId, messageId: id }),
      };
    }).filter(Boolean) as Result[];

    return orderBy(results, ({ message }) => message.date, 'desc');
  }, [chatId, threadId, focusMessage, foundIds, chat, messagesById, query]);

  const renderSearchResult = ({
    message, senderUser, senderChat, onClick,
  }: Result) => {
    const title = senderChat ? getChatTitle(lang, senderChat) : getUserFullName(senderUser);
    const text = getMessageSummaryText(lang, message);

    return (
      <ListItem className="chat-item-clickable search-result-message m-0" onClick={onClick}>
        <Avatar chat={senderChat} user={senderUser} />
        <div className="info">
          <div className="title">
            <h3>{title && renderText(title)}</h3>
            <LastMessageMeta message={message} />
          </div>
          <div className="subtitle">
            {renderText(text, ['emoji', 'highlight'], { highlight: query })}
          </div>
        </div>
      </ListItem>
    );
  };

  return (
    <InfiniteScroll
      className="RightSearch custom-scroll"
      items={foundResults}
      preloadBackwards={0}
      onLoadMore={searchTextMessagesLocal}
      noFastList
    >
      <p className="helper-text">
        {!query ? (
          'Search messages'
        ) : totalCount === 1 ? (
          '1 message found'
        ) : (
          `${(foundResults.length && (totalCount || foundResults.length)) || 'No'} messages found`
        )}
      </p>
      {foundResults.map(renderSearchResult)}
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const messagesById = chat && selectChatMessages(global, chat.id);
    if (!chat || !messagesById) {
      return {};
    }

    const { query, results } = selectCurrentTextSearch(global) || {};
    const { totalCount, foundIds } = results || {};

    return {
      chat,
      messagesById,
      query,
      totalCount,
      foundIds,
    };
  },
  (global, actions): DispatchProps => pick(actions, ['searchTextMessagesLocal', 'focusMessage']),
)(RightSearch));
