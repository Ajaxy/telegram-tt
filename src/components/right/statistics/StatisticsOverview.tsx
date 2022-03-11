import React, { FC, memo } from '../../../lib/teact/teact';

import { ApiStatistics, StatisticsOverviewItem } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

import './StatisticsOverview.scss';

export type OwnProps = {
  statistics: ApiStatistics;
};

const StatisticsOverview: FC<OwnProps> = ({ statistics }) => {
  const lang = useLang();

  const renderOverviewItemValue = ({ change, percentage }: StatisticsOverviewItem) => {
    const isChangeNegative = Number(change) < 0;

    return (
      <span className={buildClassName('StatisticsOverview--value', isChangeNegative && 'negative')}>
        {isChangeNegative ? change : `+${change}`}
        {percentage && (
          <>
            {' '}
            ({percentage}%)
          </>
        )}
      </span>
    );
  };

  const {
    followers, viewsPerPost, sharesPerPost, enabledNotifications,
  } = statistics;

  return (
    <div className="StatisticsOverview">
      <h2 className="StatisticsOverview--title">{lang('ChannelStats.Overview')}</h2>

      <table className="StatisticsOverview--table">
        <tr>
          <td>
            <b className="StatisticsOverview--table-value">{followers.current}</b> {renderOverviewItemValue(followers)}
            <h3 className="StatisticsOverview--table-heading">{lang('ChannelStats.Overview.Followers')}</h3>
          </td>
          <td>
            <b className="StatisticsOverview--table-value">{enabledNotifications.percentage}%</b>
            <h3 className="StatisticsOverview--table-heading">{lang('ChannelStats.Overview.EnabledNotifications')}</h3>
          </td>
        </tr>

        <tr>
          <td>
            <b className="StatisticsOverview--table-value">{viewsPerPost.current}</b>
            {' '}
            {renderOverviewItemValue(viewsPerPost)}
            <h3 className="StatisticsOverview--table-heading">{lang('ChannelStats.Overview.ViewsPerPost')}</h3>
          </td>
          <td>
            <b className="StatisticsOverview--table-value">{sharesPerPost.current}</b>
            {' '}
            {renderOverviewItemValue(sharesPerPost)}
            <h3 className="StatisticsOverview--table-heading">{lang('ChannelStats.Overview.SharesPerPost')}</h3>
          </td>
        </tr>
      </table>
    </div>
  );
};

export default memo(StatisticsOverview);
