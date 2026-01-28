import type { GlobalState } from '../../../global/types';
import type { Reminder } from '../../services/types';
import type { RemindersByMessageId, TelebizRemindersState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizReminders(global: GlobalState): TelebizRemindersState {
  return global.telebiz?.reminders || INITIAL_TELEBIZ_STATE.reminders;
}

export function selectTelebizRemindersList(global: GlobalState): Reminder[] {
  return selectTelebizReminders(global).reminders;
}

export function selectTelebizRemindersByChatId(
  global: GlobalState,
  chatId: string,
): RemindersByMessageId | undefined {
  return selectTelebizReminders(global).remindersByChatAndMessageId[chatId];
}

export function selectTelebizReminderForMessage(
  global: GlobalState,
  chatId: string,
  messageId: number,
): Reminder | undefined {
  return selectTelebizRemindersByChatId(global, chatId)?.[messageId.toString()];
}

export function selectTelebizRemindersIsLoading(global: GlobalState): boolean {
  return selectTelebizReminders(global).isLoading;
}

export function selectTelebizRemindersError(global: GlobalState): string | undefined {
  return selectTelebizReminders(global).error;
}

export function selectTelebizPendingReminders(global: GlobalState): Reminder[] {
  const reminders = selectTelebizRemindersList(global);
  return reminders
    .filter((r) => r.status === 'pending')
    .sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());
}
