import React, {
  FC, memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiUser, ApiChat, ApiMessage } from '../../../api/types';
import { GlobalActions } from '../../../global/types';
import { LoadMoreDirection } from '../../../types';

import { IS_MOBILE_SCREEN } from '../../../util/environment';
import searchWords from '../../../util/searchWords';
import { unique, pick } from '../../../util/iteratees';
import { getUserFullName, getMessageSummaryText, sortChatIds } from '../../../modules/helpers';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import useLang from '../../../hooks/useLang';

import InfiniteScroll from '../../ui/InfiniteScroll';
import LeftSearchResultChat from './LeftSearchResultChat';
import RecentContacts from './RecentContacts';
import ChatMessage from './ChatMessage';
import DateSuggest from './DateSuggest';
import Link from '../../ui/Link';
import NothingFound from '../../common/NothingFound';
import PickerSelectedItem from '../../common/PickerSelectedItem';

export type OwnProps = {
  searchQuery?: string;
  dateSearchQuery?: string;
  searchDate?: number;
  onReset: () => void;
  onSearchDateSelect: (value: Date) => void;
};

type StateProps = {
  currentUserId?: number;
  localContactIds?: number[];
  localChatIds?: number[];
  localUserIds?: number[];
  globalChatIds?: number[];
  globalUserIds?: number[];
  foundIds?: string[];
  globalMessagesByChatId?: Record<number, { byId: Record<number, ApiMessage> }>;
  chatsById: Record<number, ApiChat>;
  usersById: Record<number, ApiUser>;
  fetchingStatus?: { chats?: boolean; messages?: boolean };
  lastSyncTime?: number;
};

type DispatchProps = Pick<GlobalActions, (
  'openChat' | 'addRecentlyFoundChatId' | 'searchMessagesGlobal' | 'setGlobalSearchChatId'
)>;

const MIN_QUERY_LENGTH_FOR_GLOBAL_SEARCH = 4;
const LESS_LIST_ITEMS_AMOUNT = 3;

const runThrottled = throttle((cb) => cb(), 500, true);

