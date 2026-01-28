import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';
import { LeftColumnContent } from '../../../types';
import { TelebizSettingsScreens } from '../../components/left/types';

import { selectTabState } from '../../../global/selectors';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { NotificationStatus, telebizApiClient } from '../../services';
import {
  addTelebizNotifications,
  removeTelebizNotification,
  updateTelebizNotifications,
} from '../reducers';
import {
  selectCurrentTelebizOrganization,
  selectIsTelebizAuthenticated,
  selectTelebizNotifications,
  selectTelebizNotificationsList,
  selectTelebizNotificationsUnreadCount,
} from '../selectors';

const PAGE_SIZE = 20;

function navigateToNextFocusModeChat(global: GlobalState, notificationId: number) {
  const tabId = getCurrentTabId();
  const tabState = selectTabState(global, tabId);

  // Only navigate if we're in focus mode
  const isFocusModeActive = tabState.leftColumn.contentKey === LeftColumnContent.Telebiz
    && tabState.leftColumn.telebizSettingsScreen === TelebizSettingsScreens.FocusMode;

  if (!isFocusModeActive) return;

  const pendingByChatId = global.telebiz?.notifications.pendingNotificationsByChatId || {};
  const chatIds = Object.keys(pendingByChatId);

  // Find which chat this notification belongs to and how many notifications it has
  let chatId: string | undefined;
  let chatNotificationCount = 0;
  for (const [cId, notifications] of Object.entries(pendingByChatId)) {
    if (notifications.some((n) => n.id === notificationId)) {
      chatId = cId;
      chatNotificationCount = notifications.length;
      break;
    }
  }

  // If chat still has more notifications after this one, stay on current chat
  if (chatNotificationCount > 1) {
    return;
  }

  const currentIndex = chatId ? chatIds.indexOf(chatId) : -1;
  const nextChatId = currentIndex >= 0 && currentIndex < chatIds.length - 1
    ? chatIds[currentIndex + 1]
    : chatIds[0];

  // Don't navigate to the same chat we're removing
  if (nextChatId && nextChatId !== chatId) {
    getActions().openChat({ id: nextChatId, shouldReplaceHistory: true, tabId });
  }
}

addActionHandler('loadTelebizNotifications', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const params = payload || {};
  const currentOrganization = selectCurrentTelebizOrganization(global);

  global = updateTelebizNotifications(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const response = await telebizApiClient.notifications.getNotifications({
      ...params,
      offset: params.offset || 0,
      limit: params.limit || PAGE_SIZE,
      organization_id: params.organization_id || currentOrganization?.id,
    });

    global = getGlobal();
    global = addTelebizNotifications(
      global,
      response.notifications || [],
      response.total,
      params.unreadOnly,
    );
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notifications';
    global = getGlobal();
    global = updateTelebizNotifications(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('loadTelebizNewNotifications', async (global, actions, payload): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const params = payload || {};
  const currentOrganization = selectCurrentTelebizOrganization(global);
  const currentNotifications = selectTelebizNotificationsList(global);
  const currentState = selectTelebizNotifications(global);

  try {
    const response = await telebizApiClient.notifications.getNewNotifications({
      lastId: currentNotifications.length ? currentNotifications[0].id : 0,
      organization_id: params.organization_id || currentOrganization?.id,
    });

    const all = response.notifications || [];
    const unread = all.filter((notification) => notification.status === NotificationStatus.UNREAD);

    global = getGlobal();
    const newNotifications = currentState.currentType === 'unread' ? unread : all;

    global = updateTelebizNotifications(global, {
      notifications: [...newNotifications, ...currentNotifications],
      total: currentState.total + (currentState.currentType === 'unread' ? unread.length : all.length),
      unreadCount: currentState.unreadCount + unread.length,
      allCount: currentState.allCount + all.length,
    });
    setGlobal(global);
  } catch (err) {
    // Silent fail for background fetch
  }
});

addActionHandler('resetTelebizNotifications', (global, actions, payload): void => {
  const { currentType } = payload;
  global = updateTelebizNotifications(global, {
    notifications: [],
    isLoading: false,
    initialFetch: true,
    currentType,
  });
  setGlobal(global);
});

addActionHandler('loadTelebizPendingNotifications', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const currentOrganization = selectCurrentTelebizOrganization(global);

  try {
    const response = await telebizApiClient.notifications.getNotifications({
      pendingOnly: true,
      organization_id: currentOrganization?.id,
    });

    // Build pending notifications by chat ID, tracking order separately
    const pendingNotificationsByChatId: Record<string, typeof response.notifications> = {};
    const orderedPendingChatIds: string[] = [];
    for (const notification of response.notifications) {
      const chatId = notification.metadata?.chat_id;
      if (!chatId) continue;
      if (!pendingNotificationsByChatId[chatId]) {
        pendingNotificationsByChatId[chatId] = [];
        orderedPendingChatIds.push(chatId);
      }
      pendingNotificationsByChatId[chatId].push(notification);
    }

    global = getGlobal();
    global = updateTelebizNotifications(global, {
      pendingNotificationsByChatId,
      orderedPendingChatIds,
      pendingCount: response.total,
    });
    setGlobal(global);
  } catch (err) {
    // Silent fail for background fetch
  }
});

addActionHandler('loadTelebizNotificationCounts', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  try {
    const counts = await telebizApiClient.notifications.getCounts();

    global = getGlobal();
    global = updateTelebizNotifications(global, {
      unreadCount: counts.unreadCount,
      pendingCount: counts.pendingCount,
    });
    setGlobal(global);
  } catch (err) {
    // Silent fail for background fetch
  }
});

