import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectTabState } from '../../../global/selectors';
import { throttle } from '../../../util/schedulers';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import NothingFound from '../../common/NothingFound';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Link from '../../ui/Link';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition.tsx';
import LeftSearchResultChat from './LeftSearchResultChat';

export type OwnProps = {
  searchQuery?: string;
};

type StateProps = {
  isLoading?: boolean;
  foundIds?: string[];
  recentBotIds?: string[];
};

const LESS_LIST_ITEMS_AMOUNT = 5;
const runThrottled = throttle((cb) => cb(), 500, true);

const BotAppResults: FC<OwnProps & StateProps> = ({
  searchQuery,
  isLoading,
  foundIds,
  recentBotIds,
}) => {
  const {
    searchPopularBotApps,
    openChatWithInfo,
  } = getActions();

  const containerRef = useRef<HTMLDivElement>();

  const lang = useOldLang();

  const [shouldShowMoreMine, setShouldShowMoreMine] = useState<boolean>(false);

  const filteredFoundIds = useMemo(() => {
    if (!foundIds) return [];
    const recentSet = new Set(recentBotIds);
    const withoutRecent = foundIds.filter((id) => !recentSet.has(id));

    return filterPeersByQuery({ ids: withoutRecent, query: searchQuery, type: 'user' });
  }, [foundIds, recentBotIds, searchQuery]);

  const handleChatClick = useLastCallback((id: string) => {
    openChatWithInfo({ id, shouldReplaceHistory: true });
  });

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchPopularBotApps();
      });
    }
  }, []);

  const handleToggleShowMoreMine = useLastCallback(() => {
    setShouldShowMoreMine((prev) => !prev);
  });

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <Transition
      ref={containerRef}
      slideClassName="LeftSearch--content"
      name="fade"
      activeKey={canRenderContents ? 1 : 0}
      shouldCleanup
    >
      <InfiniteScroll
        className="search-content custom-scroll"
        items={canRenderContents ? filteredFoundIds : undefined}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!canRenderContents && <Loading />}
        {canRenderContents && !filteredFoundIds?.length && (
          <NothingFound
            withSticker
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
                  withOpenAppButton
                />
              );
            })}
          </div>
        )}
        {canRenderContents && Boolean(filteredFoundIds?.length) && (
          <div className="search-section">
            <h3 className="section-heading">{lang('SearchAppsPopular')}</h3>
            {filteredFoundIds.map((id) => {
              return (
                <LeftSearchResultChat
                  chatId={id}
                  onClick={handleChatClick}
                  withOpenAppButton
                />
              );
            })}
          </div>
        )}
      </InfiniteScroll>
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const globalSearch = selectTabState(global).globalSearch;
  const foundIds = globalSearch.popularBotApps?.peerIds;

  return {
    isLoading: !foundIds && globalSearch.fetchingStatus?.botApps,
    foundIds,
    recentBotIds: global.topBotApps.userIds,
  };
})(BotAppResults));
