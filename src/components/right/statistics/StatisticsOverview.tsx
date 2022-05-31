import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type {
  ApiChannelStatistics, ApiGroupStatistics, ApiMessageStatistics, StatisticsOverviewItem,
} from '../../../api/types';

import { formatInteger, formatIntegerCompact } from '../../../util/textFormat';
import { formatFullDate } from '../../../util/dateFormat';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

import './StatisticsOverview.scss';

type OverviewCell = {
  name: string;
  title: string;
  isPercentage?: boolean;
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

export type OwnProps = {
  isGroup?: boolean;
  isMessage?: boolean;
  statistics: ApiChannelStatistics | ApiGroupStatistics | ApiMessageStatistics;
};

const StatisticsOverview: FC<OwnProps> = ({ isGroup, isMessage, statistics }) => {
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

  return (
    <div className="StatisticsOverview">
      <div className="StatisticsOverview__header">
        <div className="StatisticsOverview__title">{lang('StatisticOverview')}</div>

        {period && (
          <div className="StatisticsOverview__caption">
            {formatFullDate(lang, period.minDate * 1000)} — {formatFullDate(lang, period.maxDate * 1000)}
          </div>
        )}
      </div>

      <table className="StatisticsOverview__table">
        {(isMessage ? MESSAGE_OVERVIEW : isGroup ? GROUP_OVERVIEW : CHANNEL_OVERVIEW).map((row) => (
          <tr>
            {row.map((cell: OverviewCell) => {
              const field = (statistics as any)[cell.name];

              if (cell.isPlain) {
                return (
                  <td className="StatisticsOverview__table-cell">
                    <b className="StatisticsOverview__table-value">
                      {cell.isApproximate ? `≈${formatInteger(field)}` : formatInteger(field)}
                    </b>
                    <h3 className="StatisticsOverview__table-heading">{lang(cell.title)}</h3>
                  </td>
                );
              }

              if (cell.isPercentage) {
                return (
                  <td className="StatisticsOverview__table-cell">
                    <b className="StatisticsOverview__table-value">{field.percentage}%</b>
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
