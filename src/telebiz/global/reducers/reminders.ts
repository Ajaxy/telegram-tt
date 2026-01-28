import type { GlobalState } from '../../../global/types';
import type { Reminder } from '../../services/types';
import type { RemindersByMessageId, TelebizRemindersState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizReminders<T extends GlobalState>(
  global: T,
  update: Partial<TelebizRemindersState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      reminders: {
        ...(global.telebiz?.reminders || INITIAL_TELEBIZ_STATE.reminders),
        ...update,
      },
    },
  };
}

function buildRemindersByChatAndMessageId(
  reminders: Reminder[],
): Record<string, RemindersByMessageId> {
  const now = new Date().toISOString();
  return reminders
    .filter((reminder) => reminder.remind_at >= now)
    .reduce((acc, reminder) => {
      acc[reminder.chat_id] = acc[reminder.chat_id] || {};
      if (reminder.message_id) {
        acc[reminder.chat_id][reminder.message_id.toString()] = reminder;
      }
      return acc;
    }, {} as Record<string, RemindersByMessageId>);
}

export function setTelebizReminders<T extends GlobalState>(
  global: T,
  reminders: Reminder[],
): T {
  return updateTelebizReminders(global, {
    reminders,
    remindersByChatAndMessageId: buildRemindersByChatAndMessageId(reminders),
    isLoading: false,
  });
}

export function addTelebizReminder<T extends GlobalState>(
  global: T,
  reminder: Reminder,
): T {
  const current = global.telebiz?.reminders || INITIAL_TELEBIZ_STATE.reminders;
  const updatedReminders = [...current.reminders, reminder];

  return updateTelebizReminders(global, {
    reminders: updatedReminders,
    remindersByChatAndMessageId: buildRemindersByChatAndMessageId(updatedReminders),
  });
}

export function updateTelebizReminder<T extends GlobalState>(
  global: T,
  reminderId: number,
  reminder: Reminder,
): T {
  const current = global.telebiz?.reminders || INITIAL_TELEBIZ_STATE.reminders;
  const updatedReminders = current.reminders.map((r) =>
    r.id === reminderId ? reminder : r);

  return updateTelebizReminders(global, {
    reminders: updatedReminders,
    remindersByChatAndMessageId: buildRemindersByChatAndMessageId(updatedReminders),
  });
}

export function removeTelebizReminder<T extends GlobalState>(
  global: T,
  reminderId: number,
): T {
  const current = global.telebiz?.reminders || INITIAL_TELEBIZ_STATE.reminders;
  const updatedReminders = current.reminders.filter((r) => r.id !== reminderId);

  return updateTelebizReminders(global, {
    reminders: updatedReminders,
    remindersByChatAndMessageId: buildRemindersByChatAndMessageId(updatedReminders),
  });
}
