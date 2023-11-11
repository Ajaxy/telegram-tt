/* eslint-disable no-console */
/* eslint-disable react/jsx-no-bind */
import React, { useState } from '../lib/teact/teact';

import { SCHEDULED_WHEN_ONLINE } from '../config';
import { getServerTimeOffset } from '../util/serverTime';
import useLastCallback from './useLastCallback';

import CommandMenuCalendarAsync from '../components/common/CommandMenuCalendarAsync';

type OnScheduledCallback = (scheduledAt: number) => void;

const useSchedule = (
  canScheduleUntilOnline?: boolean,
  onCancel?: () => void,
  openAt?: number,
) => {
  const [isOpen, setIsOpen] = useState(false);
  const [onScheduled, setOnScheduled] = useState<OnScheduledCallback | undefined>();

  const handleMessageSchedule = useLastCallback((date: Date, isWhenOnline = false) => {
    console.log('Вызов handleMessageSchedule с датой:', date);
    // Преобразование даты в таймстамп
    const scheduledAt = Math.round(date.getTime() / 1000) + (isWhenOnline ? 0 : getServerTimeOffset());
    onScheduled?.(scheduledAt);
    setIsOpen(false);
  });

  const handleMessageScheduleUntilOnline = useLastCallback(() => {
    handleMessageSchedule(new Date(SCHEDULED_WHEN_ONLINE * 1000), true);
  });

  const handleCloseCalendar = useLastCallback(() => {
    console.log('Закрытие меню через handleCloseCalendar');
    setIsOpen(false);
    if (onCancel) {
      onCancel();
    }
  });

  const requestCalendar = useLastCallback((whenScheduled: OnScheduledCallback) => {
    console.log('Открытие меню');
    setIsOpen(true);
    setOnScheduled(() => whenScheduled);
  });

  const scheduledDefaultDate = openAt ? new Date(openAt * 1000) : new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  const calendar = isOpen && (
    <CommandMenuCalendarAsync
      isOpen={isOpen}
      onClose={handleCloseCalendar}
      onSubmit={handleMessageSchedule}
      onSendWhenOnline={canScheduleUntilOnline ? handleMessageScheduleUntilOnline : undefined}
    />
  );

  return [requestCalendar, calendar] as const;
};

export default useSchedule;
