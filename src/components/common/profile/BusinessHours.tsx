import {
  memo, useMemo,
} from '../../../lib/teact/teact';

import type { ApiBusinessWorkHours } from '../../../api/types';

import {
  VTT_PROFILE_BUSINESS_HOURS,
  VTT_PROFILE_BUSINESS_HOURS_COLLAPSE,
  VTT_PROFILE_BUSINESS_HOURS_EXPAND,
} from '../../../util/animations/viewTransitionTypes';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { formatTime, formatWeekday } from '../../../util/dates/dateFormat';
import {
  getUtcOffset, getWeekStart, shiftTimeRanges, splitDays,
} from '../../../util/dates/workHours';

import { useViewTransition } from '../../../hooks/animations/useViewTransition';
import { useVtn } from '../../../hooks/animations/useVtn';
import useSelectorSignal from '../../../hooks/data/useSelectorSignal';
import useInterval from '../../../hooks/schedulers/useInterval';
import useDerivedState from '../../../hooks/useDerivedState';
import useFlag from '../../../hooks/useFlag';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import ListItem from '../../ui/ListItem';
import Icon from '../icons/Icon';

import styles from './BusinessHours.module.scss';

const DAYS = Array.from({ length: 7 }, (_, i) => i);

type OwnProps = {
  businessHours: ApiBusinessWorkHours;
  className?: string;
};

const BusinessHours = ({
  businessHours,
  className,
}: OwnProps) => {
  const [isExpanded, expand, collapse] = useFlag(false);
  const [isMyTime, showInMyTime, showInLocalTime] = useFlag(false);
  const oldLang = useOldLang();
  const forceUpdate = useForceUpdate();

  const { startViewTransition } = useViewTransition();
  const { createVtnStyle } = useVtn();

  useInterval(forceUpdate, 60 * 1000);

  const timezoneSignal = useSelectorSignal((global) => global.timezones?.byId);
  const timezones = useDerivedState(timezoneSignal, [timezoneSignal]);
  const timezoneMinuteDifference = useMemo(() => {
    if (!timezones) return 0;
    const timezone = timezones[businessHours.timezoneId];
    const myOffset = getUtcOffset();
    return (myOffset - timezone.utcOffset) / 60;
  }, [businessHours.timezoneId, timezones]);

  const workHours = useMemo(() => {
    const weekStart = getWeekStart();
    const shiftedHours = shiftTimeRanges(businessHours.workHours, isMyTime ? timezoneMinuteDifference : 0);
    const days = splitDays(shiftedHours);
    const result: Record<number, string[]> = {};

    DAYS.forEach((day) => {
      const segments = days[day];
      if (!segments) {
        result[day] = [oldLang('BusinessHoursDayClosed')];
        return;
      }

      result[day] = segments.map(({ startMinute, endMinute }) => {
        if (endMinute - startMinute === 24 * 60) return oldLang('BusinessHoursDayFullOpened');
        const start = formatTime(oldLang, weekStart + startMinute * 60 * 1000);
        const end = formatTime(oldLang, weekStart + endMinute * 60 * 1000);
        return `${start} – ${end}`;
      });
    });

    return result;
  }, [businessHours.workHours, isMyTime, oldLang, timezoneMinuteDifference]);

  const isBusinessOpen = useMemo(() => {
    const localTimeHours = shiftTimeRanges(businessHours.workHours, timezoneMinuteDifference);

    const weekStart = getWeekStart();
    const now = new Date().getTime();
    const minutesSinceWeekStart = (now - weekStart) / 1000 / 60;

    return localTimeHours.some(({ startMinute, endMinute }) => (
      startMinute <= minutesSinceWeekStart && minutesSinceWeekStart <= endMinute
    ));
  }, [businessHours.workHours, timezoneMinuteDifference]);

  const currentDay = useMemo(() => {
    const now = new Date(Date.now() - (isMyTime ? 0 : timezoneMinuteDifference * 60 * 1000));
    return (now.getDay() + 6) % 7;
  }, [isMyTime, timezoneMinuteDifference]);

  const handleClick = useLastCallback(() => {
    if (isExpanded) {
      startViewTransition(VTT_PROFILE_BUSINESS_HOURS_COLLAPSE, () => {
        collapse();
      });
    } else {
      startViewTransition(VTT_PROFILE_BUSINESS_HOURS_EXPAND, () => {
        expand();
      });
    }
  });

  const handleTriggerOffset = useLastCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    startViewTransition(VTT_PROFILE_BUSINESS_HOURS, () => {
      if (isMyTime) {
        showInLocalTime();
      } else {
        showInMyTime();
      }
    });
  });

  return (
    <ListItem
      icon="clock"
      iconClassName={styles.icon}
      multiline
      className={buildClassName(styles.root, className)}
      style={createVtnStyle('businessHours', true)}
      isStatic={isExpanded}
      ripple
      narrow
      withColorTransition
      onClick={handleClick}
    >
      <div className={styles.top}>
        <div className={styles.left}>
          <div>{oldLang('BusinessHoursProfile')}</div>
          <div
            className={buildClassName(styles.status, isBusinessOpen && styles.statusOpen)}
          >
            {isBusinessOpen ? oldLang('BusinessHoursProfileNowOpen') : oldLang('BusinessHoursProfileNowClosed')}
          </div>
        </div>
        <Icon className={styles.arrow} style={createVtnStyle('expandArrow', true)} name={isExpanded ? 'up' : 'down'} />
      </div>
      {isExpanded && (
        <div className={styles.bottom}>
          {Boolean(timezoneMinuteDifference) && (
            <div
              className={styles.offsetTrigger}
              style={createVtnStyle('offsetTrigger')}
              role="button"
              tabIndex={0}
              onMouseDown={!IS_TOUCH_ENV ? handleTriggerOffset : undefined}
              onClick={IS_TOUCH_ENV ? handleTriggerOffset : undefined}
            >
              {oldLang(isMyTime ? 'BusinessHoursProfileSwitchMy' : 'BusinessHoursProfileSwitchLocal')}
            </div>
          )}
          <dl className={styles.timetable}>
            {DAYS.map((day) => (
              <>
                <dt className={buildClassName(styles.weekday, day === currentDay && styles.currentDay)}>
                  {formatWeekday(oldLang, day === 6 ? 0 : day + 1)}
                </dt>
                <dd className={styles.schedule}>
                  {workHours[day].map((segment) => (
                    <div>{segment}</div>
                  ))}
                </dd>
              </>
            ))}
          </dl>
        </div>
      )}
    </ListItem>
  );
};

export default memo(BusinessHours);
