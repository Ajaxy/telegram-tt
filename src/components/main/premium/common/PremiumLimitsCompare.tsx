import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { IconName } from '../../../../types/icons';

import buildClassName from '../../../../util/buildClassName';

import useOldLang from '../../../../hooks/useOldLang';

import Icon from '../../../common/icons/Icon';

import styles from './PremiumLimitsCompare.module.scss';

type OwnProps = {
  floatingBadgeIcon?: IconName;
  leftValue?: string;
  rightValue?: string;
  className?: string;
  rightStyle?: string;
};

const PremiumLimitsCompare: FC<OwnProps> = ({
  leftValue,
  rightValue,
  className,
  floatingBadgeIcon,
  rightStyle,
}) => {
  const lang = useOldLang();

  return (
    <div className={buildClassName(styles.root, className)}>
      {floatingBadgeIcon && (
        <div className={styles.floatingBadge}>
          <Icon name={floatingBadgeIcon} className={styles.floatingBadgeIcon} />
          <div className={styles.floatingBadgeValue} dir={lang.isRtl ? 'rtl' : undefined}>{leftValue}</div>
          <div className={styles.floatingBadgeTriangle}>
            <svg width="26" height="9" viewBox="0 0 26 9" fill="none">
              <path d="M0 0H26H24.4853C22.894 0 21.3679 0.632141 20.2426 1.75736L14.4142 7.58579C13.6332 8.36684 12.3668 8.36683 11.5858 7.58579L5.75736 1.75736C4.63214 0.632139 3.10602 0 1.51472 0H0Z" fill="#7E85FF" />
            </svg>
          </div>
        </div>
      )}
      <div className={buildClassName(styles.line, styles.left)}>
        <div className={styles.leftText} dir={lang.isRtl ? 'rtl' : undefined}>{lang('LimitFree')}</div>
        {!floatingBadgeIcon && <div className={styles.leftValue}>{leftValue}</div>}
      </div>
      <div className={buildClassName(styles.line, styles.right)} style={rightStyle}>
        <div className={styles.rightText} dir={lang.isRtl ? 'rtl' : undefined}>{lang('LimitPremium')}</div>
        <div className={styles.rightValue}>{rightValue}</div>
      </div>
    </div>
  );
};

export default memo(PremiumLimitsCompare);
