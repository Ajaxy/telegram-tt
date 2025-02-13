import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useCallback,
  useMemo,
  useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { LoadMoreDirection } from '../../../types';

import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { throttle } from '../../../util/schedulers';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import InfiniteScroll from '../../ui/InfiniteScroll';
import SearchInput from '../../ui/SearchInput';
import WebAppGridItem from './WebAppGridItem';

import styles from './MoreAppsTabContent.module.scss';

const POPULAR_APPS_SLICE = 30;

export type OwnProps = {
};

type StateProps = {
  isLoading?: boolean;
  foundIds?: string[];
  recentBotIds?: string[];
};
const LESS_GRID_ITEMS_AMOUNT = 5;
const runThrottled = throttle((cb) => cb(), 500, true);

const MoreAppsTabContent: FC<OwnProps & StateProps> = ({
  foundIds,
  recentBotIds,
}) => {
  const oldLang = useOldLang();
  const lang = useLang();
  const [shouldShowMoreMine, setShouldShowMoreMine] = useState<boolean>(false);
  const {
    searchPopularBotApps,
  } = getActions();

  const handleToggleShowMoreMine = useLastCallback(() => {
    setShouldShowMoreMine((prev) => !prev);
  });

  const [searchQuery, setSearchQuery] = useState('');

  const filteredFoundIds = useMemo(() => {
    if (!foundIds) return [];

    return filterPeersByQuery({ ids: foundIds, query: searchQuery, type: 'user' });
  }, [foundIds, searchQuery]);

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchPopularBotApps();
      });
    }
  }, []);

  const handleSearchInputReset = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <InfiniteScroll
      className={buildClassName(styles.root, 'custom-scroll')}
      items={filteredFoundIds}
      onLoadMore={handleLoadMore}
      itemSelector=".PopularAppGridItem"
      noFastList
      preloadBackwards={POPULAR_APPS_SLICE}
    >
      <SearchInput
        className={styles.search}
        value={searchQuery}
        onChange={setSearchQuery}
        onReset={handleSearchInputReset}
        placeholder={lang('SearchApps')}
      />
      {recentBotIds && !searchQuery && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span>{oldLang('SearchAppsMine')}</span>
            <span className={styles.showMoreLink} onClick={handleToggleShowMoreMine}>
              {oldLang(shouldShowMoreMine ? 'ChatList.Search.ShowLess' : 'ChatList.Search.ShowMore')}
            </span>
          </div>
          <div className={styles.sectionContent}>
            {recentBotIds.map((id, index) => {
              if (!shouldShowMoreMine && index >= LESS_GRID_ITEMS_AMOUNT) {
                return undefined;
              }

              return (
                <WebAppGridItem
                  chatId={id}
                />
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {searchQuery ? lang('Apps') : lang('PopularApps')}
        </div>
        <div className={styles.sectionContent}>
          {filteredFoundIds && filteredFoundIds.map((id) => {
            return (
              <WebAppGridItem
                chatId={id}
                isPopularApp={!searchQuery}
              />
            );
          })}
        </div>
      </div>
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  const globalSearch = selectTabState(global).globalSearch;
  const foundIds = globalSearch.popularBotApps?.peerIds;

  return {
    isLoading: !foundIds && globalSearch.fetchingStatus?.botApps,
    foundIds,
    recentBotIds: global.topBotApps.userIds,
  };
})(MoreAppsTabContent));
