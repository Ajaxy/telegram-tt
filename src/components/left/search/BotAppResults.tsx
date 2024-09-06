import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { filterUsersByName } from '../../../global/helpers';
import { selectTabState } from '../../../global/selectors';
import { throttle } from '../../../util/schedulers';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import NothingFound from '../../common/NothingFound';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Link from '../../ui/Link';
import Loading from '../../ui/Loading';
import LeftSearchResultChat from './LeftSearchResultChat';

export type OwnProps = {
  searchQuery?: string;
};

type StateProps = {
  isSynced?: boolean;
  isLoading?: boolean;
  foundIds?: string[];
  recentBotIds?: string[];
};

const LESS_LIST_ITEMS_AMOUNT = 5;
const runThrottled = throttle((cb) => cb(), 500, true);

const BotAppResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  isSynced,
  isLoading,
  foundIds,
  recentBotIds,
}) => {
  const {
    searchPopularBotApps,
    openChatWithInfo,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const lang = useOldLang();

  const [shouldShowMoreMine, setShouldShowMoreMine] = useState<boolean>(false);

  const filteredFoundIds = useMemo(() => {
    if (!foundIds) return [];
    const recentSet = new Set(recentBotIds);
    const withoutRecent = foundIds.filter((id) => !recentSet.has(id));

    const usersById = getGlobal().users.byId;
    return filterUsersByName(withoutRecent, usersById, searchQuery);
  }, [foundIds, recentBotIds, searchQuery]);

  const handleChatClick = useLastCallback((id: string) => {
    openChatWithInfo({ id, shouldReplaceHistory: true });
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (!isSynced) return;
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchPopularBotApps();
      });
    }
  }, [isSynced]);

  const handleToggleShowMoreMine = useLastCallback(() => {
    setShouldShowMoreMine((prev) => !prev);
  });

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <div ref={containerRef} className="LeftSearch--content">
      <InfiniteScroll
        className="search-content custom-scroll"
        items={filteredFoundIds}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!canRenderContents && <Loading />}
        {canRenderContents && !filteredFoundIds?.length && (
          <NothingFound
            text={lang('ChatList.Search.NoResults')}
            description={lang('ChatList.Search.NoResultsDescription')}
          />
        )}
        {canRenderContents && !searchQuery && Boolean(recentBotIds?.length) && (
          <div className="search-section">
            <h3 className="section-heading">
              {recentBotIds.length > LESS_LIST_ITEMS_AMOUNT && (
                <Link className="Link" onClick={handleToggleShowMoreMine}>
                  {lang(shouldShowMoreMine ? 'ChatList.Search.ShowLess' : 'ChatList.Search.ShowMore')}
                </Link>
              )}
              {lang('SearchAppsMine')}
            </h3>
            {recentBotIds.map((id, index) => {
              if (!shouldShowMoreMine && index >= LESS_LIST_ITEMS_AMOUNT) {
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
        {canRenderContents && filteredFoundIds?.length && (
          <div className="search-section">
            <h3 className="section-heading">{lang('SearchAppsPopular')}</h3>
            {filteredFoundIds.map((id) => {
              return (
                <LeftSearchResultChat
                  chatId={id}
                  onClick={handleChatClick}
                />
              );
            })}
          </div>
        )}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  const globalSearch = selectTabState(global).globalSearch;
  const foundIds = globalSearch.popularBotApps?.peerIds;

  return {
    isSynced: global.isSynced,
    isLoading: !foundIds && globalSearch.fetchingStatus?.botApps,
    foundIds,
    recentBotIds: global.topBotApps.userIds,
  };
})(BotAppResults));
