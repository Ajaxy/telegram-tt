import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiPeer } from '../../api/types';
import type { AvatarSize } from './Avatar';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Avatar from './Avatar';

import styles from './AvatarList.module.scss';

type OwnProps = {
  size: AvatarSize;
  peers?: ApiPeer[];
  className?: string;
};

const AvatarList: FC<OwnProps> = ({
  peers,
  size,
  className,
}) => {
  const lang = useLang();

  return (
    <div
      className={buildClassName(className, styles.root, styles[`size-${size}`])}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      {peers?.map((peer) => <Avatar size={size} peer={peer} className={styles.avatar} />)}
    </div>
  );
};

export default memo(AvatarList);