const ChatResults: FC<OwnProps & StateProps & DispatchProps> = ({
  searchQuery, searchDate, dateSearchQuery, currentUserId,
  localContactIds, localChatIds, localUserIds, globalChatIds, globalUserIds,
  foundIds, globalMessagesByChatId, chatsById, usersById, fetchingStatus, lastSyncTime,
  onReset, onSearchDateSelect, openChat, addRecentlyFoundChatId, searchMessagesGlobal, setGlobalSearchChatId,
}) => {
  const lang = useLang();

  const [shouldShowMoreLocal, setShouldShowMoreLocal] = useState<boolean>(false);
  const [shouldShowMoreGlobal, setShouldShowMoreGlobal] = useState<boolean>(false);

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (lastSyncTime && direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: 'text',
          query: searchQuery,
        });
      });
    }
  }, [lastSyncTime, searchMessagesGlobal, searchQuery]);

  const handleChatClick = useCallback(
    (id: number) => {
      openChat({ id });

      if (id !== currentUserId) {
        addRecentlyFoundChatId({ id });
      }

      if (!IS_MOBILE_SCREEN) {
        onReset();
      }
    },
    [currentUserId, openChat, addRecentlyFoundChatId, onReset],
  );

  const handlePickerItemClick = useCallback((id: number) => {
    setGlobalSearchChatId({ id });
  }, [setGlobalSearchChatId]);

  const localResults = useMemo(() => {
    if (!searchQuery || (searchQuery.startsWith('@') && searchQuery.length < 2)) {
      return MEMO_EMPTY_ARRAY;
    }

    const foundContactIds = localContactIds
      ? localContactIds.filter((id) => {
        const user = usersById[id];
        if (!user) {
          return false;
        }

        const fullName = getUserFullName(user);
        return (fullName && searchWords(fullName, searchQuery)) || searchWords(user.username, searchQuery);
      })
      : [];

    return [
      ...(currentUserId && searchWords(lang('SavedMessages'), searchQuery) ? [currentUserId] : []),
      ...sortChatIds(unique([
        ...foundContactIds,
        ...(localChatIds || []),
        ...(localUserIds || []),
      ]), chatsById),
    ];
  }, [searchQuery, localContactIds, currentUserId, lang, localChatIds, localUserIds, chatsById, usersById]);

  const globalResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < MIN_QUERY_LENGTH_FOR_GLOBAL_SEARCH || !globalChatIds || !globalUserIds) {
      return MEMO_EMPTY_ARRAY;
    }

    return sortChatIds(unique([...globalChatIds, ...globalUserIds]), chatsById, true);
  }, [chatsById, globalChatIds, globalUserIds, searchQuery]);

  const foundMessages = useMemo(() => {
    if ((!searchQuery && !searchDate) || !foundIds || foundIds.length === 0) {
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
  }, [foundIds, globalMessagesByChatId, searchQuery, searchDate]);

  const handleClickShowMoreLocal = useCallback(() => {
    setShouldShowMoreLocal(!shouldShowMoreLocal);
  }, [shouldShowMoreLocal]);

  const handleClickShowMoreGlobal = useCallback(() => {
    setShouldShowMoreGlobal(!shouldShowMoreGlobal);
  }, [shouldShowMoreGlobal]);

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

  const nothingFound = fetchingStatus && !fetchingStatus.chats && !fetchingStatus.messages
    && !localResults.length && !globalResults.length && !foundMessages.length;

  if (!searchQuery && !searchDate) {
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
      {!!localResults.length && (
        <div className="chat-selection no-selection no-scrollbar">
          {localResults.map((id) => (
            <PickerSelectedItem
              chatOrUserId={id}
              onClick={handlePickerItemClick}
              clickArg={id}
            />
          ))}
        </div>
      )}
      {!!localResults.length && (
        <div className="search-section">
          <h3 className="section-heading">
            {localResults.length > LESS_LIST_ITEMS_AMOUNT && (
              <Link onClick={handleClickShowMoreLocal}>
                {lang(shouldShowMoreLocal ? 'ChatList.Search.ShowLess' : 'ChatList.Search.ShowMore')}
              </Link>
            )}
            {lang('DialogList.SearchSectionDialogs')}
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
      {!!globalResults.length && (
        <div className="search-section">
          <h3 className="section-heading">
            {globalResults.length > LESS_LIST_ITEMS_AMOUNT && (
              <Link onClick={handleClickShowMoreGlobal}>
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
      {!!foundMessages.length && (
        <div className="search-section">
          <h3 className="section-heading">{lang('SearchMessages')}</h3>
          {foundMessages.map(renderFoundMessage)}
        </div>
      )}
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { byId: chatsById } = global.chats;
    const { byId: usersById } = global.users;

    const { userIds: localContactIds } = global.contactList || {};

    if (!localContactIds) {
      return {
        chatsById,
        usersById,
      };
    }

    const { currentUserId, messages, lastSyncTime } = global;
    const {
      fetchingStatus, globalResults, localResults, resultsByType,
    } = global.globalSearch;
    const { chatIds: globalChatIds, userIds: globalUserIds } = globalResults || {};
    const { chatIds: localChatIds, userIds: localUserIds } = localResults || {};
    const { byChatId: globalMessagesByChatId } = messages;
    const { foundIds } = (resultsByType && resultsByType.text) || {};

    return {
      currentUserId,
      localContactIds,
      localChatIds,
      localUserIds,
      globalChatIds,
      globalUserIds,
      foundIds,
      globalMessagesByChatId,
      chatsById,
      usersById,
      fetchingStatus,
      lastSyncTime,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat',
    'addRecentlyFoundChatId',
    'searchMessagesGlobal',
    'setGlobalSearchChatId',
  ]),
)(ChatResults));
