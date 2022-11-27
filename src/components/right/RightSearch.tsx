import React, {
  useMemo, memo, useRef, useEffect,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiMessage, ApiUser, ApiChat } from '../../api/types';
import type { AnimationLevel } from '../../types';

import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import {
  selectUser,
  selectChatMessages,
  selectChat,
  selectCurrentTextSearch,
} from '../../global/selectors';
import {
  isChatChannel,
} from '../../global/helpers';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { renderMessageSummary } from '../common/helpers/renderMessageText';
import useLang from '../../hooks/useLang';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useHistoryBack from '../../hooks/useHistoryBack';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';

import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import LastMessageMeta from '../common/LastMessageMeta';
import Avatar from '../common/Avatar';
import FullNameTitle from '../common/FullNameTitle';

import './RightSearch.scss';

export type OwnProps = {
  chatId: string;
  threadId: number;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  messagesById?: Record<number, ApiMessage>;
  query?: string;
  totalCount?: number;
  foundIds?: number[];
  animationLevel?: AnimationLevel;
};

const RightSearch: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isActive,
  chat,
  messagesById,
  query,
  totalCount,
  foundIds,
  animationLevel,
  onClose,
}) => {
  const {
    searchTextMessagesLocal,
    focusMessage,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = useLang();
  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }

    disableDirectTextInput();

    return enableDirectTextInput;
  }, [isActive]);

  const [viewportIds, getMore] = useInfiniteScroll(searchTextMessagesLocal, foundIds);

  const viewportResults = useMemo(() => {
    if (!query || !viewportIds?.length || !messagesById) {
      return MEMO_EMPTY_ARRAY;
    }

    return viewportIds.map((id) => {
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
    }).filter(Boolean);
  }, [query, viewportIds, messagesById, chat, focusMessage, chatId, threadId]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, true, (index) => {
    const foundResult = viewportResults?.[index === -1 ? 0 : index];
    if (foundResult) {
      foundResult.onClick();
    }
  }, '.ListItem-button', true);

  const renderSearchResult = ({
    message, senderUser, senderChat, onClick,
  }: {
    message: ApiMessage;
    senderUser?: ApiUser;
    senderChat?: ApiChat;
    onClick: NoneToVoidFunction;
  }) => {
    const text = renderMessageSummary(lang, message, undefined, query);

    return (
      <ListItem
        key={message.id}
        teactOrderKey={-message.date}
        className="chat-item-clickable search-result-message m-0"
        onClick={onClick}
      >
        <Avatar chat={senderChat} user={senderUser} animationLevel={animationLevel} withVideo />
        <div className="info">
          <div className="search-result-message-top">
            <FullNameTitle peer={(senderUser || senderChat)!} />
            <LastMessageMeta message={message} />
          </div>
          <div className="subtitle" dir="auto">
            {text}
          </div>
        </div>
      </ListItem>
    );
  };

  const isOnTop = viewportIds?.[0] === foundIds?.[0];

  return (
    <InfiniteScroll
      ref={containerRef}
      className="RightSearch custom-scroll"
      items={viewportResults}
      preloadBackwards={0}
      onLoadMore={getMore}
      onKeyDown={handleKeyDown}
    >
      {isOnTop && (
        <p key="helper-text" className="helper-text" dir="auto">
          {!query ? (
            lang('lng_dlg_search_for_messages')
          ) : (totalCount === 0 || !viewportResults.length) ? (
            lang('lng_search_no_results')
          ) : totalCount === 1 ? (
            '1 message found'
          ) : (
            `${(viewportResults.length && (totalCount || viewportResults.length))} messages found`
          )}
        </p>
      )}
      {viewportResults.map(renderSearchResult)}
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
      animationLevel: global.settings.byKey.animationLevel,
    };
  },
)(RightSearch));
