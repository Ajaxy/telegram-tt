import type { GlobalState } from '../../../global/types';
import type { Notification } from '../../services/types';
import type { TelebizNotificationsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizNotifications(global: GlobalState): TelebizNotificationsState {
  return global.telebiz?.notifications || INITIAL_TELEBIZ_STATE.notifications;
}

export function selectTelebizNotificationsList(global: GlobalState): Notification[] {
  return selectTelebizNotifications(global).notifications;
}

export function selectTelebizPendingNotificationsByChatId(global: GlobalState, chatId: string): Notification[] {
  return selectTelebizNotifications(global).pendingNotificationsByChatId?.[chatId] || [];
}

export function selectTelebizPendingNotificationsByChatIdMap(
  global: GlobalState,
): Record<string, Notification[]> {
  return selectTelebizNotifications(global).pendingNotificationsByChatId || {};
}

export function selectTelebizOrderedPendingChatIds(global: GlobalState): string[] {
  return selectTelebizNotifications(global).orderedPendingChatIds || [];
}

export function selectChatHasTelebizNotifications(global: GlobalState, chatId: string): boolean {
  const notifications = selectTelebizPendingNotificationsByChatId(global, chatId);
  return notifications.length > 0;
}

export function selectTelebizNotificationsUnreadCount(global: GlobalState): number {
  return selectTelebizNotifications(global).unreadCount;
}

export function selectTelebizNotificationsTotal(global: GlobalState): number {
  return selectTelebizNotifications(global).total;
}

export function selectTelebizNotificationsIsLoading(global: GlobalState): boolean {
  return selectTelebizNotifications(global).isLoading;
}

export function selectTelebizNotificationsError(global: GlobalState): string | undefined {
  return selectTelebizNotifications(global).error;
}

export function selectTelebizNotificationsCurrentType(global: GlobalState): 'all' | 'unread' {
  return selectTelebizNotifications(global).currentType;
}

export function selectTelebizNotificationsInitialFetch(global: GlobalState): boolean {
  return selectTelebizNotifications(global).initialFetch;
}
