import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { formatAutoDeleteBadgePeriod } from '../helpers/autoDeletePeriods';

import useLang from '../../../hooks/useLang';

import styles from './AutoDeleteOutlinedIcon.module.scss';

type OwnProps = {
  period: number;
  className?: string;
};

// Line-style counterpart of `AutoDeleteIcon` tinted via `currentColor`; a period of 0 renders as a plain clock.
// Composes the font-icon classes manually because `Icon` cannot host the overlay label.
function AutoDeleteOutlinedIcon({ period, className }: OwnProps) {
  const lang = useLang();

  const periodText = period ? formatAutoDeleteBadgePeriod(lang, period) : undefined;
  const iconName = periodText === undefined ? 'auto-delete-clock' : 'auto-delete-empty';

  return (
    <i className={buildClassName('icon', `icon-${iconName}`, styles.root, className)} aria-hidden>
      {periodText !== undefined && (
        <span className={styles.label} dir="ltr">{periodText}</span>
      )}
    </i>
  );
}

export default memo(AutoDeleteOutlinedIcon);
