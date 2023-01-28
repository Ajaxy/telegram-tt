import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiMessagePublicForward } from '../../../api/types';

import { getActions } from '../../../global';

import { getMainUsername } from '../../../global/helpers';
import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';

import './StatisticsPublicForward.scss';

export type OwnProps = {
  data: ApiMessagePublicForward;
};

const StatisticsPublicForward: FC<OwnProps> = ({ data }) => {
  const lang = useLang();
  const { openChatByUsername } = getActions();

  const username = useMemo(() => getMainUsername(data.chat), [data.chat]);
  const handleClick = useCallback(() => {
    openChatByUsername({ username: username!, messageId: data.messageId });
  }, [data.messageId, openChatByUsername, username]);

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
