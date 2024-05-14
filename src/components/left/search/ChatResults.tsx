import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { ALL_FOLDER_ID, GLOBAL_SUGGESTED_CHANNELS_ID } from '../../../config';
import {
  filterChatsByName,
  filterUsersByName,
  isChatChannel,
} from '../../../global/helpers';
import { selectSimilarChannelIds, selectTabState } from '../../../global/selectors';
import { getOrderedIds } from '../../../util/folderManager';
import { unique } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';
import sortChatIds from '../../common/helpers/sortChatIds';

import useAppLayout from '../../../hooks/useAppLayout';
import useEffectOnce from '../../../hooks/useEffectOnce';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';

import NothingFound from '../../common/NothingFound';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Link from '../../ui/Link';
import ChatMessage from './ChatMessage';
import DateSuggest from './DateSuggest';
import LeftSearchResultChat from './LeftSearchResultChat';
import RecentContacts from './RecentContacts';

export type OwnProps = {
  searchQuery?: string;
  dateSearchQuery?: string;
  searchDate?: number;
  isChannelList?: boolean;
  onReset: () => void;
  onSearchDateSelect: (value: Date) => void;
};

type StateProps = {
  currentUserId?: string;
  contactIds?: string[];
  accountChatIds?: string[];
  accountUserIds?: string[];
  globalChatIds?: string[];
  globalUserIds?: string[];
  foundIds?: string[];
  globalMessagesByChatId?: Record<string, { byId: Record<number, ApiMessage> }>;
  fetchingStatus?: { chats?: boolean; messages?: boolean };
  suggestedChannelIds?: string[];
};

const MIN_QUERY_LENGTH_FOR_GLOBAL_SEARCH = 4;
const LESS_LIST_ITEMS_AMOUNT = 5;

const runThrottled = throttle((cb) => cb(), 500, false);

