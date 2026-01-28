import type { TelebizState } from './types';

const DEFAULT_AGENT_CONFIG = {
  model: 'anthropic/claude-sonnet-4.5',
  temperature: 0.7,
  maxTokens: 4096,
};

export const INITIAL_TELEBIZ_STATE: TelebizState = {
  auth: {
    isAuthenticated: false,
    isLoading: true,
    authStep: 'idle',
  },
  organizations: {
    organizations: [],
    roles: [],
    isLoading: false,
    isLoadingRoles: false,
  },
  integrations: {
    integrations: [],
    providers: [],
    isLoading: false,
    isLoadingProviders: false,
  },
  relationships: {
    byChatId: {},
    entitiesByIntegrationId: {},
    pipelinesByIntegrationId: {},
    propertiesByIntegrationId: {},
    isLoading: false,
    isAddingRelationship: false,
  },
  notifications: {
    notifications: [],
    pendingNotificationsByChatId: {},
    orderedPendingChatIds: [],
    currentType: 'all',
    total: 0,
    initialFetch: true,
    allCount: 0,
    unreadCount: 0,
    pendingCount: 0,
    isLoading: false,
  },
  reminders: {
    reminders: [],
    remindersByChatAndMessageId: {},
    isLoading: false,
  },
  agent: {
    isRunning: false,
    messages: [],
    conversations: {},
    currentConversationId: undefined,
    config: DEFAULT_AGENT_CONFIG,
    // Provider selection
    activeProvider: 'openrouter',
    // OpenRouter state
    availableModels: [],
    isLoadingModels: false,
    isConnected: false,
    isConnecting: false,
    isLoadingBalance: false,
    // Claude state
    claudeModels: [],
    isClaudeConnected: false,
    isClaudeConnecting: false,
    isLoadingClaudeModels: false,
    // OpenAI state
    openaiModels: [],
    isOpenAIConnected: false,
    isOpenAIConnecting: false,
    isLoadingOpenAIModels: false,
    // Gemini state
    geminiModels: [],
    isGeminiConnected: false,
    isGeminiConnecting: false,
    isLoadingGeminiModels: false,
    // Agent mode
    isAgentEnabled: false,
    mode: 'ask',
    thinking: { isThinking: false, steps: [] },
    skills: {
      skills: {},
      isLoading: false,
      isSaving: false,
    },
    isMcpEnabled: false,
    isMcpConnected: false,
  },
  templatesChats: {
    templatesChats: [],
    isLoading: false,
  },
  settings: {
    chatSettings: {},
    userSettings: {
      sync_private_chats: true,
      sync_groups: true,
    },
    isLoading: false,
    isSyncing: false,
    lastSyncByChatId: {},
  },
  bulkSend: {
    isActive: false,
    targets: [],
    currentIndex: 0,
    delayMs: 1000,
    completedCount: 0,
    failedCount: 0,
  },
};
