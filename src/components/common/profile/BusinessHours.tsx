import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';

import type { ApiBusinessWorkHours } from '../../../api/types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import { formatTime, formatWeekday } from '../../../util/dates/dateFormat';
import {
  getUtcOffset, getWeekStart, shiftTimeRanges, splitDays,
} from '../../../util/dates/workHours';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useSelectorSignal from '../../../hooks/data/useSelectorSignal';
import useInterval from '../../../hooks/schedulers/useInterval';
import useDerivedState from '../../../hooks/useDerivedState';
import useFlag from '../../../hooks/useFlag';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import ListItem from '../../ui/ListItem';
import Transition, { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../ui/Transition';
import Icon from '../icons/Icon';

import styles from './BusinessHours.module.scss';

const DAYS = Array.from({ length: 7 }, (_, i) => i);

type OwnProps = {
  businessHours: ApiBusinessWorkHours;
};

const BusinessHours = ({
  businessHours,
}: OwnProps) => {
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const [isExpanded, expand, collapse] = useFlag(false);
  const [isMyTime, showInMyTime, showInLocalTime] = useFlag(false);
  const lang = useOldLang();
  const forceUpdate = useForceUpdate();

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
        result[day] = [lang('BusinessHoursDayClosed')];
        return;
      }

      result[day] = segments.map(({ startMinute, endMinute }) => {
        if (endMinute - startMinute === 24 * 60) return lang('BusinessHoursDayFullOpened');
        const start = formatTime(lang, weekStart + startMinute * 60 * 1000);
        const end = formatTime(lang, weekStart + endMinute * 60 * 1000);
        return `${start} – ${end}`;
      });
    });

    return result;
  }, [businessHours.workHours, isMyTime, lang, timezoneMinuteDifference]);

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
      collapse();
    } else {
      expand();
    }
  });

  const handleTriggerOffset = useLastCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (isMyTime) {
      showInLocalTime();
    } else {
      showInMyTime();
    }
  });

  useEffect(() => {
    if (!isExpanded) return;
    const slide = document.querySelector<HTMLElement>(`.${ACTIVE_SLIDE_CLASS_NAME} > .${styles.timetable}`);
    if (!slide) return;

    const height = slide.offsetHeight;
    requestMutation(() => {
      transitionRef.current!.style.height = `${height}px`;
    });
  }, [isExpanded]);

  const handleAnimationStart = useLastCallback(() => {
    const slide = document.querySelector<HTMLElement>(`.${TO_SLIDE_CLASS_NAME} > .${styles.timetable}`)!;

    requestMeasure(() => {
      const height = slide.offsetHeight;
      requestMutation(() => {
        transitionRef.current!.style.height = `${height}px`;
      });
    });
  });

  return (
    <ListItem
      icon="clock"
      iconClassName={styles.icon}
      multiline
      className={styles.root}
      isStatic={isExpanded}
      ripple
      narrow
      withColorTransition
      onClick={handleClick}
    >
      <div className={styles.top}>
        <div className={styles.left}>
          <div>{lang('BusinessHoursProfile')}</div>
          <div className={buildClassName(styles.status, isBusinessOpen && styles.statusOpen)}>
            {isBusinessOpen ? lang('BusinessHoursProfileNowOpen') : lang('BusinessHoursProfileNowClosed')}
          </div>
        </div>
        <Icon className={styles.arrow} name={isExpanded ? 'up' : 'down'} />
      </div>
      {isExpanded && (
        <div className={styles.bottom}>
          {Boolean(timezoneMinuteDifference) && (
            <div
              className={styles.offsetTrigger}
              role="button"
              tabIndex={0}
              onMouseDown={!IS_TOUCH_ENV ? handleTriggerOffset : undefined}
              onClick={IS_TOUCH_ENV ? handleTriggerOffset : undefined}
            >
              {lang(isMyTime ? 'BusinessHoursProfileSwitchMy' : 'BusinessHoursProfileSwitchLocal')}
            </div>
          )}
          <Transition
            className={styles.transition}
            ref={transitionRef}
            name="fade"
            activeKey={Number(isMyTime)}
            onStart={handleAnimationStart}
          >
            <dl className={styles.timetable}>
              {DAYS.map((day) => (
                <>
                  <dt className={buildClassName(styles.weekday, day === currentDay && styles.currentDay)}>
                    {formatWeekday(lang, day === 6 ? 0 : day + 1)}
                  </dt>
                  <dd className={styles.schedule}>
                    {workHours[day].map((segment) => (
                      <div>{segment}</div>
                    ))}
                  </dd>
                </>
              ))}
            </dl>
          </Transition>
        </div>
      )}
    </ListItem>
  );
};

export default memo(BusinessHours);
