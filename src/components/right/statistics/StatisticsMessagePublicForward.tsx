import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessagePublicForward } from '../../../api/types';

import { getMainUsername } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';

import styles from './StatisticsPublicForward.module.scss';

export type OwnProps = {
  data: ApiMessagePublicForward;
};

const StatisticsMessagePublicForward = ({ data }: OwnProps) => {
  const { openChatByUsername } = getActions();

  const lang = useLang();
  const viewsCount = data.views ?? 0;

  const username = useMemo(() => (data.chat ? getMainUsername(data.chat) : undefined), [data.chat]);
  const handleClick = useCallback(() => {
    openChatByUsername({ username: username!, messageId: data.messageId });
  }, [data.messageId, openChatByUsername, username]);

  return (
    <div className={buildClassName(styles.root, 'statistic-public-forward')} onClick={handleClick}>
      <Avatar size="medium" peer={data.chat} />

      <div>
        <div className={styles.title}>
          {data.title}
        </div>

        <div className={styles.views}>
          {lang('ChannelStatsViewsCount', { count: lang.number(viewsCount) }, { pluralValue: viewsCount })}
        </div>
      </div>
    </div>
  );
};

export default memo(StatisticsMessagePublicForward);
