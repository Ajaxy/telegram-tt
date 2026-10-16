import { memo } from '../../../lib/teact/teact';

import type {
  ApiBoostStatistics, ApiChannelMonetizationStatistics,
  ApiChannelStatistics, ApiGroupStatistics, ApiPostStatistics, ApiTypeCurrencyAmount, StatisticsOverviewItem,
} from '../../../api/types';
import type { RegularLangKey } from '../../../types/language';

import { TON_CURRENCY_CODE } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { convertTonFromNanos } from '../../../util/formatCurrency';
import { formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { formatInteger, formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';

import GramIcon from '../../common/icons/GramIcon';

import styles from './StatisticsOverview.module.scss';

type OverviewCell = {
  name: string;
  title: RegularLangKey;
  isPercentage?: boolean;
  withAbsoluteValue?: boolean;
  isPlain?: boolean;
  isApproximate?: boolean;
};

const CHANNEL_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'followers', title: 'ChannelStatsOverviewFollowers' },
    { name: 'enabledNotifications', title: 'ChannelStatsOverviewEnabledNotifications', isPercentage: true },
  ],
  [
    { name: 'viewsPerPost', title: 'ChannelStatsOverviewViewsPerPost' },
    { name: 'viewsPerStory', title: 'ChannelStatsOverviewViewsPerStory' },
  ],
  [
    { name: 'sharesPerPost', title: 'ChannelStatsOverviewSharesPerPost' },
    { name: 'sharesPerStory', title: 'ChannelStatsOverviewSharesPerStory' },
  ],
  [
    { name: 'reactionsPerPost', title: 'ChannelStatsOverviewReactionsPerPost' },
    { name: 'reactionsPerStory', title: 'ChannelStatsOverviewReactionsPerStory' },
  ],
];

const GROUP_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'members', title: 'StatsGroupMembers' },
    { name: 'messages', title: 'StatsGroupMessages' },
  ],
  [
    { name: 'viewers', title: 'StatsGroupViewers' },
    { name: 'posters', title: 'StatsGroupPosters' },
  ],
];

const MESSAGE_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'viewsCount', title: 'StatsMessageViews', isPlain: true },
    { name: 'publicForwards', title: 'StatsMessagePublicShares', isPlain: true },
  ],
  [
    { name: 'reactionsCount', title: 'Reactions', isPlain: true },
    {
      name: 'forwardsCount', title: 'StatsMessagePrivateShares', isPlain: true, isApproximate: true,
    },
  ],
];

const STORY_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'viewsCount', title: 'ChannelStatsOverviewViews', isPlain: true },
    { name: 'publicForwards', title: 'StatsMessagePublicShares', isPlain: true },
  ],
  [
    { name: 'reactionsCount', title: 'Reactions', isPlain: true },
    { name: 'forwardsCount', title: 'StatsMessagePrivateShares', isPlain: true },
  ],
];

const BOOST_OVERVIEW: OverviewCell[][] = [
  [
    { name: 'level', title: 'StatsBoostsLevel', isPlain: true },
    {
      name: 'premiumSubscribers',
      title: 'StatsBoostsPremiumSubscribers',
      isPercentage: true,
      isApproximate: true,
      withAbsoluteValue: true,
    },
  ],
  [
    { name: 'boosts', title: 'StatsBoostsExistingBoosts', isPlain: true },
    { name: 'remainingBoosts', title: 'StatsBoostsBoostsToLevelUp', isPlain: true },
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
  subtitle?: React.ReactNode;
};

const StatisticsOverview = ({
  title,
  type,
  statistics,
  isToncoin,
  className,
  subtitle,
}: OwnProps) => {
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

  const renderBalanceCell = (balance: number, usdRate: number, text: RegularLangKey) => {
    const [integerTonPart, decimalTonPart] = balance.toFixed(4).split('.');
    const [integerUsdPart, decimalUsdPart] = (balance * usdRate).toFixed(2).split('.');
    return (
      <div>
        <GramIcon className={styles.toncoin} />
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
        <h3 className={styles.tableHeading}>{lang(text)}</h3>
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
            {formatDateTime(lang, secondsToDate(period.minDate), { date: 'numeric' })}
            {' '}
            —
            {formatDateTime(lang, secondsToDate(period.maxDate), { date: 'numeric' })}
          </div>
        )}
      </div>

      <table className={styles.table}>
        {isToncoin ? (
          <tr>
            <td className={styles.tableCell}>
              {renderBalanceCell(
                convertBalanceToGrams(balances?.availableBalance),
                usdRate || 0,
                'ChannelEarnAvailable',
              )}
              {renderBalanceCell(
                convertBalanceToGrams(balances?.currentBalance),
                usdRate || 0,
                'ChannelEarnReward',
              )}
              {renderBalanceCell(
                convertBalanceToGrams(balances?.overallRevenue),
                usdRate || 0,
                'ChannelEarnTotal',
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
                    <h3 className={styles.tableHeading}>{lang(cell.title)}</h3>
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
                    <h3 className={styles.tableHeading}>{lang(cell.title)}</h3>
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
                  <h3 className={styles.tableHeading}>{lang(cell.title)}</h3>
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

function convertBalanceToGrams(balance?: ApiTypeCurrencyAmount) {
  return balance?.currency === TON_CURRENCY_CODE ? convertTonFromNanos(balance.amount) : 0;
}

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
