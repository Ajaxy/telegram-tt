import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiMessage, ApiPeer } from '../../api/types';

import {
  selectChat,
  selectChatMessages,
  selectCurrentTextSearch,
  selectUser,
} from '../../global/selectors';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { renderMessageSummary } from '../common/helpers/renderMessageText';

import useHistoryBack from '../../hooks/useHistoryBack';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';

import Avatar from '../common/Avatar';
import FullNameTitle from '../common/FullNameTitle';
import LastMessageMeta from '../common/LastMessageMeta';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';

import './RightSearch.scss';

export type OwnProps = {
  chatId: string;
  threadId: number;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  messagesById?: Record<number, ApiMessage>;
  query?: string;
  totalCount?: number;
  foundIds?: number[];
};

const RightSearch: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isActive,
  messagesById,
  query,
  totalCount,
  foundIds,
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

  const handleSearchTextMessagesLocal = useCallback(() => {
    searchTextMessagesLocal();
  }, [searchTextMessagesLocal]);

  const [viewportIds, getMore] = useInfiniteScroll(handleSearchTextMessagesLocal, foundIds);

  const viewportResults = useMemo(() => {
    if (!query || !viewportIds?.length || !messagesById) {
      return MEMO_EMPTY_ARRAY;
    }

    return viewportIds.map((id) => {
      const message = messagesById[id];
      if (!message) {
        return undefined;
      }

      const global = getGlobal();

      let senderPeer = message.senderId
        ? selectUser(global, message.senderId) || selectChat(global, message.senderId)
        : undefined;

      if (!senderPeer && message.forwardInfo) {
        const { isChannelPost, fromChatId } = message.forwardInfo;
        const originalSender = isChannelPost && fromChatId ? selectChat(global, fromChatId) : undefined;
        if (originalSender) senderPeer = originalSender;
      }

      if (!senderPeer) {
        return undefined;
      }

      return {
        message,
        senderPeer: senderPeer!,
        onClick: () => focusMessage({ chatId, threadId, messageId: id }),
      };
    }).filter(Boolean);
  }, [query, viewportIds, messagesById, focusMessage, chatId, threadId]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, true, (index) => {
    const foundResult = viewportResults?.[index === -1 ? 0 : index];
    if (foundResult) {
      foundResult.onClick();
    }
  }, '.ListItem-button', true);

  const renderSearchResult = ({
    message, senderPeer, onClick,
  }: {
    message: ApiMessage;
    senderPeer: ApiPeer;
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
        <Avatar
          peer={senderPeer}
        />
        <div className="info">
          <div className="search-result-message-top">
            <FullNameTitle peer={senderPeer} withEmojiStatus />
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
    const messagesById = selectChatMessages(global, chatId);
    if (!messagesById) {
      return {};
    }

    const { query, results } = selectCurrentTextSearch(global) || {};
    const { totalCount, foundIds } = results || {};

    return {
      messagesById,
      query,
      totalCount,
      foundIds,
    };
  },
)(RightSearch));
