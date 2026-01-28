import type {
  AgentConfig,
  AgentMessage,
  AgentPlan,
  AIProvider,
  ConfirmationRequest,
  Skill,
  SkillType,
  ThinkingState,
} from '../../agent/types';
import type { TelebizSettingsScreens } from '../../components/left/types';
import type { TelebizPanelScreens } from '../../components/right/types';
import type {
  ChatFollowupSettings,
  CreateOrganizationData,
  CreateProviderEntityData,
  CreateReminderData,
  Organization,
  ProviderEntity,
  ProviderEntityParent,
  ProviderEntityType,
  ProviderRelationship,
  Team,
  UpdateReminderData,
  UserSettings,
} from '../../services/types';
import type { AgentMode, TelebizFeatureSection } from '../types';

type WithTabId = { tabId?: number };

export interface TelebizActionPayloads {
  // Telebiz UI
  toggleTelebizPanel: ({
    force?: boolean;
  } & WithTabId) | undefined;

  openTelebizPanelScreen: {
    screen?: TelebizPanelScreens;
    shouldOpen?: boolean;
  } & WithTabId;

  // Telebiz Init
  telebizInit: undefined;
  telebizCleanup: undefined;

  // Telebiz Auth
  telebizInitAuth: undefined;
  telebizLogin: undefined;
  telebizProcessJWTToken: { token: string };
  telebizCheckForToken: undefined;
  telebizLogout: undefined;
  telebizRefreshToken: undefined;
  telebizLoadInitialData: undefined;
  telebizClearAuthError: undefined;
  telebizOpenWelcomeModal: undefined;
  telebizCloseWelcomeModal: undefined;
  telebizOpenFeaturesModal: { section?: TelebizFeatureSection } | undefined;
  telebizCloseFeaturesModal: undefined;
  loadTelebizUserRoles: undefined;

  // Telebiz Organizations
  loadTelebizOrganizations: undefined;
  switchTelebizOrganization: { organization: Organization };
  switchTelebizTeam: { team: Team };
  setPendingTelebizOrganization: { key: keyof Organization | Organization; value?: any };
  resetPendingTelebizOrganization: undefined;
  clearTelebizOrganizationsError: undefined;
  createTelebizOrganization: { data: CreateOrganizationData };
  updateTelebizOrganizationData: { organizationId: number; data: CreateOrganizationData };
  deleteTelebizOrganization: { organizationId: number };
  acceptTelebizOrganizationInvitation: { invitationId: number };
  resolveUserByUsername: { username: string };

  // Telebiz Integrations
  loadTelebizIntegrations: undefined;
  loadTelebizProviders: undefined;
  setTelebizSelectedIntegrationId: { integrationId?: number };
  setTelebizSelectedProviderName: { providerName?: string };
  updateTelebizIntegrationSettings: {
    integrationId: number;
    settings: { activitySyncEnabled?: boolean };
  };
  clearTelebizIntegrationsError: undefined;

