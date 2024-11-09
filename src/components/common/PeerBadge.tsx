import React, { memo } from '../../lib/teact/teact';

import type { ApiPeer } from '../../api/types';
import type { CustomPeer } from '../../types';
import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';

import Avatar from './Avatar';
import Icon from './icons/Icon';

import styles from './PeerBadge.module.scss';

type OwnProps = {
  peer: ApiPeer | CustomPeer;
  text?: string;
  badgeText?: string;
  badgeIcon?: IconName;
  className?: string;
  badgeClassName?: string;
  badgeIconClassName?: string;
  textClassName?: string;
  onClick?: NoneToVoidFunction;
};

const PeerBadge = ({
  peer,
  text,
  badgeText,
  badgeIcon,
  className,
  badgeClassName,
  badgeIconClassName,
  textClassName,
  onClick,
}: OwnProps) => {
  return (
    <div
      className={buildClassName(styles.root, onClick && styles.clickable, className)}
      onClick={onClick}
    >
      <div className={styles.top}>
        <Avatar size="large" peer={peer} />
        {badgeText && (
          <div className={buildClassName(styles.badge, badgeClassName)}>
            {badgeIcon && <Icon name={badgeIcon} className={badgeIconClassName} />}
            {badgeText}
          </div>
        )}
      </div>
      {text && <p className={buildClassName(styles.text, textClassName)}>{text}</p>}
    </div>
  );
};

export default memo(PeerBadge);
