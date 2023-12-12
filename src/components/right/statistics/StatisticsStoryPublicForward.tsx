import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiChat, ApiStoryPublicForward, ApiUser,
} from '../../../api/types';

import { getChatTitle, getUserFullName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';

import styles from './StatisticsPublicForward.module.scss';

export type OwnProps = {
  data: ApiStoryPublicForward;
  usersById: Record<string, ApiUser>;
  chatsById: Record<string, ApiChat>;
};

function StatisticsMessagePublicForward({ data, chatsById, usersById }: OwnProps) {
  const lang = useLang();
  const { openChat } = getActions();
  const user = usersById[data.peerId];
  const chat = chatsById[data.peerId];

  const handleClick = useLastCallback(() => {
    openChat({ id: user.id });
  });

  return (
    <div className={buildClassName(styles.root, 'statistic-public-forward')} onClick={handleClick}>
      <Avatar size="medium" peer={user || chat} withStorySolid forceUnreadStorySolid />

      <div>
        <div className={styles.title}>
          {user ? getUserFullName(user) : getChatTitle(lang, chat)}
        </div>

        <div className={styles.views}>
          {data.viewsCount ? lang('ChannelStats.ViewsCount', data.viewsCount, 'i') : lang('NoViews')}
        </div>
      </div>
    </div>
  );
}

export default memo(StatisticsMessagePublicForward);