addActionHandler('loadTelebizUnreadNotificationsCount', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  try {
    global = updateTelebizNotifications(global, { isLoading: true, error: undefined });
    setGlobal(global);

    const currentUnreadCount = selectTelebizNotificationsUnreadCount(global);
    const unreadCount = await telebizApiClient.notifications.getUnreadCount() || 0;

    global = getGlobal();
    global = updateTelebizNotifications(global, { unreadCount, isLoading: false });
    setGlobal(global);

    if (currentUnreadCount < unreadCount) {
      getActions().loadTelebizNewNotifications();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load unread count';
    global = getGlobal();
    global = updateTelebizNotifications(global, { error: errorMessage, isLoading: false });
    setGlobal(global);
  }
});

addActionHandler('markTelebizNotificationRead', async (global, actions, payload): Promise<void> => {
  const { notificationId } = payload;

  try {
    const notification = await telebizApiClient.notifications.markAsRead(notificationId);

    global = getGlobal();
    const currentState = selectTelebizNotifications(global);
    const prevNotification = currentState.notifications.find((n) => n.id === notificationId);

    let newNotifications = currentState.notifications;
    if (currentState.currentType === 'unread') {
      newNotifications = currentState.notifications.filter((existing) => existing.id !== notificationId);
    } else {
      newNotifications = currentState.notifications.map((existing) =>
        existing.id === notificationId ? notification : existing);
    }

    global = updateTelebizNotifications(global, {
      notifications: newNotifications,
      total: currentState.total - (currentState.currentType === 'unread' ? 1 : 0),
      unreadCount: currentState.unreadCount - (prevNotification?.status === NotificationStatus.UNREAD ? 1 : 0),
    });

    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to mark notification as read';
    global = getGlobal();
    global = updateTelebizNotifications(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('markTelebizNotificationUnread', async (global, actions, payload): Promise<void> => {
  const { notificationId } = payload;

  try {
    const notification = await telebizApiClient.notifications.markAsUnread(notificationId);

    global = getGlobal();
    const currentState = selectTelebizNotifications(global);
    const prevNotification = currentState.notifications.find((n) => n.id === notificationId);

    const newNotifications = currentState.notifications.map((existing) =>
      existing.id === notificationId ? notification : existing);

    global = updateTelebizNotifications(global, {
      notifications: newNotifications,
      unreadCount: currentState.unreadCount + (prevNotification?.status !== NotificationStatus.UNREAD ? 1 : 0),
    });

    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to mark notification as unread';
    global = getGlobal();
    global = updateTelebizNotifications(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('markAllTelebizNotificationsRead', async (global): Promise<void> => {
  try {
    global = updateTelebizNotifications(global, { error: undefined });
    setGlobal(global);

    await telebizApiClient.notifications.markAllAsRead();

    global = getGlobal();
    const currentState = selectTelebizNotifications(global);

    let newNotifications = currentState.notifications;
    let newTotal = currentState.total;
    if (currentState.currentType === 'unread') {
      newNotifications = [];
      newTotal = 0;
    } else {
      newNotifications = currentState.notifications.map((notification) => ({
        ...notification,
        status: NotificationStatus.READ,
        read_at: new Date(),
      }));
    }

    global = updateTelebizNotifications(global, {
      notifications: newNotifications,
      total: newTotal,
      unreadCount: 0,
    });

    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to mark all notifications as read';
    global = getGlobal();
    global = updateTelebizNotifications(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('dismissTelebizNotification', async (global, actions, payload): Promise<void> => {
  const { notificationId } = payload;

  try {
    await telebizApiClient.notifications.dismissNotification(notificationId);

    navigateToNextFocusModeChat(global, notificationId);

    global = getGlobal();
    global = removeTelebizNotification(global, notificationId);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to dismiss notification';
    global = getGlobal();
    global = updateTelebizNotifications(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('snoozeTelebizNotification', async (global, actions, payload): Promise<void> => {
  const { notificationId, snoozeMinutes } = payload;

  try {
    await telebizApiClient.notifications.snoozeNotification(notificationId, snoozeMinutes);

    navigateToNextFocusModeChat(global, notificationId);

    global = getGlobal();
    global = removeTelebizNotification(global, notificationId);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to snooze notification';
    global = getGlobal();
    global = updateTelebizNotifications(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('clearTelebizNotificationsError', (global): void => {
  global = updateTelebizNotifications(global, { error: undefined });
  setGlobal(global);
});