  // Telebiz Relationships
  loadTelebizRelationships: undefined;
  selectTelebizRelationship: { chatId: string; relationshipId: number };
  loadTelebizDealPipelines: { integrationId: number; forceRefresh?: boolean };
  loadTelebizProviderProperties: { integrationId: number; forceRefresh?: boolean };
  createTelebizAssociation: {
    data: CreateProviderEntityData;
    parentEntity: ProviderEntityParent;
  };
  updateTelebizEntity: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    data: any;
    parentEntity?: ProviderEntityParent;
  };
  deleteTelebizEntity: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    deleteFromProvider?: boolean;
    parentEntity?: ProviderEntityParent;
  };
  unlinkTelebizEntity: { relationship: ProviderRelationship };
  removeEntityAssociation: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    associatedEntityType: ProviderEntityType;
    associatedEntityId: string;
  };
  setTelebizRelationshipsLoadingState: {
    loadingEntityState?: {
      loadingType: ProviderEntityType;
      entityId?: string;
    };
  };
  clearTelebizRelationshipsError: undefined;
  setTelebizActiveTab: { tabIndex: number };
  setTelebizIsAddingRelationship: { isAdding: boolean };
  setTelebizChatSelectedRelationship: { chatId: string; relationshipId: number };
  loadTelebizEntity: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    forceRefresh?: boolean;
  };
  openTelebizEntityModal: {
    type: ProviderEntityType;
    entity?: any;
    isExisting?: boolean;
    canRemove?: boolean;
  };
  closeTelebizEntityModal: undefined;
  openTelebizConfirmDeleteDialog: { entityId: string; entityType: ProviderEntityType };
  closeTelebizConfirmDeleteDialog: undefined;
  openTelebizRemoveEntityFromChatDialog: { title?: string };
  closeTelebizRemoveEntityFromChatDialog: undefined;
  confirmTelebizRemoveEntityFromChat: { deleteFromProvider: boolean };
  openTelebizReminderModal: { message: { chatId: string; id: number }; reminder?: any };
  closeTelebizReminderModal: undefined;
  linkTelebizEntity: {
    integrationId: number;
    telegramId: string;
    telegramHandle?: string;
    organizationId?: number;
    entityType: ProviderEntityType;
    entityId: string;
  };
  addTelebizRelationship: { relationship: ProviderRelationship; entity?: ProviderEntity };
  associateTelebizEntity: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    associatedEntityType: ProviderEntityType;
    associatedEntityId: string;
  };
  updateTelebizNotionBlock: {
    integrationId: number;
    pageId: string;
    blockId: string;
    blockData: any;
  };

  // Telebiz Notifications
  loadTelebizNotifications: {
    unreadOnly?: boolean;
    offset?: number;
    limit?: number;
    organization_id?: number;
  } | undefined;
  loadTelebizNewNotifications: { organization_id?: number } | undefined;
  loadTelebizPendingNotifications: { organization_id?: number } | undefined;
  loadTelebizNotificationCounts: undefined;
  resetTelebizNotifications: { currentType: 'all' | 'unread' };
  loadTelebizUnreadNotificationsCount: undefined;
  markTelebizNotificationRead: { notificationId: number };
  markTelebizNotificationUnread: { notificationId: number };
  markAllTelebizNotificationsRead: undefined;
  dismissTelebizNotification: { notificationId: number };
  snoozeTelebizNotification: { notificationId: number; snoozeMinutes: number };
  clearTelebizNotificationsError: undefined;

  // Telebiz Reminders
  loadTelebizReminders: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'done' | 'snoozed' | 'cancelled';
    organization_id?: number;
    upcoming?: boolean;
  } | undefined;
  createTelebizReminder: CreateReminderData;
  updateTelebizReminder: { reminderId: number; data: UpdateReminderData };
  completeTelebizReminder: { reminderId: number };
  deleteTelebizReminder: { reminderId: number };
  clearTelebizRemindersError: undefined;

  // Telebiz Agent
  telebizInitAgent: undefined;
  telebizConnectOpenRouter: undefined;
  telebizDisconnectOpenRouter: undefined;
  telebizExchangeOpenRouterCode: { code: string };
  telebizConnectClaude: { apiKey: string };
  telebizDisconnectClaude: undefined;
  telebizConnectOpenAI: { apiKey: string };
  telebizDisconnectOpenAI: undefined;
  telebizConnectGemini: { apiKey: string };
  telebizDisconnectGemini: undefined;
  setTelebizActiveProvider: { provider: AIProvider };
  loadTelebizAgentModels: undefined;
  loadTelebizAgentBalance: undefined;
  loadTelebizClaudeModels: undefined;
  updateTelebizAgentConfig: Partial<AgentConfig>;
  setTelebizAgentMode: { mode: AgentMode };
  openTelebizEnableAgentModal: undefined;
  closeTelebizEnableAgentModal: undefined;
  confirmEnableTelebizAgent: undefined;
  enableTelebizAgent: undefined;
  disableTelebizAgent: undefined;
  addTelebizAgentMessage: Omit<AgentMessage, 'id' | 'timestamp'>;
  updateTelebizAgentMessage: { messageId: string; updates: Partial<AgentMessage> };
  clearTelebizAgentMessages: undefined;
  setTelebizAgentRunning: { isRunning: boolean };
  setTelebizAgentError: { error: string };
  clearTelebizAgentError: undefined;
  setTelebizAgentThinking: { thinking: Partial<ThinkingState> };
  setTelebizAgentPlan: { plan?: AgentPlan };
  setTelebizAgentConfirmation: { confirmation?: ConfirmationRequest };
  createAgentConversation: undefined;
  switchAgentConversation: { conversationId: string };
  deleteAgentConversation: { conversationId: string };
  sendTelebizAgentMessage: { message: string };
  confirmTelebizAgentPlan: undefined;
  cancelTelebizAgentPlan: undefined;
  stopTelebizAgentExecution: undefined;

  // Telebiz Settings UI
  openTelebizSettingsScreen: {
    screen?: TelebizSettingsScreens;
  } & WithTabId;

  // Telebiz Templates
  loadTelebizTemplatesChats: undefined;
  addTelebizTemplatesChat: { chatId: string };
  removeTelebizTemplatesChat: { chatId: string };
  updateTelebizTemplatesChatsList: { chatIds: string[] };
  openTelebizTemplatesChatsModal: undefined;
  closeTelebizTemplatesChatsModal: undefined;
  // Telebiz Settings Data
  loadTelebizUserSettings: undefined;
  updateTelebizUserSettings: Partial<UserSettings>;
  loadTelebizChatSettings: { chatId: string };
  loadTelebizAllChatSettings: undefined;
  updateTelebizChatSettings: {
    chatId: string;
    settings: Partial<Omit<ChatFollowupSettings, 'chat_id'>>;
  };
  syncTelebizChatActivities: undefined;
  clearTelebizSettingsError: undefined;

  // Telebiz MCP Bridge
  enableMcpBridge: undefined;
  disableMcpBridge: undefined;
  updateMcpConnectionStatus: { isConnected: boolean };

  // Telebiz Skills
  addSkill: {
    name?: string;
    context: string;
    content: string;
    skillType?: SkillType;
    isActive?: boolean;
  };
  updateSkill: { id: string; updates: Partial<Skill> };
  deleteSkill: { id: string };
  openSkillsModal: { editingItem?: Skill } | undefined;
  closeSkillsModal: undefined;

  // Telebiz Bulk Send
  startTelebizBulkSend: {
    sourceChatId: string;
    messageIds: number[];
    targetChatIds: string[];
    delayMs: number;
  };
  cancelTelebizBulkSend: undefined;
  resetTelebizBulkSend: undefined;
}
