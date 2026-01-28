import type { GlobalState } from '../../../global/types';
import type { Notification } from '../../services/types';
import type { TelebizNotificationsState } from '../types';
import { NotificationStatus } from '../../services/types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizNotifications<T extends GlobalState>(
  global: T,
  update: Partial<TelebizNotificationsState>,
): T {
  const currentNotifications = global.telebiz?.notifications || INITIAL_TELEBIZ_STATE.notifications;

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      notifications: {
        ...currentNotifications,
        ...update,
      },
    },
  };
}

export function addTelebizNotifications<T extends GlobalState>(
  global: T,
  notifications: Notification[],
  total: number,
  isUnread?: boolean,
): T {
  const current = global.telebiz?.notifications || INITIAL_TELEBIZ_STATE.notifications;

  // Deduplicate by notification ID - new notifications override existing ones
  const existingIds = new Set(notifications.map((n) => n.id));
  const filteredCurrent = current.notifications.filter((n) => !existingIds.has(n.id));
  const newNotifications = [...filteredCurrent, ...notifications];

  return updateTelebizNotifications(global, {
    notifications: newNotifications,
    total,
    isLoading: false,
    initialFetch: false,
    ...(isUnread ? { unreadCount: total } : { allCount: total }),
  });
}

export function updateTelebizNotificationStatus<T extends GlobalState>(
  global: T,
  notificationId: number,
  notification: Notification,
): T {
  const current = global.telebiz?.notifications || INITIAL_TELEBIZ_STATE.notifications;
  const updatedNotifications = current.notifications.map((n) =>
    n.id === notificationId ? notification : n);

  return updateTelebizNotifications(global, {
    notifications: updatedNotifications,
  });
}

export function removeTelebizNotification<T extends GlobalState>(
  global: T,
  notificationId: number,
): T {
  const current = global.telebiz?.notifications || INITIAL_TELEBIZ_STATE.notifications;

  // Try to find in notifications array first
  let removedNotification = current.notifications.find((n) => n.id === notificationId);
  let chatId = removedNotification?.metadata?.chat_id;

  // If not found in notifications, search in pending
  if (!removedNotification) {
    for (const [cId, notifications] of Object.entries(current.pendingNotificationsByChatId)) {
      const found = notifications.find((n) => n.id === notificationId);
      if (found) {
        removedNotification = found;
        chatId = cId;
        break;
      }
    }
  }

  // If still not found anywhere, nothing to remove
  if (!removedNotification) return global;

  // Remove from notifications array
  const updatedNotifications = current.notifications.filter((n) => n.id !== notificationId);
  const wasInNotifications = current.notifications.length !== updatedNotifications.length;

  // Remove from pending notifications
  let pendingNotificationsByChatId = current.pendingNotificationsByChatId;
  let orderedPendingChatIds = current.orderedPendingChatIds;
  let pendingCount = current.pendingCount;
  let wasInPending = false;

  if (chatId && pendingNotificationsByChatId[chatId]) {
    const originalLength = pendingNotificationsByChatId[chatId].length;
    const updatedChatNotifications = pendingNotificationsByChatId[chatId].filter(
      (n) => n.id !== notificationId,
    );
    wasInPending = originalLength !== updatedChatNotifications.length;

    if (wasInPending) {
      pendingNotificationsByChatId = { ...pendingNotificationsByChatId };
      if (updatedChatNotifications.length === 0) {
        delete pendingNotificationsByChatId[chatId];
        orderedPendingChatIds = orderedPendingChatIds.filter((id) => id !== chatId);
      } else {
        pendingNotificationsByChatId[chatId] = updatedChatNotifications;
      }
      pendingCount = Math.max(0, pendingCount - 1);
    }
  }

  return updateTelebizNotifications(global, {
    notifications: updatedNotifications,
    pendingNotificationsByChatId,
    orderedPendingChatIds,
    pendingCount,
    // Only decrement counts if it was in the notifications array
    ...(wasInNotifications && {
      total: current.total - 1,
      allCount: current.allCount - 1,
      unreadCount: removedNotification.status === NotificationStatus.UNREAD
        ? current.unreadCount - 1
        : current.unreadCount,
    }),
  });
}
