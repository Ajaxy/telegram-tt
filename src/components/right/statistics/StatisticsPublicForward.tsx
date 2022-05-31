import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';

import useLang from '../../../hooks/useLang';
import { getActions } from '../../../global';
import type { ApiMessagePublicForward } from '../../../api/types';

import Avatar from '../../common/Avatar';

import './StatisticsPublicForward.scss';

export type OwnProps = {
  data: ApiMessagePublicForward;
};

const StatisticsPublicForward: FC<OwnProps> = ({ data }) => {
  const lang = useLang();
  const { openChatByUsername } = getActions();

  const handleClick = useCallback(() => {
    openChatByUsername({ username: data.chat.username, messageId: data.messageId });
  }, [data, openChatByUsername]);

  return (
    <div className="StatisticsPublicForward" onClick={handleClick}>
      <Avatar size="medium" chat={data.chat} />

      <div className="StatisticsPublicForward__info">
        <div className="StatisticsPublicForward__title">
          {data.title}
        </div>

        <div className="StatisticsPublicForward__views">
          {lang('ChannelStats.ViewsCount', data.views, 'i')}
        </div>
      </div>
    </div>
  );
};

export default memo(StatisticsPublicForward);
