import { memo } from '../../../lib/teact/teact';

import type { ApiPeer } from '../../../api/types';
import type { LangFn } from '../../../util/localization';

import buildClassName from '../../../util/buildClassName';
import {
  DAY, HOUR, MINUTE, MONTH, WEEK,
} from '../../../util/dates/units';

import useAverageColor from '../../../hooks/useAverageColor';
import useLang from '../../../hooks/useLang';

import styles from './AutoDeleteIcon.module.scss';

import AutoDeleteClock from '../../../assets/icons/autoDelete/clock.svg';
import AutoDeleteEmpty from '../../../assets/icons/autoDelete/empty.svg';

type OwnProps = {
  period: number;
  peer: ApiPeer;
  className?: string;
  ariaLabel?: string;
};

const MONTH_THRESHOLD = 31 * DAY;
const YEAR_THRESHOLD = 364 * DAY;
const AVATAR_FALLBACK_COLOR = '#0003';

function AutoDeleteIcon({ period, peer, className, ariaLabel }: OwnProps) {
  const lang = useLang();

  const averageColor = useAverageColor(peer, AVATAR_FALLBACK_COLOR);
  const hasAvatarPhoto = Boolean(peer.avatarPhotoId);

  const rootClassName = buildClassName(styles.root, className);
  const periodText = formatPeriod(lang, period);

  return (
    <span
      className={rootClassName}
      style={hasAvatarPhoto ? `background-color: ${averageColor}` : undefined}
      role="img"
      aria-label={ariaLabel}
    >
      {periodText === undefined ? (
        <img className={styles.layer} src={AutoDeleteClock} alt="" />
      ) : (
        <>
          <img className={styles.layer} src={AutoDeleteEmpty} alt="" />
          <span className={styles.label} dir="ltr">{periodText}</span>
        </>
      )}
    </span>
  );
}

function formatPeriod(lang: LangFn, period: number) {
  if (period < MINUTE) {
    return formatPeriodUnit(lang, period, 'AutoDeleteBadgeSeconds');
  }

  if (period < HOUR) {
    return formatPeriodUnit(lang, Math.floor(period / MINUTE), 'AutoDeleteBadgeMinutes');
  }

  if (period < DAY) {
    return formatPeriodUnit(lang, Math.floor(period / HOUR), 'AutoDeleteBadgeHours');
  }

  if (period < WEEK) {
    return formatPeriodUnit(lang, Math.floor(period / DAY), 'AutoDeleteBadgeDays');
  }

  if (period < MONTH_THRESHOLD) {
    return formatPeriodUnit(lang, Math.floor(period / WEEK), 'AutoDeleteBadgeWeeks');
  }

  if (period < YEAR_THRESHOLD) {
    return formatPeriodUnit(lang, Math.floor(period / MONTH), 'AutoDeleteBadgeMonths');
  }

  return formatPeriodUnit(lang, Math.floor(period / YEAR_THRESHOLD), 'AutoDeleteBadgeYears');
}

function formatPeriodUnit(
  lang: LangFn,
  value: number,
  unitKey: 'AutoDeleteBadgeSeconds' | 'AutoDeleteBadgeMinutes' | 'AutoDeleteBadgeHours'
    | 'AutoDeleteBadgeDays' | 'AutoDeleteBadgeWeeks' | 'AutoDeleteBadgeMonths' | 'AutoDeleteBadgeYears',
) {
  const valueText = String(value);
  return valueText.length < 2 ? `${valueText}${lang(unitKey)}` : undefined;
}

export default memo(AutoDeleteIcon);
