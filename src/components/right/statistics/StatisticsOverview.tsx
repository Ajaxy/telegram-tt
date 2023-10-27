import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type {
  ApiBoostStatistics,
  ApiChannelStatistics, ApiGroupStatistics, ApiMessageStatistics, StatisticsOverviewItem,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatFullDate } from '../../../util/dateFormat';
import { formatInteger, formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';

import './StatisticsOverview.scss';

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
    { name: 'sharesPerPost', title: 'ChannelStats.Overview.SharesPerPost' },
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
    { name: 'views', title: 'Stats.Message.Views', isPlain: true },
    {
      name: 'forwards', title: 'Stats.Message.PrivateShares', isPlain: true, isApproximate: true,
    },
  ],
  [
    { name: 'publicForwards', title: 'Stats.Message.PublicShares', isPlain: true },
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

type StatisticsType = 'channel' | 'group' | 'message' | 'boost';

export type OwnProps = {
  type: StatisticsType;
  title?: string;
  className?: string;
  statistics: ApiChannelStatistics | ApiGroupStatistics | ApiMessageStatistics | ApiBoostStatistics;
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
      <span className={buildClassName('StatisticsOverview__value', isChangeNegative && 'negative')}>
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

  const schema = type === 'boost' ? BOOST_OVERVIEW : type === 'message' ? MESSAGE_OVERVIEW : type === 'group'
    ? GROUP_OVERVIEW : CHANNEL_OVERVIEW;

  return (
    <div className={buildClassName('StatisticsOverview', className)}>
      <div className="StatisticsOverview__header">
        {title && (
          <div className="StatisticsOverview__title">
            {title}
          </div>
        )}

        {period && (
          <div className="StatisticsOverview__caption">
            {formatFullDate(lang, period.minDate * 1000)} — {formatFullDate(lang, period.maxDate * 1000)}
          </div>
        )}
      </div>

      <table className="StatisticsOverview__table">
        {schema.map((row) => (
          <tr>
            {row.map((cell: OverviewCell) => {
              const field = (statistics as any)[cell.name];

              if (cell.isPlain) {
                return (
                  <td className="StatisticsOverview__table-cell">
                    <b className="StatisticsOverview__table-value">
                      {`${cell.isApproximate ? '≈' : ''}${formatInteger(field)}`}
                    </b>
                    <h3 className="StatisticsOverview__table-heading">{lang(cell.title)}</h3>
                  </td>
                );
              }

              if (cell.isPercentage) {
                return (
                  <td className="StatisticsOverview__table-cell">
                    {cell.withAbsoluteValue && (
                      <span className="StatisticsOverview__table-value">
                        {`${cell.isApproximate ? '≈' : ''}${formatInteger(field.part)}`}
                      </span>
                    )}
                    <span className={`StatisticsOverview__table-${cell.withAbsoluteValue ? 'secondary-' : ''}value`}>
                      {field.percentage}%
                    </span>
                    <h3 className="StatisticsOverview__table-heading">{lang(cell.title)}</h3>
                  </td>
                );
              }

              return (
                <td className="StatisticsOverview__table-cell">
                  <b className="StatisticsOverview__table-value">
                    {formatIntegerCompact(field.current)}
                  </b>
                  {' '}
                  {renderOverviewItemValue(field)}
                  <h3 className="StatisticsOverview__table-heading">{lang(cell.title)}</h3>
                </td>
              );
            })}
          </tr>
        ))}
      </table>
    </div>
  );
};

export default memo(StatisticsOverview);
