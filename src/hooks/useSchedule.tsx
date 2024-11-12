import React, { useState } from '../lib/teact/teact';

import { SCHEDULED_WHEN_ONLINE } from '../config';
import { getDayStartAt } from '../util/dates/dateFormat';
import { getServerTimeOffset } from '../util/serverTime';
import useLastCallback from './useLastCallback';
import useOldLang from './useOldLang';

import CalendarModal from '../components/common/CalendarModal.async';

type OnScheduledCallback = (scheduledAt: number) => void;

const useSchedule = (
  canScheduleUntilOnline?: boolean,
  onCancel?: () => void,
  openAt?: number,
) => {
  const lang = useOldLang();
  const [onScheduled, setOnScheduled] = useState<OnScheduledCallback | undefined>();

  const handleMessageSchedule = useLastCallback((date: Date, isWhenOnline = false) => {
    // Scheduled time can not be less than 10 seconds in future
    const scheduledAt = Math.round(Math.max(date.getTime(), Date.now() + 60 * 1000) / 1000)
      + (isWhenOnline ? 0 : getServerTimeOffset());
    onScheduled?.(scheduledAt);
    setOnScheduled(undefined);
  });

  const handleMessageScheduleUntilOnline = useLastCallback(() => {
    handleMessageSchedule(new Date(SCHEDULED_WHEN_ONLINE * 1000), true);
  });

  const handleCloseCalendar = useLastCallback(() => {
    setOnScheduled(undefined);
    onCancel?.();
  });

  const requestCalendar = useLastCallback((whenScheduled: OnScheduledCallback) => {
    setOnScheduled(() => whenScheduled);
  });

  const scheduledDefaultDate = openAt ? new Date(openAt * 1000) : new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  const calendar = (
    <CalendarModal
      isOpen={Boolean(onScheduled)}
      withTimePicker
      selectedAt={scheduledDefaultDate.getTime()}
      maxAt={getDayStartAt(scheduledMaxDate)}
      isFutureMode
      secondButtonLabel={canScheduleUntilOnline ? lang('Schedule.SendWhenOnline') : undefined}
      onClose={handleCloseCalendar}
      onSubmit={handleMessageSchedule}
      onSecondButtonClick={canScheduleUntilOnline ? handleMessageScheduleUntilOnline : undefined}
    />
  );

  return [requestCalendar, calendar] as const;
};

export default useSchedule;
