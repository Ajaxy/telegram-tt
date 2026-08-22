import { memo } from '../../../lib/teact/teact';

import type { ApiPeer } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useAverageColor from '../../../hooks/useAverageColor';

import AutoDeleteOutlinedIcon from './AutoDeleteOutlinedIcon';

import styles from './AutoDeleteIcon.module.scss';

type OwnProps = {
  period: number;
  peer: ApiPeer;
  className?: string;
  ariaLabel?: string;
};

const AVATAR_FALLBACK_COLOR = '#0003';

function AutoDeleteIcon({ period, peer, className, ariaLabel }: OwnProps) {
  const averageColor = useAverageColor(peer, AVATAR_FALLBACK_COLOR);
  const hasAvatarPhoto = Boolean(peer.avatarPhotoId);

  return (
    <span
      className={buildClassName(styles.root, className)}
      style={hasAvatarPhoto ? `background-color: ${averageColor}` : undefined}
      role="img"
      aria-label={ariaLabel}
    >
      <AutoDeleteOutlinedIcon period={period} className={styles.glyph} />
    </span>
  );
}

export default memo(AutoDeleteIcon);
