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

const PROGRESS_LOCK = 0.1;

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

  const tailPosition = progress && (progress < PROGRESS_LOCK ? 0 : progress > 1 - PROGRESS_LOCK ? 1 : 0.5);

  return (
    <div
      className={buildClassName(
        styles.root,
        hasFloatingBadge && styles.withBadge,
        className,
      )}
      style={buildStyle(
        progress !== undefined && `--progress: ${progress}`,
        tailPosition !== undefined && `--tail-position: ${tailPosition}`,
      )}
    >
      {hasFloatingBadge && (
        <div className={styles.badgeContainer}>
          <div className={styles.floatingBadgeWrapper}>
            <div className={styles.floatingBadge}>
              {floatingBadgeIcon && <Icon name={floatingBadgeIcon} className={styles.floatingBadgeIcon} />}
              {floatingBadgeText && (
                <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>
                  {floatingBadgeText}
                </div>
              )}
            </div>
            <div className={styles.floatingBadgeTriangle}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="m 28,4 v 9 c 0.0089,7.283278 -3.302215,5.319646 -6.750951,8.589815 l -5.8284,5.82843 c -0.781,0.78105 -2.0474,0.78104 -2.8284,0 L 6.7638083,21.589815 C 2.8288652,17.959047 0.04527024,20.332086 0,13 V 4 C 0,4 0.00150581,0.97697493 3,1 5.3786658,1.018266 22.594519,0.9142007 25,1 c 2.992326,0.1067311 3,3 3,3 z" fill="#7E85FF" />
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
