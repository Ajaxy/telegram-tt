import type { TelebizApiConfig } from '../types';

import { AgentApiClient } from './AgentApiClient';
import { BaseApiClient } from './BaseApiClient';
import { FilesApiClient } from './FilesApiClient';
import { IntegrationsApiClient } from './IntegrationsApiClient';
import { NotificationsApiClient } from './NotificationsApiClient';
import { OrganizationsApiClient } from './OrganizationsApiClient';
import { RemindersApiClient } from './RemindersApiClient';
import { SettingsApiClient } from './SettingsApiClient';
import { TemplatesApiClient } from './TemplatesApiClient';
import { TemplatesChatsApiClient } from './TemplatesChatsApiClient';

/**
 * Main Telebiz API Client
 * Combines all modular API clients into a unified interface
 */
export class TelebizApiClient extends BaseApiClient {
  public organizations: OrganizationsApiClient;
  public templates: TemplatesApiClient;
  public agent: AgentApiClient;
  public integrations: IntegrationsApiClient;
  public files: FilesApiClient;
  public reminders: RemindersApiClient;
  public notifications: NotificationsApiClient;
  public templatesChats: TemplatesChatsApiClient;
  public settings: SettingsApiClient;

  constructor(config: Partial<TelebizApiConfig> = {}) {
    super(config);

    // Initialize all modular clients with the same configuration
    this.organizations = new OrganizationsApiClient(config);
    this.templates = new TemplatesApiClient(config);
    this.agent = new AgentApiClient();
    this.integrations = new IntegrationsApiClient(config);
    this.files = new FilesApiClient(config);
    this.reminders = new RemindersApiClient(config);
    this.notifications = new NotificationsApiClient(config);
    this.templatesChats = new TemplatesChatsApiClient(config);
    this.settings = new SettingsApiClient(config);
    // Share token state across all clients
    this.syncTokenState();
  }

  /**
   * Sync token state across all modular clients
   */
  private syncTokenState(): void {
    // Store references to the modular clients for token sync
    const clients = [
      this.organizations,
      this.templates,
      this.agent,
      this.integrations,
      this.files,
      this.reminders,
      this.notifications,
      this.settings,
    ];

    // Override the setTokens method to sync across all clients
    const originalSetTokens = this.setTokens.bind(this);
    this.setTokens = (token: string, refreshToken: string, expiresIn: number) => {
      originalSetTokens(token, refreshToken, expiresIn);

      // Sync with all modular clients
      clients.forEach((client) => {
        (client as any).token = token;
        (client as any).refreshToken = refreshToken;
        (client as any).tokenExpiry = this.tokenExpiry;
      });
    };

    // Override the clearTokens method to sync across all clients
    const originalClearTokens = this.clearTokens.bind(this);
    this.clearTokens = () => {
      originalClearTokens();

      // Clear from all modular clients
      clients.forEach((client) => {
        (client as any).token = undefined;
        (client as any).refreshToken = undefined;
        (client as any).tokenExpiry = undefined;
      });
    };
  }
}

// Create and export a default instance
export const telebizApiClient = new TelebizApiClient();
