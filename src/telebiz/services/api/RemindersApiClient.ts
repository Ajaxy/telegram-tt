import type {
  ApiResponse,
  CreateReminderData,
  PaginatedResponse,
  Reminder,
  UpdateReminderData,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Reminders API Client
 * Handles all reminder management operations
 */
export class RemindersApiClient extends BaseApiClient {
  /**
   * Create a new reminder
   */
  async createReminder(data: CreateReminderData): Promise<Reminder> {
    const response = await this.request<ApiResponse<{ reminder: Reminder }>>('/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.status !== 'success' || !response.data.reminder) {
      throw new Error('Failed to create reminder');
    }

    return response.data.reminder;
  }

  /**
   * Get all reminders with optional filtering
   */
  async getReminders(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'done' | 'snoozed' | 'cancelled';
    organization_id?: number;
    upcoming?: boolean;
  }): Promise<{ reminders: Reminder[]; pagination: PaginatedResponse['pagination'] }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id.toString());
    if (params?.upcoming) queryParams.append('upcoming', 'true');

    const queryString = queryParams.toString();
    const endpoint = `/reminders${queryString ? `?${queryString}` : ''}`;

    const response = await this.request<ApiResponse<PaginatedResponse<Reminder>>>(endpoint);

    if (response.status !== 'success') {
      throw new Error('Failed to fetch reminders');
    }

    // Handle both response formats
    const reminders = response.data.reminders || [];
    const pagination = response.data.pagination || {
      page: params?.page || 1,
      limit: params?.limit || 20,
      total: reminders.length,
      pages: 1,
    };

    return {
      reminders,
      pagination,
    };
  }

  /**
   * Get a specific reminder by ID
   */
  async getReminder(reminderId: number): Promise<Reminder> {
    const response = await this.request<ApiResponse<{ reminder: Reminder }>>(
      `/reminders/${reminderId}`,
    );

    if (response.status !== 'success' || !response.data.reminder) {
      throw new Error('Failed to fetch reminder');
    }

    return response.data.reminder;
  }

  /**
   * Update an existing reminder
   */
  async updateReminder(reminderId: number, data: UpdateReminderData): Promise<Reminder> {
    const response = await this.request<ApiResponse<{ reminder: Reminder }>>(
      `/reminders/${reminderId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data.reminder) {
      throw new Error('Failed to update reminder');
    }

    return response.data.reminder;
  }

  /**
   * Snooze a reminder
   */
  async snoozeReminder(reminderId: number, snoozeMinutes = 15): Promise<Reminder> {
    const response = await this.request<ApiResponse<{ reminder: Reminder }>>(
      `/reminders/${reminderId}/snooze`,
      {
        method: 'POST',
        body: JSON.stringify({ snooze_minutes: snoozeMinutes }),
      },
    );

    if (response.status !== 'success' || !response.data.reminder) {
      throw new Error('Failed to snooze reminder');
    }

    return response.data.reminder;
  }

  /**
   * Mark a reminder as complete
   */
  async completeReminder(reminderId: number): Promise<Reminder> {
    const response = await this.request<ApiResponse<{ reminder: Reminder }>>(
      `/reminders/${reminderId}/complete`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success' || !response.data.reminder) {
      throw new Error('Failed to complete reminder');
    }

    return response.data.reminder;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(reminderId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/reminders/${reminderId}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to delete reminder');
    }
  }
}
