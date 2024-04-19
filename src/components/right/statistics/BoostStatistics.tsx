import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiBoostStatistics } from '../../../api/types';
import type { TabState } from '../../../global/types';

import { selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatDateAtTime } from '../../../util/date/dateFormat';
import { getBoostProgressInfo } from '../../common/helpers/boostInfo';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/Icon';
import LinkField from '../../common/LinkField';
import PremiumProgress from '../../common/PremiumProgress';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import Spinner from '../../ui/Spinner';
import StatisticsOverview from './StatisticsOverview';

import styles from './BoostStatistics.module.scss';

type StateProps = {
  boostStatistics: TabState['boostStatistics'];
};

const BoostStatistics = ({
  boostStatistics,
}: StateProps) => {
  const { openChat, loadMoreBoosters, closeBoostStatistics } = getActions();
  const lang = useLang();

  const isLoaded = boostStatistics?.boostStatus;
  const status = isLoaded ? boostStatistics.boostStatus : undefined;

  const {
    currentLevel,
    hasNextLevel,
    boosts,
    levelProgress,
    remainingBoosts,
  } = useMemo(() => {
    if (!status) {
      return {
        currentLevel: 0,
        hasNextLevel: false,
        boosts: 0,
        levelProgress: 0,
        remainingBoosts: 0,
      };
    }
    return getBoostProgressInfo(status);
  }, [status]);

  const statsOverview = useMemo(() => {
    if (!status) return undefined;

    return {
      level: currentLevel,
      boosts,
      premiumSubscribers: status.premiumSubscribers!,
      remainingBoosts,
    } satisfies ApiBoostStatistics;
  }, [status, boosts, currentLevel, remainingBoosts]);

  const boostersToLoadCount = useMemo(() => {
    if (!boostStatistics?.count) return undefined;
    const loadedCount = boostStatistics.boosterIds?.length || 0;
    const totalCount = boostStatistics.count;
    return totalCount - loadedCount;
  }, [boostStatistics]);

  const handleBoosterClick = useLastCallback((userId: string) => {
    openChat({ id: userId });
    closeBoostStatistics();
  });

  const handleLoadMore = useLastCallback(() => {
    loadMoreBoosters();
  });

  return (
    <div className={buildClassName(styles.root, 'custom-scroll')}>
      {!isLoaded && <Loading />}
      {isLoaded && statsOverview && (
        <>
          <div className={styles.section}>
            <PremiumProgress
              leftText={lang('BoostsLevel', currentLevel!)}
              rightText={hasNextLevel ? lang('BoostsLevel', currentLevel! + 1) : undefined}
              progress={levelProgress}
              floatingBadgeText={boosts.toString()}
              floatingBadgeIcon="boost"
            />
            <StatisticsOverview className={styles.stats} statistics={statsOverview} type="boost" />
          </div>
          <div className={styles.section}>
            <h4 className={styles.sectionHeader} dir={lang.isRtl ? 'rtl' : undefined}>
              {lang('Boosters')}
            </h4>
            {!boostStatistics.boosterIds?.length && (
              <div className={styles.noResults}>{lang('NoBoostersHint')}</div>
            )}
            {boostStatistics.boosterIds?.map((userId) => (
              <ListItem
                key={userId}
                className="chat-item-clickable"
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => handleBoosterClick(userId)}
              >
                <PrivateChatInfo
                  className={styles.user}
                  forceShowSelf
                  userId={userId}
                  status={lang('BoostExpireOn', formatDateAtTime(lang, boostStatistics.boosters![userId] * 1000))}
                />
              </ListItem>
            ))}
            {Boolean(boostersToLoadCount) && (
              <ListItem
                key="load-more"
                className={styles.showMore}
                disabled={boostStatistics?.isLoadingBoosters}
                onClick={handleLoadMore}
              >
                {boostStatistics?.isLoadingBoosters ? (
                  <Spinner className={styles.loadMoreSpinner} />
                ) : (
                  <Icon name="down" className={styles.down} />
                )}
                {lang('ShowVotes', boostersToLoadCount)}
              </ListItem>
            )}
          </div>
          <LinkField className={styles.section} link={status!.boostUrl} withShare title={lang('LinkForBoosting')} />
        </>
      )}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const boostStatistics = tabState.boostStatistics;

    return {
      boostStatistics,
    };
  },
)(BoostStatistics));
