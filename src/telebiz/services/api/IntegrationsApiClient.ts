import type {
  ApiResponse,
  ConnectionTestResult,
  CreateProviderEntityData,
  DeleteProviderEntityData,
  Integration,
  IntegrationFilters,
  IntegrationStats,
  LinkProviderEntityData,
  OAuthStartResponse,
  PaginatedResponse,
  Provider,
  ProviderEntity,
  ProviderEntityType,
  ProviderPipeline,
  ProviderRelationship,
  StartOAuthData,
} from '../types';

import { isJsonString } from '../../util/general';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Integrations API Client
 * Handles all OAuth integration and webhook management operations
 */
export class IntegrationsApiClient extends BaseApiClient {
  // Provider Discovery
  async getProviders(): Promise<Provider[]> {
    const response = await this.request<ApiResponse<{ providers: Provider[] }>>(
      '/integrations/providers',
    );

    if (response.status !== 'success' || !response.data.providers) {
      throw new Error('Failed to fetch providers');
    }

    return response.data.providers;
  }

  async getProvidersByCategory(): Promise<Record<string, Provider[]>> {
    const response = await this.request<ApiResponse<{ categories: Record<string, Provider[]> }>>(
      '/integrations/providers/categories',
    );

    if (response.status !== 'success' || !response.data.categories) {
      throw new Error('Failed to fetch providers by category');
    }

    return response.data.categories;
  }

  // OAuth Flow
  async startOAuth(data: StartOAuthData): Promise<OAuthStartResponse> {
    const response = await this.request<ApiResponse<OAuthStartResponse>>(
      '/integrations/oauth/start',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to start OAuth flow');
    }

    return response.data;
  }

  // Integration Management
  async getIntegrations(filters: IntegrationFilters = {}): Promise<PaginatedResponse<Integration>> {
    const queryParams = new URLSearchParams();

    if (filters.organizationId) queryParams.append('organizationId', String(filters.organizationId));
    if (filters.teamId) queryParams.append('teamId', String(filters.teamId));
    if (filters.provider) queryParams.append('provider', filters.provider);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.page) queryParams.append('page', String(filters.page));
    if (filters.limit) queryParams.append('limit', String(filters.limit));

