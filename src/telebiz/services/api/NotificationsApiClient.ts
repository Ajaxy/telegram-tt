import type {
  ApiResponse,
  Notification,
  ResponseWithTotal,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Notifications API Client
 * Handles all notification management operations
 */
export class NotificationsApiClient extends BaseApiClient {
  /**
   * Get all notifications with optional filtering
   */
  async getNotifications(params?: {
    offset?: number;
    limit?: number;
    unreadOnly?: boolean;
    pendingOnly?: boolean;
    organization_id?: number;
  }): Promise<{ notifications: Notification[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.unreadOnly) queryParams.append('unread_only', params.unreadOnly.toString());
    if (params?.pendingOnly) queryParams.append('pending_only', params.pendingOnly.toString());
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id.toString());

    const queryString = queryParams.toString();
    const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<ApiResponse<ResponseWithTotal<Notification>>>(endpoint);

    if (response.status !== 'success') {
      throw new Error('Failed to fetch notifications');
    }

    return {
      notifications: response.data.notifications || [],
      total: response.data.total || 0,
    };
  }

  /**
   * Get notifications since last fetched notification id
   */

  async getNewNotifications(params?: {
    lastId: number;
    unreadOnly?: boolean;
    organization_id?: number;
  }): Promise<{ notifications: Notification[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.lastId) queryParams.append('last_id', params.lastId.toString());
    if (params?.unreadOnly) queryParams.append('unread_only', params.unreadOnly.toString());
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id.toString());

    const queryString = queryParams.toString();
    const endpoint = `/notifications/new${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<ApiResponse<ResponseWithTotal<Notification>>>(endpoint);

    if (response.status !== 'success') {
      throw new Error('Failed to fetch notifications');
    }

    return {
      notifications: response.data.notifications || [],
      total: response.data.total || 0,
    };
  }

  /**
   * Get the number of unread notifications
   */
  async getUnreadCount(): Promise<number> {
    const response = await this.request<ApiResponse<{ unread_count: number }>>(
      `/notifications/unread-count`,
    );

    if (response.status !== 'success') {
      throw new Error('Failed to fetch unread count');
    }

    return response.data.unread_count;
  }

  /**
   * Get notification counts (unread and pending/not-dismissed)
   */
  async getCounts(): Promise<{ unreadCount: number; pendingCount: number }> {
    const response = await this.request<ApiResponse<{ unread_count: number; pending_count: number }>>(
      `/notifications/counts`,
    );

    if (response.status !== 'success') {
      throw new Error('Failed to fetch notification counts');
    }

    return {
      unreadCount: response.data.unread_count,
      pendingCount: response.data.pending_count,
    };
  }

  /**
   * Mark as read
   */
  async markAsRead(notificationId: number): Promise<Notification> {
    const response = await this.request<ApiResponse<{ notification: Notification }>>(
      `/notifications/${notificationId}/read`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success' || !response.data.notification) {
      throw new Error('Failed to mark as read');
    }

    return response.data.notification;
  }

  /**
   * Mark as unread
   */
  async markAsUnread(notificationId: number): Promise<Notification> {
    const response = await this.request<ApiResponse<{ notification: Notification }>>(
      `/notifications/${notificationId}/unread`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success' || !response.data.notification) {
      throw new Error('Failed to mark as unread');
    }

    return response.data.notification;
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/notifications/mark-all-read`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to mark all as read');
    }
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(notificationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/notifications/${notificationId}/dismiss`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to dismiss notification');
    }
  }

  /**
   * Snooze a notification
   */
  async snoozeNotification(notificationId: number, snoozeMinutes = 15): Promise<Notification> {
    const response = await this.request<ApiResponse<{ notification: Notification }>>(
      `/notifications/${notificationId}/snooze`,
      {
        method: 'POST',
        body: JSON.stringify({ snooze_minutes: snoozeMinutes }),
      },
    );

    if (response.status !== 'success' || !response.data.notification) {
      throw new Error('Failed to snooze notification');
    }

    return response.data.notification;
  }
}
