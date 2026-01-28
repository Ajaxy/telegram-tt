import type {
  ApiResponse,
  ChatActivitySync,
  ChatFollowupSettings,
  UserSettings,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Settings API Client
 * Handles user settings, chat followup settings, and activity sync operations
 */
export class SettingsApiClient extends BaseApiClient {
  /**
   * Sync chat activities to backend
   * POST /activity/sync
   */
  async syncActivity(
    organizationId: number,
    activities: ChatActivitySync[],
  ): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      '/activity/sync',
      {
        method: 'POST',
        body: JSON.stringify({
          organization_id: organizationId,
          activities,
        }),
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to sync activities');
    }
  }

  /**
   * Get user settings
   * GET /settings
   */
  async getSettings(organizationId: number): Promise<UserSettings> {
    const queryParams = new URLSearchParams();
    queryParams.append('organization_id', String(organizationId));

    const response = await this.request<ApiResponse<{ settings: UserSettings }>>(
      `/settings?${queryParams.toString()}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch settings');
    }

    return response.data.settings;
  }

  /**
   * Update user settings
   * PUT /settings
   */
  async updateSettings(
    organizationId: number,
    settings: Partial<UserSettings>,
  ): Promise<UserSettings> {
    const response = await this.request<ApiResponse<{ settings: UserSettings }>>(
      '/settings',
      {
        method: 'PUT',
        body: JSON.stringify({
          organization_id: organizationId,
          ...settings,
        }),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update settings');
    }

    return response.data.settings;
  }

  /**
   * Get all chat followup settings
   * GET /settings/chats
   */
  async getAllChatSettings(
    organizationId: number,
  ): Promise<ChatFollowupSettings[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('organization_id', String(organizationId));

    const response = await this.request<ApiResponse<{ settings: ChatFollowupSettings[] }>>(
      `/settings/chats?${queryParams.toString()}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch chat settings');
    }

    return response.data.settings;
  }

  /**
   * Get chat followup settings for a specific chat
   * GET /settings/chats/:chatId
   */
  async getChatSettings(
    organizationId: number,
    chatId: string,
  ): Promise<ChatFollowupSettings> {
    const queryParams = new URLSearchParams();
    queryParams.append('organization_id', String(organizationId));

    const response = await this.request<ApiResponse<{ settings: ChatFollowupSettings }>>(
      `/settings/chats/${chatId}?${queryParams.toString()}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch chat settings');
    }

    return response.data.settings;
  }

  /**
   * Update chat followup settings
   * PUT /settings/chats/:chatId
   */
  async updateChatSettings(
    organizationId: number,
    chatId: string,
    settings: Partial<Omit<ChatFollowupSettings, 'chat_id'>>,
    activity?: Partial<ChatActivitySync>,
  ): Promise<ChatFollowupSettings> {
    const response = await this.request<ApiResponse<{ settings: ChatFollowupSettings }>>(
      `/settings/chats/${chatId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          organization_id: organizationId,
          ...settings,
          ...activity,
        }),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update chat settings');
    }

    return response.data.settings;
  }
}
