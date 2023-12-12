import React, { memo } from '../../../lib/teact/teact';

import type { StatisticsMessageInteractionCounter, StatisticsStoryInteractionCounter } from '../../../api/types';

import { formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/Icon';

import styles from './StatisticsRecentPost.module.scss';

interface OwnProps {
  postStatistic: StatisticsStoryInteractionCounter | StatisticsMessageInteractionCounter;
}

function StatisticsRecentPostMeta({ postStatistic }: OwnProps) {
  const lang = useLang();
  return (
    <div className={styles.meta}>
      {postStatistic.reactionsCount > 0 && (
        <span className={styles.metaWithIcon}>
          <Icon name="heart-outline" className={styles.metaIcon} />
          {formatIntegerCompact(postStatistic.reactionsCount)}
        </span>
      )}

      {postStatistic.forwardsCount > 0 && (
        <span className={styles.metaWithIcon}>
          <Icon name="forward" className={styles.metaIcon} />
          {formatIntegerCompact(postStatistic.forwardsCount)}
        </span>
      )}

      {!postStatistic.forwardsCount && !postStatistic.reactionsCount
        && lang('ChannelStats.SharesCount_ZeroValueHolder')}
    </div>
  );
}

export default memo(StatisticsRecentPostMeta);
