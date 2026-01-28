import { addActionHandler, getGlobal, setGlobal } from '../../../global';

import type { UpdateReminderData } from '../../services/types';

import { telebizApiClient } from '../../services';
import {
  addTelebizReminder,
  removeTelebizReminder,
  setTelebizReminders,
  updateTelebizReminder,
  updateTelebizReminders,
} from '../reducers';
import { selectCurrentTelebizOrganization, selectIsTelebizAuthenticated } from '../selectors';

addActionHandler('loadTelebizReminders', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const params = payload || {};
  const currentOrganization = selectCurrentTelebizOrganization(global);

  global = updateTelebizReminders(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const response = await telebizApiClient.reminders.getReminders({
      ...params,
      organization_id: params.organization_id || currentOrganization?.id,
    });

    // Filter expired reminders
    const now = new Date().toISOString();
    const activeReminders = (response.reminders || []).filter(
      (reminder) => reminder.remind_at >= now,
    );

    global = getGlobal();
    global = setTelebizReminders(global, activeReminders);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch reminders';
    global = getGlobal();
    global = updateTelebizReminders(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('createTelebizReminder', async (global, actions, payload): Promise<void> => {
  const data = payload;
  const currentOrganization = selectCurrentTelebizOrganization(global);

  try {
    const reminder = await telebizApiClient.reminders.createReminder({
      ...data,
      organization_id: data.organization_id || currentOrganization?.id,
    });

    // Only add if not expired
    const now = new Date().toISOString();
    if (reminder.remind_at >= now) {
      global = getGlobal();
      global = addTelebizReminder(global, reminder);
      setGlobal(global);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create reminder';
    global = getGlobal();
    global = updateTelebizReminders(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('updateTelebizReminder', async (global, actions, payload): Promise<void> => {
  const { reminderId, data } = payload as { reminderId: number; data: UpdateReminderData };

  try {
    const reminder = await telebizApiClient.reminders.updateReminder(reminderId, data);

    global = getGlobal();
    global = updateTelebizReminder(global, reminderId, reminder);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update reminder';
    global = getGlobal();
    global = updateTelebizReminders(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('completeTelebizReminder', async (global, actions, payload): Promise<void> => {
  const { reminderId } = payload;

  try {
    const reminder = await telebizApiClient.reminders.completeReminder(reminderId);

    global = getGlobal();
    global = updateTelebizReminder(global, reminderId, reminder);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to complete reminder';
    global = getGlobal();
    global = updateTelebizReminders(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('deleteTelebizReminder', async (global, actions, payload): Promise<void> => {
  const { reminderId } = payload;

  try {
    await telebizApiClient.reminders.deleteReminder(reminderId);

    global = getGlobal();
    global = removeTelebizReminder(global, reminderId);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete reminder';
    global = getGlobal();
    global = updateTelebizReminders(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('clearTelebizRemindersError', (global) => {
  return updateTelebizReminders(global, { error: undefined });
});
