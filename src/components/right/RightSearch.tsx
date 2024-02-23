import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiMessage, ApiPeer, ApiReaction, ApiReactionKey, ApiSavedReactionTag,
} from '../../api/types';
import type { ThreadId } from '../../types';

import { ANONYMOUS_USER_ID, REPLIES_USER_ID } from '../../config';
import { getIsSavedDialog, getReactionKey, isSameReaction } from '../../global/helpers';
import {
  selectChatMessages,
  selectCurrentTextSearch,
  selectForwardedSender,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectSender,
} from '../../global/selectors';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { debounce } from '../../util/schedulers';
import { renderMessageSummary } from '../common/helpers/renderMessageText';

import useHistoryBack from '../../hooks/useHistoryBack';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Avatar from '../common/Avatar';
import FullNameTitle from '../common/FullNameTitle';
import LastMessageMeta from '../common/LastMessageMeta';
import SavedTagButton from '../middle/message/reactions/SavedTagButton';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';

import './RightSearch.scss';

export type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  messagesById?: Record<number, ApiMessage>;
  query?: string;
  savedTags?: Record<ApiReactionKey, ApiSavedReactionTag>;
  searchTag?: ApiReaction;
  totalCount?: number;
  foundIds?: number[];
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

const RightSearch: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isActive,
  messagesById,
  query,
  totalCount,
  foundIds,
  savedTags,
  searchTag,
  isSavedMessages,
  isCurrentUserPremium,
  onClose,
}) => {
  const {
    searchTextMessagesLocal,
    setLocalTextSearchTag,
    focusMessage,
    openPremiumModal,
    loadSavedReactionTags,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const tagsRef = useRef<HTMLDivElement>(null);

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

  const tags = useMemo(() => {
    if (!savedTags) return undefined;
    return Object.values(savedTags);
  }, [savedTags]);

  const hasTags = Boolean(tags?.length);
  const areTagsDisabled = hasTags && !isCurrentUserPremium;

  useHorizontalScroll(tagsRef, !hasTags);

  useEffect(() => {
    if (isActive) loadSavedReactionTags();
  }, [hasTags, isActive]);

  const handleSearchTextMessagesLocal = useLastCallback(() => {
    runDebouncedForSearch(searchTextMessagesLocal);
  });

  const handleTagClick = useLastCallback((tag: ApiReaction) => {
    if (areTagsDisabled) {
      openPremiumModal({
        initialSection: 'saved_tags',
      });
      return;
    }

    if (isSameReaction(tag, searchTag)) {
      setLocalTextSearchTag({ tag: undefined });
      return;
    }

    setLocalTextSearchTag({ tag });
    handleSearchTextMessagesLocal();
  });

  const [viewportIds, getMore] = useInfiniteScroll(handleSearchTextMessagesLocal, foundIds);

  const viewportResults = useMemo(() => {
    if ((!query && !searchTag) || !viewportIds?.length || !messagesById) {
      return MEMO_EMPTY_ARRAY;
    }

    return viewportIds.map((id) => {
      const message = messagesById[id];
      if (!message) {
        return undefined;
      }

      const global = getGlobal();

      const originalSender = (isSavedMessages || chatId === REPLIES_USER_ID || chatId === ANONYMOUS_USER_ID)
        ? selectForwardedSender(global, message) : undefined;
      const messageSender = selectSender(global, message);

      const senderPeer = originalSender || messageSender;

      const hiddenForwardTitle = message.forwardInfo?.hiddenUserName;

      return {
        message,
        senderPeer,
        hiddenForwardTitle,
        onClick: () => focusMessage({ chatId, threadId, messageId: id }),
      };
    }).filter(Boolean);
  }, [query, searchTag, viewportIds, messagesById, isSavedMessages, chatId, threadId]);

  const handleKeyDown = useKeyboardListNavigation(containerRef, true, (index) => {
    const foundResult = viewportResults?.[index === -1 ? 0 : index];
    if (foundResult) {
      foundResult.onClick();
    }
  }, '.ListItem-button', true);

  const renderSearchResult = ({
    message, senderPeer, hiddenForwardTitle, onClick,
  }: {
    message: ApiMessage;
    senderPeer?: ApiPeer;
    hiddenForwardTitle?: string;
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
          text={hiddenForwardTitle}
        />
        <div className="info">
          <div className="search-result-message-top">
            {senderPeer && <FullNameTitle peer={senderPeer} withEmojiStatus />}
            {!senderPeer && hiddenForwardTitle}
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
      {hasTags && (
        <div
          ref={tagsRef}
          className="search-tags custom-scroll-x no-scrollbar"
          key="search-tags"
        >
          {tags.map((tag) => (
            <SavedTagButton
              containerId="local-search"
              key={getReactionKey(tag.reaction)}
              reaction={tag.reaction}
              tag={tag}
              withCount
              isDisabled={areTagsDisabled}
              isChosen={isSameReaction(tag.reaction, searchTag)}
              onClick={handleTagClick}
            />
          ))}
        </div>
      )}
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
  (global, { chatId, threadId }): StateProps => {
    const messagesById = selectChatMessages(global, chatId);
    if (!messagesById) {
      return {};
    }

    const { query, savedTag, results } = selectCurrentTextSearch(global) || {};
    const { totalCount, foundIds } = results || {};

    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

    const savedTags = isSavedMessages && !isSavedDialog ? global.savedReactionTags?.byKey : undefined;

    return {
      messagesById,
      query,
      totalCount,
      foundIds,
      isSavedMessages,
      savedTags,
      searchTag: savedTag,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(RightSearch));
