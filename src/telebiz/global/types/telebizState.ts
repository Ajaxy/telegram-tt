import type {
  AgentConfig,
  AgentConversation,
  AgentMessage,
  AgentPlan,
  AIProvider,
  ClaudeModel,
  ConfirmationRequest,
  GeminiModel,
  OpenAIModel,
  OpenRouterModel,
  Skill,
  ThinkingState,
} from '../../agent/types';
import type {
  ChatFollowupSettings,
  Integration,
  LoadingType,
  Notification,
  Organization,
  PropertiesByEntityType,
  Provider,
  ProviderEntity,
  ProviderEntityTab,
  ProviderEntityType,
  ProviderPipeline,
  ProviderRelationship,
  Reminder,
  Role,
  Team,
  TelebizUser,
  UserSettings,
} from '../../services/types';

export type AgentMode = 'ask' | 'agent' | 'plan';

export enum TelebizFeatureSection {
  Drawer = 'drawer',
  CrmIntegration = 'crm_integration',
  MessageTemplates = 'message_templates',
  BulkSend = 'bulk_send',
  AiAgent = 'ai_agent',
  Integrations = 'integrations',
  FocusMode = 'focus_mode',
  Organizations = 'organizations',
  AutomatedFollowups = 'automated_followups',
  MessageReminders = 'message_reminders',
  ContextMenu = 'context_menu',
}

export interface TelebizAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user?: TelebizUser;
  error?: string;
  isWelcomeModalOpen?: boolean;
  authStep: 'idle' | 'waiting_for_token' | 'processing_token' | 'authenticated';
}

export interface TelebizOrganizationsState {
  organizations: Organization[];
  roles: Role[];
  currentOrganization?: Organization;
  currentTeam?: Team;
  pendingOrganization?: Partial<Organization>;
  isLoading: boolean;
  isLoadingRoles: boolean;
  error?: string;
}

export interface TelebizIntegrationsState {
  integrations: Integration[];
  providers: Provider[];
  selectedIntegrationId?: number;
  selectedProviderName?: string;
  isLoading: boolean;
  isLoadingProviders: boolean;
  error?: string;
}

export interface RelationshipChatData {
  relationships: ProviderRelationship[];
  selectedRelationshipId?: number;
  isLoading: boolean;
  error?: string;
}

export interface TelebizRelationshipsState {
  byChatId: Record<string, RelationshipChatData>;
  entitiesByIntegrationId: Record<number, Record<ProviderEntityType, Record<string, ProviderEntity>>>;
  pipelinesByIntegrationId: Record<number, {
    pipelines: ProviderPipeline[];
    lastSyncAt: number;
    isLoading: boolean;
    error?: string;
  }>;
  propertiesByIntegrationId: Record<number, {
    properties: PropertiesByEntityType[];
    lastSyncAt: number;
    isLoading: boolean;
    error?: string;
  }>;
  isLoading: boolean;
  error?: string;
  loadingEntityState?: {
    loadingType: ProviderEntityType | LoadingType;
    entityId?: string;
  };
  isAddingRelationship: boolean;
  selectedIntegrationId?: number;
  activeTab?: number;
  tabList?: ProviderEntityTab[];
  entityLoadError?: {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    message: string;
  };
}

export interface TelebizNotificationsState {
  notifications: Notification[];
  pendingNotificationsByChatId: Record<string, Notification[]>;
  orderedPendingChatIds: string[];
  currentType: 'all' | 'unread';
  total: number;
  initialFetch: boolean;
  allCount: number;
  unreadCount: number;
  pendingCount: number;
  isLoading: boolean;
  error?: string;
}

export type RemindersByMessageId = Record<string, Reminder | undefined>;

export interface TelebizRemindersState {
  reminders: Reminder[];
  remindersByChatAndMessageId: Record<string, RemindersByMessageId>;
  isLoading: boolean;
  error?: string;
}

export interface TelebizAgentState {
  isRunning: boolean;
  currentPlan?: AgentPlan;
  messages: AgentMessage[];
  conversations: Record<string, AgentConversation>;
  currentConversationId?: string;
  pendingConfirmation?: ConfirmationRequest;
  error?: string;
  config: AgentConfig;
  // Provider selection
  activeProvider: AIProvider;
  // OpenRouter state
  availableModels: OpenRouterModel[];
  isLoadingModels: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  balance?: number;
  isLoadingBalance: boolean;
  // Claude state
  claudeModels: ClaudeModel[];
  isClaudeConnected: boolean;
  isClaudeConnecting: boolean;
  isLoadingClaudeModels: boolean;
  // OpenAI state
  openaiModels: OpenAIModel[];
  isOpenAIConnected: boolean;
  isOpenAIConnecting: boolean;
  isLoadingOpenAIModels: boolean;
  // Gemini state
  geminiModels: GeminiModel[];
  isGeminiConnected: boolean;
  isGeminiConnecting: boolean;
  isLoadingGeminiModels: boolean;
  // Agent mode
  isAgentEnabled: boolean;
  mode: AgentMode;
  thinking: ThinkingState;
  // MCP Bridge state
  isMcpEnabled: boolean;
  isMcpConnected: boolean;
  skills: TelebizSkillsState;
}

export interface TelebizSkillsState {
  skills: Record<string, Skill>;
  isLoading: boolean;
  isSaving: boolean;
  error?: string;
}

export interface TelebizTemplatesChatsState {
  templatesChats: string[];
  isLoading: boolean;
}

export interface BulkSendTarget {
  chatId: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
}

export interface TelebizBulkSendState {
  isActive: boolean;
  sourceChatId?: string;
  messageIds?: number[];
  targets: BulkSendTarget[];
  currentIndex: number;
  delayMs: number;
  completedCount: number;
  failedCount: number;
}
export interface TelebizSettingsState {
  userSettings: UserSettings;
  chatSettings: Record<string, ChatFollowupSettings>;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncAt?: number;
  lastSyncByChatId: Record<string, number>;
  error?: string;
}

export interface TelebizState {
  auth: TelebizAuthState;
  organizations: TelebizOrganizationsState;
  integrations: TelebizIntegrationsState;
  relationships: TelebizRelationshipsState;
  notifications: TelebizNotificationsState;
  reminders: TelebizRemindersState;
  agent: TelebizAgentState;
  templatesChats: TelebizTemplatesChatsState;
  settings: TelebizSettingsState;
  bulkSend: TelebizBulkSendState;
}

// Tab-specific UI state for modals and panels
export interface TelebizTabState {
  isAddingRelationship?: boolean;
  selectedIntegrationId?: number;
  activeRelationshipTab?: number;
  tabList?: ProviderEntityTab[];

  // Modals
  relationshipModal?: {
    entity?: Partial<ProviderEntity>;
    type?: ProviderEntityType;
    isOpen: boolean;
    isExisting?: boolean;
    canRemove?: boolean;
  };
  deleteEntityDialog?: {
    entityId?: string;
    entityType?: ProviderEntityType;
    isOpen: boolean;
  };
  removeEntityFromChatDialog?: {
    isOpen: boolean;
    entityId?: string;
    entityType?: ProviderEntityType;
    title?: string;
  };
  reminderModal?: {
    isOpen: boolean;
    message?: { chatId: string; id: number };
    reminder?: Reminder;
  };
  enableAgentModal?: {
    isOpen: boolean;
    hasAcceptedRisk?: boolean;
  };
  featuresModal?: {
    isOpen: boolean;
    section?: TelebizFeatureSection;
  };
}
