import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { AvatarSize } from './Avatar';
import type { ApiChat, ApiUser } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import Avatar from './Avatar';

import styles from './AvatarList.module.scss';

type OwnProps = {
  size: AvatarSize;
  peers?: (ApiUser | ApiChat)[];
};

const AvatarList: FC<OwnProps> = ({
  peers,
  size,
}) => {
  const lang = useLang();

  return (
    <div
      className={buildClassName(styles.root, styles[`size-${size}`])}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      {peers?.map((peer) => <Avatar size={size} peer={peer} className={styles.avatar} />)}
    </div>
  );
};

export default memo(AvatarList);
