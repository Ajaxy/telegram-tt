import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type {
  ApiBoostStatistics,
  ApiChannelStatistics, ApiGroupStatistics, ApiPostStatistics, StatisticsOverviewItem,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatFullDate } from '../../../util/dateFormat';
import { formatInteger, formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';

import styles from './StatisticsOverview.module.scss';

type OverviewCell = {
  name: string;
  title: string;
  isPercentage?: boolean;
  withAbsoluteValue?: boolean;
  isPlain?: boolean;
  isApproximate?: boolean;
};

const CHANNEL_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'followers', title: 'ChannelStats.Overview.Followers' },
    { name: 'enabledNotifications', title: 'ChannelStats.Overview.EnabledNotifications', isPercentage: true },
  ],
  [
    { name: 'viewsPerPost', title: 'ChannelStats.Overview.ViewsPerPost' },
    { name: 'viewsPerStory', title: 'ChannelStats.Overview.ViewsPerStory' },
  ],
  [
    { name: 'sharesPerPost', title: 'ChannelStats.Overview.SharesPerPost' },
    { name: 'sharesPerStory', title: 'ChannelStats.Overview.SharesPerStory' },
  ],
  [
    { name: 'reactionsPerPost', title: 'ChannelStats.Overview.ReactionsPerPost' },
    { name: 'reactionsPerStory', title: 'ChannelStats.Overview.ReactionsPerStory' },
  ],
];

const GROUP_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'members', title: 'Stats.GroupMembers' },
    { name: 'messages', title: 'Stats.GroupMessages' },
  ],
  [
    { name: 'viewers', title: 'Stats.GroupViewers' },
    { name: 'posters', title: 'Stats.GroupPosters' },
  ],
];

const MESSAGE_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'viewsCount', title: 'Stats.Message.Views', isPlain: true },
    { name: 'publicForwards', title: 'Stats.Message.PublicShares', isPlain: true },
  ],
  [
    { name: 'reactionsCount', title: 'Channel.Stats.Overview.Reactions', isPlain: true },
    {
      name: 'forwardsCount', title: 'Stats.Message.PrivateShares', isPlain: true, isApproximate: true,
    },
  ],
];

const STORY_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'viewsCount', title: 'Channel.Stats.Overview.Views', isPlain: true },
    { name: 'publicForwards', title: 'PublicShares', isPlain: true },
  ],
  [
    { name: 'reactionsCount', title: 'Channel.Stats.Overview.Reactions', isPlain: true },
    { name: 'forwardsCount', title: 'PrivateShares', isPlain: true },
  ],
];

const BOOST_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'level', title: 'Stats.Boosts.Level', isPlain: true },
    {
      name: 'premiumSubscribers',
      title: 'Stats.Boosts.PremiumSubscribers',
      isPercentage: true,
      isApproximate: true,
      withAbsoluteValue: true,
    },
  ],
  [
    { name: 'boosts', title: 'Stats.Boosts.ExistingBoosts', isPlain: true },
    { name: 'remainingBoosts', title: 'Stats.Boosts.BoostsToLevelUp', isPlain: true },
  ],
];

type StatisticsType = 'channel' | 'group' | 'message' | 'boost' | 'story';

export type OwnProps = {
  type: StatisticsType;
  title?: string;
  className?: string;
  statistics: ApiChannelStatistics | ApiGroupStatistics | ApiPostStatistics | ApiBoostStatistics;
};

const StatisticsOverview: FC<OwnProps> = ({
  title,
  type,
  statistics,
  className,
}) => {
  const lang = useLang();

  const renderOverviewItemValue = ({ change, percentage }: StatisticsOverviewItem) => {
    if (!change) {
      return undefined;
    }

    const isChangeNegative = Number(change) < 0;

    return (
      <span className={buildClassName(styles.value, isChangeNegative && styles.negative)}>
        {isChangeNegative ? `-${formatIntegerCompact(Math.abs(change))}` : `+${formatIntegerCompact(change)}`}
        {percentage && (
          <>
            {' '}
            ({percentage}%)
          </>
        )}
      </span>
    );
  };

  const { period } = (statistics as ApiGroupStatistics);

  const schema = getSchemaByType(type);

  return (
    <div className={buildClassName(styles.root, className)}>
      <div className={styles.header}>
        {title && (
          <div className={styles.title}>
            {title}
          </div>
        )}

        {period && (
          <div className={styles.caption}>
            {formatFullDate(lang, period.minDate * 1000)} — {formatFullDate(lang, period.maxDate * 1000)}
          </div>
        )}
      </div>

      <table className={styles.table}>
        {schema.map((row) => (
          <tr>
            {row.map((cell: OverviewCell) => {
              const field = (statistics as any)[cell.name];

              if (cell.isPlain) {
                return (
                  <td className={styles.tableCell}>
                    <b className={styles.tableValue}>
                      {`${cell.isApproximate ? '≈' : ''}${formatInteger(field)}`}
                    </b>
                    <h3 className={styles.tableHeading}>{lang(cell.title)}</h3>
                  </td>
                );
              }

              if (cell.isPercentage) {
                return (
                  <td className={styles.tableCell}>
                    {cell.withAbsoluteValue && (
                      <span className={styles.tableValue}>
                        {`${cell.isApproximate ? '≈' : ''}${formatInteger(field.part)}`}
                      </span>
                    )}
                    <span className={cell.withAbsoluteValue ? styles.tableSecondaryValue : styles.tableValue}>
                      {field.percentage}%
                    </span>
                    <h3 className={styles.tableHeading}>{lang(cell.title)}</h3>
                  </td>
                );
              }

              return (
                <td className={styles.tableCell}>
                  <b className={styles.tableValue}>
                    {formatIntegerCompact(field.current)}
                  </b>
                  {' '}
                  {renderOverviewItemValue(field)}
                  <h3 className={styles.tableHeading}>{lang(cell.title)}</h3>
                </td>
              );
            })}
          </tr>
        ))}
      </table>
    </div>
  );
};

function getSchemaByType(type: StatisticsType) {
  switch (type) {
    case 'group':
      return GROUP_OVERVIEW;
    case 'message':
      return MESSAGE_OVERVIEW;
    case 'boost':
      return BOOST_OVERVIEW;
    case 'story':
      return STORY_OVERVIEW;
    case 'channel':
    default:
      return CHANNEL_OVERVIEW;
  }
}

export default memo(StatisticsOverview);
