import type { ApiResponse, MessageTemplate, PaginatedResponse } from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Templates API Client
 * Handles all message template operations
 */
export class TemplatesApiClient extends BaseApiClient {
  async getTemplates(
    category?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    templates: MessageTemplate[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    const response = await this.request<PaginatedResponse<MessageTemplate>>(
      `/templates?${params.toString()}`,
    );

    if (response.status !== 'success' || !response.data.templates) {
      throw new Error('Failed to fetch templates');
    }

    return {
      templates: response.data.templates,
      pagination: response.data.pagination,
    };
  }

  async createTemplate(data: {
    name: string;
    content: string;
    category?: string;
    tags?: string[];
    is_shared?: boolean;
  }): Promise<MessageTemplate> {
    const response = await this.request<ApiResponse<MessageTemplate>>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to create template');
    }

    return response.data;
  }

  async updateTemplate(
    templateId: string,
    data: {
      name?: string;
      content?: string;
      category?: string;
      tags?: string[];
      is_shared?: boolean;
    },
  ): Promise<MessageTemplate> {
    const response = await this.request<ApiResponse<MessageTemplate>>(
      `/templates/${templateId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update template');
    }

    return response.data;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const response = await this.request<ApiResponse<void>>(`/templates/${templateId}`, {
      method: 'DELETE',
    });

    if (response.status !== 'success') {
      throw new Error('Failed to delete template');
    }
  }

  async useTemplate(templateId: string): Promise<MessageTemplate> {
    const response = await this.request<ApiResponse<MessageTemplate>>(
      `/templates/${templateId}/use`,
      {
        method: 'POST',
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to use template');
    }

    return response.data;
  }

  async searchTemplates(
    query: string,
    category?: string,
    limit = 10,
  ): Promise<MessageTemplate[]> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    const response = await this.request<ApiResponse<MessageTemplate[]>>(
      `/templates/search?${params.toString()}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to search templates');
    }

    return response.data;
  }

  async getCategories(): Promise<string[]> {
    const response = await this.request<ApiResponse<string[]>>('/templates/categories');

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch template categories');
    }

    return response.data;
  }

  async getTemplateAnalytics(): Promise<{
    mostUsed: MessageTemplate[];
    usageByCategory: Record<string, number>;
    usageOverTime: Array<{ date: string; count: number }>;
  }> {
    const response = await this.request<ApiResponse<{
      mostUsed: MessageTemplate[];
      usageByCategory: Record<string, number>;
      usageOverTime: Array<{ date: string; count: number }>;
    }>>('/templates/analytics');

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch template analytics');
    }

    return response.data;
  }
}
