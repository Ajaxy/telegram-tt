import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useLang from '../../hooks/useLang';

import Icon from './Icon';

import styles from './PremiumProgress.module.scss';

type OwnProps = {
  leftText?: string;
  rightText?: string;
  floatingBadgeIcon?: IconName;
  floatingBadgeText?: string;
  progress?: number;
  className?: string;
};

const LimitPreview: FC<OwnProps> = ({
  leftText,
  rightText,
  floatingBadgeText,
  floatingBadgeIcon,
  progress,
  className,
}) => {
  const lang = useLang();

  const hasFloatingBadge = Boolean(floatingBadgeIcon || floatingBadgeText);
  const isProgressFull = Boolean(progress) && progress > 0.99;

  return (
    <div
      className={buildClassName(
        styles.root,
        hasFloatingBadge && styles.withBadge,
        className,
      )}
      style={buildStyle(progress !== undefined && `--progress: ${progress}`)}
    >
      {hasFloatingBadge && (
        <div className={styles.badgeContainer}>
          <div className={styles.floatingBadge}>
            {floatingBadgeIcon && <Icon name={floatingBadgeIcon} className={styles.floatingBadgeIcon} />}
            {floatingBadgeText && (
              <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>{floatingBadgeText}</div>
            )}
            <div className={styles.floatingBadgeTriangle}>
              <svg width="26" height="9" viewBox="0 0 26 9" fill="none">
                <path d="M0 0H26H24.4853C22.894 0 21.3679 0.632141 20.2426 1.75736L14.4142 7.58579C13.6332 8.36684 12.3668 8.36683 11.5858 7.58579L5.75736 1.75736C4.63214 0.632139 3.10602 0 1.51472 0H0Z" fill="#7E85FF" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <div className={styles.left}>
        <span>{leftText}</span>
      </div>
      <div className={styles.right}>
        <span>{rightText}</span>
      </div>
      <div className={buildClassName(styles.progress, isProgressFull && styles.fullProgress)}>
        <div className={styles.left}>
          <span>{leftText}</span>
        </div>
        <div className={styles.right}>
          <span>{rightText}</span>
        </div>
      </div>
    </div>
  );
};

export default memo(LimitPreview);
