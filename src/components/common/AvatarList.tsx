import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';

import type { ApiPeer } from '../../api/types';
import type { AvatarSize } from './Avatar';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Avatar from './Avatar';

import styles from './AvatarList.module.scss';

const DEFAULT_LIMIT = 3;

type OwnProps = {
  size: AvatarSize;
  peers?: ApiPeer[];
  className?: string;
  limit?: number;
  badgeText?: string;
};

const AvatarList: FC<OwnProps> = ({
  peers,
  size,
  className,
  limit = DEFAULT_LIMIT,
  badgeText,
}) => {
  const lang = useLang();
  const renderingBadgeText = useMemo(() => {
    if (badgeText) return badgeText;
    if (!peers?.length || peers.length <= limit) return undefined;
    return `+${peers.length - limit}`;
  }, [badgeText, peers, limit]);

  return (
    <div
      className={buildClassName(className, styles.root, styles[`size-${size}`])}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      {peers?.slice(0, limit).map((peer) => <Avatar size={size} peer={peer} className={styles.avatar} />)}
      {renderingBadgeText && (
        <div className={styles.badge}>
          {renderingBadgeText}
        </div>
      )}
    </div>
  );
};

export default memo(AvatarList);
