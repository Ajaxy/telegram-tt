/* eslint-disable react/no-deprecated */
/* eslint-disable no-null/no-null */
/* eslint-disable react/jsx-no-bind */
import { unmountComponentAtNode } from 'react-dom';
import React, { useState } from '../lib/teact/teact';

import { SCHEDULED_WHEN_ONLINE } from '../config';
import { getServerTimeOffset } from '../util/serverTime';
import useLastCallback from './useLastCallback';

import CommandMenuCalendar from '../components/common/commandmenu/CommandMenuCalendar';

type OnScheduledCallback = (scheduledAt: number) => void;

const useSchedule = (
  canScheduleUntilOnline?: boolean,
  isChatWithSelf?: boolean,
  onCancel?: () => void,
  openAt?: number,
) => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [onScheduled, setOnScheduled] = useState<OnScheduledCallback | undefined>();

  const handleMessageSchedule = useLastCallback((date: Date, isWhenOnline = false) => {
    // Преобразование даты в таймстамп
    const scheduledAt = Math.round(date.getTime() / 1000) + (isWhenOnline ? 0 : getServerTimeOffset());
    onScheduled?.(scheduledAt);
    setOnScheduled(undefined);
  });

  const handleMessageScheduleUntilOnline = useLastCallback(() => {
    handleMessageSchedule(new Date(SCHEDULED_WHEN_ONLINE * 1000), true);
  });

  const cmdkRoot = document.getElementById('cmdk-root');
  const handleCloseCalendar = useLastCallback(() => {
    setOnScheduled(undefined);
    onCancel?.();
    setMenuOpen(false);
    if (cmdkRoot) {
      unmountComponentAtNode(cmdkRoot);
    }
    return null;
  });

  const requestCalendar = useLastCallback((whenScheduled: OnScheduledCallback) => {
    setMenuOpen(true);
    setOnScheduled(() => whenScheduled);
  });

  const scheduledDefaultDate = openAt ? new Date(openAt * 1000) : new Date();
  scheduledDefaultDate.setSeconds(0);
  scheduledDefaultDate.setMilliseconds(0);

  const scheduledMaxDate = new Date();
  scheduledMaxDate.setFullYear(scheduledMaxDate.getFullYear() + 1);

  const calendar = (
    <CommandMenuCalendar
      isOpen={isMenuOpen}
      setOpen={setMenuOpen}
      onClose={handleCloseCalendar}
      onSubmit={handleMessageSchedule}
      onSendWhenOnline={canScheduleUntilOnline ? handleMessageScheduleUntilOnline : undefined}
      isReminder={isChatWithSelf}
    />
  );

  return [requestCalendar, calendar] as const;
};

export default useSchedule;
