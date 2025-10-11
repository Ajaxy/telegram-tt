import type { ReactNode } from 'react';
import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type {
  ApiBoostStatistics, ApiChannelMonetizationStatistics,
  ApiChannelStatistics, ApiGroupStatistics, ApiPostStatistics, StatisticsOverviewItem,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatFullDate } from '../../../util/dates/dateFormat';
import { convertTonFromNanos } from '../../../util/formatCurrency';
import { formatInteger, formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';

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

type StatisticsType = 'channel' | 'group' | 'message' | 'boost' | 'story' | 'monetization';

const DEFAULT_VALUE = 0;

export type OwnProps = {
  type: StatisticsType;
  title?: string;
  className?: string;
  isToncoin?: boolean;
  statistics:
    ApiChannelStatistics |
    ApiGroupStatistics |
    ApiPostStatistics |
    ApiBoostStatistics |
    ApiChannelMonetizationStatistics;
  subtitle?: ReactNode;
};

const StatisticsOverview: FC<OwnProps> = ({
  title,
  type,
  statistics,
  isToncoin,
  className,
  subtitle,
}) => {
  const oldLang = useOldLang();
  const lang = useLang();

  const renderOverviewItemValue = ({ change, percentage }: StatisticsOverviewItem) => {
    if (!change) {
      return undefined;
    }

    const isChangeNegative = Number(change) < 0;

    return (
      <span className={buildClassName(styles.value, isChangeNegative && styles.negative)}>
        {isChangeNegative
          ? `-${formatIntegerCompact(lang, Math.abs(change))}`
          : `+${formatIntegerCompact(lang, change)}`}
        {percentage && (
          <>
            {' '}
            (
            {percentage}
            %)
          </>
        )}
      </span>
    );
  };

  const renderBalanceCell = (balance: number, usdRate: number, text: string) => {
    const [integerTonPart, decimalTonPart] = balance.toFixed(4).split('.');
    const [integerUsdPart, decimalUsdPart] = (balance * usdRate).toFixed(2).split('.');
    return (
      <div>
        <Icon className={styles.toncoin} name="toncoin" />
        <b className={styles.tableValue}>
          {integerTonPart}
          <span className={styles.decimalPart}>
            .
            {decimalTonPart}
          </span>
        </b>
        {' '}
        <span className={styles.tableHeading}>
          ≈ $
          {integerUsdPart}
          <span className={styles.decimalUsdPart}>
            .
            {decimalUsdPart}
          </span>
        </span>
        <h3 className={styles.tableHeading}>{oldLang(text)}</h3>
      </div>
    );
  };

  const { period } = statistics as ApiGroupStatistics;
  const { balances, usdRate } = statistics as ApiChannelMonetizationStatistics;

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
            {formatFullDate(oldLang, period.minDate * 1000)}
            {' '}
            —
            {formatFullDate(oldLang, period.maxDate * 1000)}
          </div>
        )}
      </div>

      <table className={styles.table}>
        {isToncoin ? (
          <tr>
            <td className={styles.tableCell}>
              {renderBalanceCell(
                balances?.availableBalance ? convertTonFromNanos(balances.availableBalance.amount) : 0,
                usdRate || 0,
                'lng_channel_earn_available',
              )}
              {renderBalanceCell(
                balances?.currentBalance ? convertTonFromNanos(balances.currentBalance.amount) : 0,
                usdRate || 0,
                'lng_channel_earn_reward',
              )}
              {renderBalanceCell(
                balances?.overallRevenue ? convertTonFromNanos(balances.overallRevenue.amount) : 0,
                usdRate || 0,
                'lng_channel_earn_total',
              )}
            </td>
          </tr>
        ) : schema.map((row) => (
          <tr>
            {row.map((cell: OverviewCell) => {
              const field = (statistics as any)?.[cell.name];

              if (cell.isPlain) {
                return (
                  <td className={styles.tableCell}>
                    <b className={styles.tableValue}>
                      {`${cell.isApproximate ? '≈ ' : ''}${formatInteger(field ?? DEFAULT_VALUE)}`}
                    </b>
                    <h3 className={styles.tableHeading}>{oldLang(cell.title)}</h3>
                  </td>
                );
              }

              if (cell.isPercentage) {
                const part = field?.part ?? DEFAULT_VALUE;
                const percentage = field?.percentage ?? DEFAULT_VALUE;

                return (
                  <td className={styles.tableCell}>
                    {cell.withAbsoluteValue && (
                      <span className={styles.tableValue}>
                        {`${cell.isApproximate ? '≈ ' : ''}${formatInteger(part)}`}
                      </span>
                    )}
                    <span className={cell.withAbsoluteValue ? styles.tableSecondaryValue : styles.tableValue}>
                      {percentage}
                      %
                    </span>
                    <h3 className={styles.tableHeading}>{oldLang(cell.title)}</h3>
                  </td>
                );
              }

              return (
                <td className={styles.tableCell}>
                  <b className={styles.tableValue}>
                    {formatIntegerCompact(lang, field?.current ?? DEFAULT_VALUE)}
                  </b>
                  {' '}
                  {renderOverviewItemValue(field)}
                  <h3 className={styles.tableHeading}>{oldLang(cell.title)}</h3>
                </td>
              );
            })}
          </tr>
        ))}
      </table>

      {subtitle}
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
