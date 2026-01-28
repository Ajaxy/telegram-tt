import type {
  ApiResponse,
  TemplatesChat,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Reminders API Client
 * Handles all reminder management operations
 */
export class TemplatesChatsApiClient extends BaseApiClient {
  /**
   * Set chat as template chat
   */
  async addTemplatesChat(chatId: string): Promise<TemplatesChat> {
    const response = await this.request<ApiResponse<{ templatesChat: TemplatesChat }>>('/templates-chats', {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    });

    if (response.status !== 'success' || !response.data.templatesChat) {
      throw new Error('Failed to set chat as template chat');
    }
    return response.data.templatesChat;
  }

  /**
   * Remove chat from templates chats
   */
  async removeTemplatesChat(chatId: string): Promise<void> {
    const response = await this.request<ApiResponse<void>>(`/templates-chats/${chatId}`, {
      method: 'DELETE',
    });

    if (response.status !== 'success') {
      throw new Error('Failed to remove chat from templates chats');
    }
  }

  async updateTemplatesChatsList(chatIds: string[]): Promise<TemplatesChat[]> {
    const response = await this.request<ApiResponse<TemplatesChat[]>>('/templates-chats', {
      method: 'PUT',
      body: JSON.stringify({ chatIds }),
    });
    return response.data;
  }

  /**
   * Get all templates chats by user id and organization id
   */
  async getTemplatesChats(): Promise<TemplatesChat[]> {
    const response = await this.request<ApiResponse<TemplatesChat[]>>('/templates-chats');
    return response.data;
  }
}
