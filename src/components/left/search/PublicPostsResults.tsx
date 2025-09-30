import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { getGlobal } from '../../../global';

import type { ApiMessage, ApiSearchPostsFlood } from '../../../api/types';
import type { AnimationLevel } from '../../../types';
import { LoadMoreDirection } from '../../../types';

import { selectTabState } from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { parseSearchResultKey, type SearchResultKey } from '../../../util/keys/searchResultKey';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { throttle } from '../../../util/schedulers';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import NothingFound from '../../common/NothingFound';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Transition from '../../ui/Transition';
import ChatMessage from './ChatMessage';
import PublicPostsSearchLauncher from './PublicPostsSearchLauncher.tsx';

export type OwnProps = {
  searchQuery?: string;
};

type StateProps = {
  foundIds?: SearchResultKey[];
  globalMessagesByChatId?: Record<string, { byId: Record<number, ApiMessage> }>;
  searchFlood?: ApiSearchPostsFlood;
  shouldShowSearchLauncher?: boolean;
  isNothingFound?: boolean;
  isLoading?: boolean;
  animationLevel: AnimationLevel;
};

const runThrottled = throttle((cb) => cb(), 500, true);

const PublicPostsResults = ({
  searchQuery,
  foundIds,
  globalMessagesByChatId,
  searchFlood,
  shouldShowSearchLauncher,
  isNothingFound,
  isLoading,
  animationLevel,
}: OwnProps & StateProps) => {
  const { searchMessagesGlobal } = getActions();

  const lang = useLang();

  const handleSearch = useLastCallback(() => {
    if (!searchQuery) return;

    searchMessagesGlobal({
      type: 'publicPosts',
      shouldResetResultsByType: true,
    });
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: 'publicPosts',
        });
      });
    }
  }, []);

  const foundMessages = useMemo(() => {
    if (!foundIds || foundIds.length === 0) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds
      .map((id) => {
        const [chatId, messageId] = parseSearchResultKey(id);
        return globalMessagesByChatId?.[chatId]?.byId[messageId];
      })
      .filter(Boolean);
  }, [foundIds, globalMessagesByChatId]);

  function renderFoundMessage(message: ApiMessage) {
    const chatsById = getGlobal().chats.byId;

    const text = renderMessageSummary(lang, message);
    const chat = chatsById[message.chatId];

    if (!text || !chat) {
      return undefined;
    }

    return (
      <ChatMessage
        key={`${message.chatId}-${message.id}`}
        chatId={message.chatId}
        message={message}
        searchQuery={searchQuery}
      />
    );
  }

  return (
    <Transition
      name={resolveTransitionName('slideOptimized', animationLevel, undefined, lang.isRtl)}
      activeKey={shouldShowSearchLauncher || isLoading ? 0 : 1}
    >
      {shouldShowSearchLauncher || isLoading ? (
        <PublicPostsSearchLauncher
          searchQuery={searchQuery}
          searchFlood={searchFlood}
          onSearch={handleSearch}
          isLoading={isLoading}
        />
      ) : (
        <div className="LeftSearch--content">
          <InfiniteScroll
            key={searchQuery}
            className="search-content custom-scroll chat-list"
            items={foundMessages}
            onLoadMore={handleLoadMore}
            noFastList
          >
            {isNothingFound && (
              <NothingFound
                text={lang('ChatListSearchNoResults')}
                description={lang('ChatListSearchNoResultsDescription')}
                withSticker
              />
            )}
            {Boolean(foundMessages.length) && (
              <div className="pb-2">
                <h3 className="section-heading" dir={lang.isRtl ? 'auto' : undefined}>
                  {lang('PublicPosts')}
                </h3>
                {foundMessages.map(renderFoundMessage)}
              </div>
            )}
          </InfiniteScroll>
        </div>
      )}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { messages: { byChatId: globalMessagesByChatId } } = global;
    const { resultsByType, searchFlood, fetchingStatus } = selectTabState(global).globalSearch;
    const publicPostsResult = resultsByType?.publicPosts;
    const { foundIds } = publicPostsResult || {};
    const isLoading = Boolean(fetchingStatus?.publicPosts && !publicPostsResult);
    const shouldShowSearchLauncher = !publicPostsResult && !isLoading;
    const isNothingFound = publicPostsResult && !foundIds?.length;
    const { animationLevel } = selectSharedSettings(global);

    return {
      foundIds,
      globalMessagesByChatId,
      searchFlood,
      shouldShowSearchLauncher,
      isNothingFound,
      isLoading,
      animationLevel,
    };
  },
)(PublicPostsResults));