    const url = `/integrations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<ApiResponse<PaginatedResponse<Integration>>>(url);

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch integrations');
    }

    return response.data;
  }

  async getIntegration(integrationId: number): Promise<Integration> {
    const response = await this.request<ApiResponse<{ integration: Integration }>>(
      `/integrations/${integrationId}`,
    );

    if (response.status !== 'success' || !response.data.integration) {
      throw new Error('Failed to fetch integration');
    }

    return response.data.integration;
  }

  async getIntegrationStats(): Promise<IntegrationStats> {
    const response = await this.request<ApiResponse<{ stats: IntegrationStats }>>(
      '/integrations/stats',
    );

    if (response.status !== 'success' || !response.data.stats) {
      throw new Error('Failed to fetch integration stats');
    }

    return response.data.stats;
  }

  // Integration Actions
  async refreshIntegration(integrationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/integrations/${integrationId}/refresh`,
      { method: 'POST' },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to refresh integration');
    }
  }

  async testConnection(integrationId: number): Promise<ConnectionTestResult> {
    const response = await this.request<ApiResponse<ConnectionTestResult>>(
      `/integrations/${integrationId}/test`,
      { method: 'POST' },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to test connection');
    }

    return response.data;
  }

  async disconnectIntegration(integrationId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/integrations/${integrationId}`,
      { method: 'DELETE' },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to disconnect integration');
    }
  }

  async updateIntegrationSettings(
    integrationId: number,
    settings: { activitySyncEnabled?: boolean },
  ): Promise<Integration> {
    const response = await this.request<ApiResponse<{ integration: Integration }>>(
      `/integrations/${integrationId}/settings`,
      {
        method: 'PATCH',
        body: JSON.stringify(settings),
      },
    );

    if (response.status !== 'success' || !response.data.integration) {
      throw new Error('Failed to update integration settings');
    }

    return response.data.integration;
  }

  async linkEntity(
    data: LinkProviderEntityData,
  ): Promise<ProviderRelationship> {
    const response = await this.request<ApiResponse<ProviderRelationship>>(
      `/entities`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to link entity to Provider');
    }

    return response.data;
  }

  async unlinkEntity(relationshipId: number): Promise<void> {
    const response = await this.request<ApiResponse<void>>(
      `/entities/${relationshipId}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to unlink entity from Provider');
    }
  }

  async updateEntity(
    integrationId: number,
    entityType: ProviderEntityType,
    entityId: string,
    data: Partial<ProviderEntity>,
  ): Promise<ProviderEntity> {
    const response = await this.request<ApiResponse<ProviderEntity>>(
      `/integrations/${integrationId}/provider/updateEntity?entityType=${entityType}&entityId=${entityId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update Provider entity');
    }

    return response.data;
  }

  async updateBlock(
    integrationId: number,
    blockId: string,
    data: any,
  ): Promise<any> {
    const response = await this.request<ApiResponse<any>>(
      `/integrations/${integrationId}/provider/updateBlock?blockId=${blockId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to update Notion block');
    }

    return response.data;
  }

  async deleteEntity(
    integrationId: number,
    entityType: ProviderEntityType,
    entityId: string,
  ): Promise<void> {
    const response = await this.request<ApiResponse<ProviderEntity>>(
      `/integrations/${integrationId}/provider/deleteEntity?entityType=${entityType}&entityId=${entityId}`,
      {
        method: 'DELETE',
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to delete Provider entity');
    }
  }

  async getEntities({
    organizationId,
    telegramId,
  }: {
    organizationId: number;
    telegramId?: string;
  }): Promise<PaginatedResponse<ProviderRelationship>> {
    const queryParams = new URLSearchParams();
    if (organizationId) queryParams.append('organizationId', String(organizationId));
    if (telegramId) queryParams.append('telegramId', telegramId);
    const url = `/entities${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<ApiResponse<PaginatedResponse<ProviderRelationship>>>(
      url,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch relationships for Telegram user');
    }

    return response.data;
  }

  async getProviderEntity(
    integrationId: number,
    entityType: ProviderEntityType,
    entityId: string,
  ): Promise<ProviderEntity> {
    const response = await this.request<ApiResponse<ProviderEntity>>(
      `/integrations/${integrationId}/provider/getEntityDetails?entityType=${entityType}&entityId=${entityId}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch Provider entity details');
    }

    return response.data;
  }

  async createProviderEntity(
    data: CreateProviderEntityData,
  ): Promise<ProviderEntity> {
    const response = await this.request<ApiResponse<ProviderEntity>>(
      `/integrations/${data.integrationId}/provider/createEntity`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success' || !response.data) {
      if (response.message && isJsonString(response.message)) {
        throw new Error(JSON.parse(response.message));
      } else {
        throw new Error('Failed to create Provider entity');
      }
    }

    return response.data;
  }

  async associateEntity({
    integrationId,
    entityType,
    entityId,
    associatedEntityType,
    associatedEntityId,
  }: {
    integrationId: number;
    entityType: string;
    entityId: string;
    associatedEntityType: ProviderEntityType;
    associatedEntityId: string;
  }): Promise<ProviderRelationship> {
    const response = await this.request<ApiResponse<ProviderRelationship>>(
      `/integrations/${integrationId}/provider/associateEntity`,
      {
        method: 'PUT',
        body: JSON.stringify({ entityType, entityId, associatedEntityType, associatedEntityId }),
      },
    );
    if (response.status !== 'success') {
      throw new Error('Failed to associate entity');
    }

    return response.data;
  }

  async removeEntityAssociation({
    integrationId,
    entityType,
    entityId,
    associatedEntityType,
    associatedEntityId,
  }: {
    integrationId: number;
    entityType: string;
    entityId: string;
    associatedEntityType: ProviderEntityType;
    associatedEntityId: string;
  }): Promise<ProviderRelationship> {
    const response = await this.request<ApiResponse<ProviderRelationship>>(
      `/integrations/${integrationId}/provider/removeEntityAssociation`,
      {
        method: 'DELETE',
        body: JSON.stringify({ entityType, entityId, associatedEntityType, associatedEntityId }),
      },
    );
    if (response.status !== 'success') {
      throw new Error('Failed to associate entity');
    }

    return response.data;
  }

  async deleteProviderEntity(
    data: DeleteProviderEntityData,
  ): Promise<ProviderEntity> {
    const response = await this.request<ApiResponse<ProviderEntity>>(
      `/integrations/${data.integrationId}/provider/deleteEntity`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );

    if (response.status !== 'success') {
      throw new Error('Failed to delete Provider entity');
    }

    return response.data;
  }

  async getDealPipelines(
    integrationId: number,
  ): Promise<ProviderPipeline[]> {
    const response = await this.request<ApiResponse<ProviderPipeline[]>>(
      `/integrations/${integrationId}/provider/getDealPipelines`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch Provider deal stages');
    }

    return response.data;
  }

  async getProviderProperties(
    integrationId: number,
  ): Promise<any[]> {
    const response = await this.request<ApiResponse<ProviderPipeline[]>>(
      `/integrations/${integrationId}/provider/getProperties`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to fetch Provider properties');
    }

    return response.data;
  }

  async searchProviderEntities(
    integrationId: number,
    entityType: ProviderEntityType,
    searchTerm: string,
    limit = 50,
    start = 0,
  ): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(
      // eslint-disable-next-line @stylistic/max-len
      `/integrations/${integrationId}/provider/searchEntities?entityType=${entityType}&searchTerm=${searchTerm}&limit=${limit}&start=${start}`,
    );

    if (response.status !== 'success' || !response.data) {
      throw new Error('Failed to search deals from Provider');
    }

    return response.data;
  }
}