const ChatResults: FC<OwnProps & StateProps> = ({
  isChannelList,
  searchQuery,
  searchDate,
  dateSearchQuery,
  currentUserId,
  contactIds,
  accountChatIds,
  accountUserIds,
  globalChatIds,
  globalUserIds,
  foundIds,
  globalMessagesByChatId,
  fetchingStatus,
  suggestedChannelIds,
  onReset,
  onSearchDateSelect,
}) => {
  const {
    openChat, addRecentlyFoundChatId, searchMessagesGlobal, setGlobalSearchChatId, loadChannelRecommendations,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const chatSelectionRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  const { isMobile } = useAppLayout();
  const [shouldShowMoreLocal, setShouldShowMoreLocal] = useState<boolean>(false);
  const [shouldShowMoreGlobal, setShouldShowMoreGlobal] = useState<boolean>(false);

  useEffectOnce(() => {
    if (isChannelList) loadChannelRecommendations({});
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: isChannelList ? 'channels' : 'text',
        });
      });
    }
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps -- `searchQuery` is required to prevent infinite message loading
  }, [searchQuery]);

  const handleChatClick = useCallback(
    (id: string) => {
      openChat({ id, shouldReplaceHistory: true });

      if (id !== currentUserId) {
        addRecentlyFoundChatId({ id });
      }

      if (!isMobile) {
        onReset();
      }
    },
    [openChat, currentUserId, isMobile, addRecentlyFoundChatId, onReset],
  );

  const handlePickerItemClick = useCallback((id: string) => {
    setGlobalSearchChatId({ id });
  }, [setGlobalSearchChatId]);

  const localResults = useMemo(() => {
    if (!isChannelList && (!searchQuery || (searchQuery.startsWith('@') && searchQuery.length < 2))) {
      return MEMO_EMPTY_ARRAY;
    }

    // No need for expensive global updates, so we avoid them
    const usersById = getGlobal().users.byId;
    const chatsById = getGlobal().chats.byId;

    const orderedChatIds = getOrderedIds(ALL_FOLDER_ID) ?? [];
    const filteredChatIds = orderedChatIds.filter((id) => {
      if (!isChannelList) return true;
      const chat = chatsById[id];
      return chat && isChatChannel(chat);
    });
    const localChatIds = filterChatsByName(lang, filteredChatIds, chatsById, searchQuery, currentUserId);

    if (isChannelList) return localChatIds;

    const contactIdsWithMe = [
      ...(currentUserId ? [currentUserId] : []),
      ...(contactIds || []),
    ];

    const localContactIds = filterUsersByName(
      contactIdsWithMe, usersById, searchQuery, currentUserId, lang('SavedMessages'),
    );

    const localPeerIds = unique([
      ...localContactIds,
      ...localChatIds,
    ]);

    const accountPeerIds = unique([
      ...(accountChatIds ?? []),
      ...(accountUserIds ?? []),
    ].filter((accountPeerId) => !localPeerIds.includes(accountPeerId)));

    return [
      ...sortChatIds(localPeerIds, undefined, currentUserId ? [currentUserId] : undefined),
      ...sortChatIds(accountPeerIds),
    ];
  }, [searchQuery, lang, currentUserId, contactIds, accountChatIds, accountUserIds, isChannelList]);

  useHorizontalScroll(chatSelectionRef, !localResults.length || isChannelList, true);

  const globalResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < MIN_QUERY_LENGTH_FOR_GLOBAL_SEARCH || !globalChatIds || !globalUserIds) {
      return MEMO_EMPTY_ARRAY;
    }

    // No need for expensive global updates, so we avoid them
    const chatsById = getGlobal().chats.byId;

    const ids = unique([...globalChatIds, ...globalUserIds]);
    const filteredIds = ids.filter((id) => {
      if (!isChannelList) return true;
      const chat = chatsById[id];
      return chat && isChatChannel(chat);
    });

    return sortChatIds(filteredIds, true);
  }, [globalChatIds, globalUserIds, isChannelList, searchQuery]);

  const foundMessages = useMemo(() => {
    if ((!searchQuery && !searchDate) || !foundIds || foundIds.length === 0) {
      return MEMO_EMPTY_ARRAY;
    }

    // No need for expensive global updates, so we avoid them
    const chatsById = getGlobal().chats.byId;

    return foundIds
      .map((id) => {
        const [chatId, messageId] = id.split('_');
        const chat = chatsById[chatId];
        if (!chat) return undefined;
        if (isChannelList && !isChatChannel(chat)) return undefined;

        return globalMessagesByChatId?.[chatId]?.byId[Number(messageId)];
      })
      .filter(Boolean);
  }, [searchQuery, searchDate, foundIds, isChannelList, globalMessagesByChatId]);

  const handleClickShowMoreLocal = useCallback(() => {
    setShouldShowMoreLocal(!shouldShowMoreLocal);
  }, [shouldShowMoreLocal]);

  const handleClickShowMoreGlobal = useCallback(() => {
    setShouldShowMoreGlobal(!shouldShowMoreGlobal);
  }, [shouldShowMoreGlobal]);

  function renderFoundMessage(message: ApiMessage) {
    const chatsById = getGlobal().chats.byId;

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

  const nothingFound = fetchingStatus && !fetchingStatus.chats && !fetchingStatus.messages
    && !localResults.length && !globalResults.length && !foundMessages.length;

  if (!searchQuery && !searchDate && !isChannelList) {
    return <RecentContacts onReset={onReset} />;
  }

  return (
    <InfiniteScroll
      className="LeftSearch custom-scroll"
      items={foundMessages}
      onLoadMore={handleLoadMore}
      // To prevent scroll jumps caused by delayed local results rendering
      noScrollRestoreOnTop
      noFastList
    >
      {dateSearchQuery && (
        <div className="chat-selection no-scrollbar">
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
      {Boolean(localResults.length) && !isChannelList && (
        <div
          className="chat-selection no-scrollbar"
          dir={lang.isRtl ? 'rtl' : undefined}
          ref={chatSelectionRef}
        >
          {localResults.map((id) => (
            <PickerSelectedItem
              peerId={id}
              onClick={handlePickerItemClick}
              clickArg={id}
            />
          ))}
        </div>
      )}
      {Boolean(localResults.length) && (
        <div className="search-section">
          <h3 className="section-heading" dir={lang.isRtl ? 'auto' : undefined}>
            {localResults.length > LESS_LIST_ITEMS_AMOUNT && (
              <Link className="Link" onClick={handleClickShowMoreLocal}>
                {lang(shouldShowMoreLocal ? 'ChatList.Search.ShowLess' : 'ChatList.Search.ShowMore')}
              </Link>
            )}
            {lang(isChannelList ? 'SearchMyChannels' : 'DialogList.SearchSectionDialogs')}
          </h3>
          {localResults.map((id, index) => {
            if (!shouldShowMoreLocal && index >= LESS_LIST_ITEMS_AMOUNT) {
              return undefined;
            }

            return (
              <LeftSearchResultChat
                chatId={id}
                onClick={handleChatClick}
              />
            );
          })}
        </div>
      )}
      {Boolean(globalResults.length) && (
        <div className="search-section">
          <h3 className="section-heading" dir={lang.isRtl ? 'auto' : undefined}>
            {globalResults.length > LESS_LIST_ITEMS_AMOUNT && (
              <Link className="Link" onClick={handleClickShowMoreGlobal}>
                {lang(shouldShowMoreGlobal ? 'ChatList.Search.ShowLess' : 'ChatList.Search.ShowMore')}
              </Link>
            )}
            {lang('DialogList.SearchSectionGlobal')}
          </h3>
          {globalResults.map((id, index) => {
            if (!shouldShowMoreGlobal && index >= LESS_LIST_ITEMS_AMOUNT) {
              return undefined;
            }

            return (
              <LeftSearchResultChat
                chatId={id}
                withUsername
                onClick={handleChatClick}
              />
            );
          })}
        </div>
      )}
      {Boolean(suggestedChannelIds?.length) && !searchQuery && (
        <div className="search-section">
          <h3 className="section-heading" dir={lang.isRtl ? 'auto' : undefined}>
            {lang('SearchRecommendedChannels')}
          </h3>
          {suggestedChannelIds.map((id) => {
            return (
              <LeftSearchResultChat
                chatId={id}
                withUsername
                onClick={handleChatClick}
              />
            );
          })}
        </div>
      )}
      {Boolean(foundMessages.length) && (
        <div className="search-section">
          <h3 className="section-heading" dir={lang.isRtl ? 'auto' : undefined}>{lang('SearchMessages')}</h3>
          {foundMessages.map(renderFoundMessage)}
        </div>
      )}
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isChannelList }): StateProps => {
    const { userIds: contactIds } = global.contactList || {};
    const {
      currentUserId, messages,
    } = global;

    if (!contactIds) {
      return {};
    }

    const {
      fetchingStatus, globalResults, localResults, resultsByType,
    } = selectTabState(global).globalSearch;
    const { chatIds: globalChatIds, userIds: globalUserIds } = globalResults || {};
    const { chatIds: accountChatIds, userIds: accountUserIds } = localResults || {};
    const { byChatId: globalMessagesByChatId } = messages;
    const foundIds = resultsByType?.[isChannelList ? 'channels' : 'text']?.foundIds;
    const { similarChannelIds } = selectSimilarChannelIds(global, GLOBAL_SUGGESTED_CHANNELS_ID) || {};

    return {
      currentUserId,
      contactIds,
      accountChatIds,
      accountUserIds,
      globalChatIds,
      globalUserIds,
      foundIds,
      globalMessagesByChatId,
      fetchingStatus,
      suggestedChannelIds: similarChannelIds,
    };
  },
)(ChatResults));
