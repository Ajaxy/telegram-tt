import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { ActionReturnType } from '../../../global/types';
import type { AgentConversation, AgentMessage, AIProvider } from '../../agent/types';
import type { AgentMode } from '../types';

import { logDebugMessage } from '../../../util/debugConsole';
import generateUniqueId from '../../../util/generateUniqueId';
import { startMcpBridge, stopMcpBridge } from '../../agent/mcp/bridge';
import {
  disconnectClaude,
  getClaudeApiKey,
  isClaudeConnected,
  saveClaudeApiKey,
  validateClaudeKey,
} from '../../agent/services/claudeAuth';
import {
  disconnectGemini,
  getGeminiApiKey,
  isGeminiConnected,
  saveGeminiApiKey,
  validateGeminiKey,
} from '../../agent/services/geminiAuth';
import {
  disconnectOpenAI,
  getOpenAIApiKey,
  isOpenAIConnected,
  saveOpenAIApiKey,
  validateOpenAIKey,
} from '../../agent/services/openaiAuth';
import {
  disconnectOpenRouter,
  exchangeCodeForKey,
  getOpenRouterApiKey,
  isOpenRouterConnected,
  preOpenPopupIfNeeded,
  startOpenRouterAuth,
} from '../../agent/services/openRouterAuth';
import { resetRequestCallCount } from '../../agent/tools';
import { generateConversationTitle, SUPPORTED_MODELS } from '../../agent/utils';
import {
  addSkill,
  addTelebizAgentMessage,
  clearTelebizAgentMessages,
  createAgentConversation,
  deleteAgentConversation,
  deleteSkill,
  saveCurrentConversation,
  switchAgentConversation,
  updateSkillData,
  updateTelebizAgent,
  updateTelebizAgentMessage,
} from '../reducers';
import { selectTelebizAgent } from '../selectors';

import {
  executePlan,
  getApiClient,
  getClaudeApiClient,
  runAgentLoop,
} from '../../agent/services/AgentRunner';
import { CLAUDE_MODELS } from '../../services/api/ClaudeApiClient';
import { GEMINI_MODELS } from '../../services/api/GeminiApiClient';
import { OPENAI_MODELS } from '../../services/api/OpenAIApiClient';

// Store abort controller for stopping execution
let abortController: AbortController | undefined;

// ============================================================================
// OpenRouter Connection Actions
// ============================================================================

addActionHandler('telebizInitAgent', (global, actions): ActionReturnType => {
  const isOpenRouterConnectedValue = isOpenRouterConnected();
  const isClaudeConnectedValue = isClaudeConnected();
  const isOpenAIConnectedValue = isOpenAIConnected();
  const isGeminiConnectedValue = isGeminiConnected();

  global = updateTelebizAgent(global, {
    isConnected: isOpenRouterConnectedValue,
    isClaudeConnected: isClaudeConnectedValue,
    isOpenAIConnected: isOpenAIConnectedValue,
    isGeminiConnected: isGeminiConnectedValue,
    claudeModels: CLAUDE_MODELS,
    openaiModels: OPENAI_MODELS,
    geminiModels: GEMINI_MODELS,
  });

  if (isOpenRouterConnectedValue) {
    actions.loadTelebizAgentModels();
    actions.loadTelebizAgentBalance();
  }

  // Fetch Claude models if connected
  if (isClaudeConnectedValue) {
    actions.loadTelebizClaudeModels();
  }

  const hasAnyConnection = isOpenRouterConnectedValue
    || isClaudeConnectedValue
    || isOpenAIConnectedValue
    || isGeminiConnectedValue;

  if (!hasAnyConnection) {
    global = updateTelebizAgent(global, {
      isConnected: false,
      isConnecting: false,
      isClaudeConnected: false,
      isClaudeConnecting: false,
      isOpenAIConnected: false,
      isOpenAIConnecting: false,
      isGeminiConnected: false,
      isGeminiConnecting: false,
      error: undefined,
      availableModels: [],
      balance: undefined,
    });
    setGlobal(global);
  }

  return global;
});

addActionHandler('telebizConnectOpenRouter', async (global, actions): Promise<void> => {
  preOpenPopupIfNeeded();

  global = updateTelebizAgent(global, { isConnecting: true, error: undefined });
  setGlobal(global);

  const result = await startOpenRouterAuth();

  global = getGlobal();
  if (result.success) {
    global = updateTelebizAgent(global, {
      isConnected: true,
      isConnecting: false,
      error: undefined,
    });
    setGlobal(global);
    actions.loadTelebizAgentModels();
    actions.loadTelebizAgentBalance();
  } else if (result.error !== 'Redirecting...') {
    global = updateTelebizAgent(global, {
      isConnecting: false,
      error: result.error,
    });
    setGlobal(global);
    getActions().showNotification({
      message: result.error,
    });
  }
});

addActionHandler('telebizDisconnectOpenRouter', (global): ActionReturnType => {
  disconnectOpenRouter();
  getApiClient().clearCache();

  return updateTelebizAgent(global, {
    isConnected: false,
    isConnecting: false,
    error: undefined,
    availableModels: [],
    balance: undefined,
  });
});

addActionHandler('telebizExchangeOpenRouterCode', async (global, actions, payload): Promise<void> => {
  const { code } = payload;

  global = updateTelebizAgent(global, { isConnecting: true, error: undefined });
  setGlobal(global);

  const result = await exchangeCodeForKey(code);

  global = getGlobal();
  if (result.success) {
    global = updateTelebizAgent(global, {
      isConnected: true,
      isConnecting: false,
    });
    setGlobal(global);

    actions.loadTelebizAgentModels();
    actions.loadTelebizAgentBalance();
  } else {
    global = updateTelebizAgent(global, {
      isConnecting: false,
    });
    setGlobal(global);
    getActions().showNotification({
      message: result.error,
    });
  }
});

addActionHandler('loadTelebizAgentModels', async (global): Promise<void> => {
  const accessToken = getOpenRouterApiKey();
  if (!accessToken) return;

  global = updateTelebizAgent(global, { isLoadingModels: true });
  setGlobal(global);

  try {
    const models = await getApiClient().getModels(accessToken);
    const availableModels = models.filter(
      (model) => SUPPORTED_MODELS.includes(model.id),
    ).sort((a, b) => a.name.localeCompare(b.name));

    global = getGlobal();
    global = updateTelebizAgent(global, {
      availableModels,
      isLoadingModels: false,
    });
    setGlobal(global);
  } catch (error) {
    logDebugMessage('error', 'Agent: Failed to load models', error);
    global = getGlobal();
    global = updateTelebizAgent(global, { isLoadingModels: false });
    setGlobal(global);
    getActions().showNotification({
      message: 'Failed to load models',
    });
  }
});

addActionHandler('loadTelebizAgentBalance', async (global): Promise<void> => {
  const accessToken = getOpenRouterApiKey();
  if (!accessToken) return;

  global = updateTelebizAgent(global, { isLoadingBalance: true });
  setGlobal(global);

  try {
    const balanceData = await getApiClient().getBalance(accessToken);
    const remainingCredits = balanceData.credits - balanceData.usage;

    global = getGlobal();
    global = updateTelebizAgent(global, {
      balance: remainingCredits,
      isLoadingBalance: false,
    });
    setGlobal(global);
  } catch (error) {
    logDebugMessage('error', 'Agent: Failed to load balance', error);
    global = getGlobal();
    global = updateTelebizAgent(global, { isLoadingBalance: false });
    setGlobal(global);
    getActions().showNotification({
      message: 'Failed to load balance',
    });
  }
});

// ============================================================================
// Claude Connection Actions
// ============================================================================

addActionHandler('telebizConnectClaude', async (global, _actions, payload): Promise<void> => {
  const { apiKey } = payload;

  global = updateTelebizAgent(global, { isClaudeConnecting: true, error: undefined });
  setGlobal(global);

  // Save the API key
  saveClaudeApiKey(apiKey);

  // Validate the key
  const isValid = await validateClaudeKey();

  global = getGlobal();
  if (isValid) {
    // Set connected with fallback models first
    global = updateTelebizAgent(global, {
      isClaudeConnected: true,
      isClaudeConnecting: false,
      isLoadingClaudeModels: true,
      claudeModels: CLAUDE_MODELS,
      error: undefined,
    });
    setGlobal(global);

    // Fetch models from API
    try {
      const models = await getClaudeApiClient().fetchModels(apiKey);
      global = getGlobal();
      global = updateTelebizAgent(global, {
        claudeModels: models,
        isLoadingClaudeModels: false,
      });
      setGlobal(global);
    } catch (error) {
      logDebugMessage('warn', 'Failed to fetch Claude models:', error);
      global = getGlobal();
      global = updateTelebizAgent(global, { isLoadingClaudeModels: false });
      setGlobal(global);
    }
  } else {
    disconnectClaude();
    global = updateTelebizAgent(global, {
      isClaudeConnected: false,
      isClaudeConnecting: false,
      error: 'Invalid API key. Please check your key and try again.',
    });
    setGlobal(global);
    getActions().showNotification({
      message: 'Invalid Claude API key',
    });
  }
});

addActionHandler('telebizDisconnectClaude', (global): ActionReturnType => {
  disconnectClaude();

  return updateTelebizAgent(global, {
    isClaudeConnected: false,
    isClaudeConnecting: false,
    error: undefined,
  });
});

addActionHandler('loadTelebizClaudeModels', async (global): Promise<void> => {
  const apiKey = getClaudeApiKey();
  if (!apiKey) return;

  global = updateTelebizAgent(global, { isLoadingClaudeModels: true });
  setGlobal(global);

  try {
    const models = await getClaudeApiClient().fetchModels(apiKey);
    global = getGlobal();
    global = updateTelebizAgent(global, {
      claudeModels: models,
      isLoadingClaudeModels: false,
    });
    setGlobal(global);
  } catch (error) {
    logDebugMessage('warn', 'Failed to fetch Claude models:', error);
    global = getGlobal();
    global = updateTelebizAgent(global, { isLoadingClaudeModels: false });
    setGlobal(global);
  }
});

// ============================================================================
// OpenAI Connection Actions
// ============================================================================

addActionHandler('telebizConnectOpenAI', async (global, _actions, payload): Promise<void> => {
  const { apiKey } = payload;

  global = updateTelebizAgent(global, { isOpenAIConnecting: true, error: undefined });
  setGlobal(global);

  // Save the API key
  saveOpenAIApiKey(apiKey);

  // Validate the key
  const isValid = await validateOpenAIKey();

  global = getGlobal();
  if (isValid) {
    global = updateTelebizAgent(global, {
      isOpenAIConnected: true,
      isOpenAIConnecting: false,
      openaiModels: OPENAI_MODELS,
      error: undefined,
    });
    setGlobal(global);
  } else {
    disconnectOpenAI();
    global = updateTelebizAgent(global, {
      isOpenAIConnected: false,
      isOpenAIConnecting: false,
      error: 'Invalid API key. Please check your key and try again.',
    });
    setGlobal(global);
    getActions().showNotification({
      message: 'Invalid OpenAI API key',
    });
  }
});

addActionHandler('telebizDisconnectOpenAI', (global): ActionReturnType => {
  disconnectOpenAI();

  return updateTelebizAgent(global, {
    isOpenAIConnected: false,
    isOpenAIConnecting: false,
    error: undefined,
  });
});

// ============================================================================
// Gemini Connection Actions
// ============================================================================

addActionHandler('telebizConnectGemini', async (global, _actions, payload): Promise<void> => {
  const { apiKey } = payload;

  global = updateTelebizAgent(global, { isGeminiConnecting: true, error: undefined });
  setGlobal(global);

  // Save the API key
  saveGeminiApiKey(apiKey);

  // Validate the key
  const isValid = await validateGeminiKey();

  global = getGlobal();
  if (isValid) {
    global = updateTelebizAgent(global, {
      isGeminiConnected: true,
      isGeminiConnecting: false,
      geminiModels: GEMINI_MODELS,
      error: undefined,
    });
    setGlobal(global);
  } else {
    disconnectGemini();
    global = updateTelebizAgent(global, {
      isGeminiConnected: false,
      isGeminiConnecting: false,
      error: 'Invalid API key. Please check your key and try again.',
    });
    setGlobal(global);
    getActions().showNotification({
      message: 'Invalid Gemini API key',
    });
  }
});

addActionHandler('telebizDisconnectGemini', (global): ActionReturnType => {
  disconnectGemini();

  return updateTelebizAgent(global, {
    isGeminiConnected: false,
    isGeminiConnecting: false,
    error: undefined,
  });
});

// ============================================================================
// Provider Selection Actions
// ============================================================================

addActionHandler('setTelebizActiveProvider', (global, _actions, payload): ActionReturnType => {
  const { provider } = payload as { provider: AIProvider };
  const agentState = selectTelebizAgent(global);

  // If same provider, do nothing
  if (provider === agentState.activeProvider) {
    return global;
  }

  // Update the model to a default for the new provider
  let newConfig = agentState.config;
  switch (provider) {
    case 'claude':
      newConfig = { ...newConfig, model: 'claude-sonnet-4-5-20250929' };
      break;
    case 'openrouter':
      newConfig = { ...newConfig, model: 'anthropic/claude-sonnet-4.5' };
      break;
    case 'openai':
      newConfig = { ...newConfig, model: 'gpt-4o' };
      break;
    case 'gemini':
      newConfig = { ...newConfig, model: 'gemini-2.0-flash' };
      break;
    default:
      break;
  }

  // Start a new conversation when switching providers
  return updateTelebizAgent(global, {
    activeProvider: provider,
    config: newConfig,
    currentConversationId: undefined,
    messages: [],
    currentPlan: undefined,
    pendingConfirmation: undefined,
    error: undefined,
  });
});

// ============================================================================
// Agent Configuration Actions
// ============================================================================

addActionHandler('updateTelebizAgentConfig', (global, _actions, payload): ActionReturnType => {
  const configUpdate = payload;
  const currentConfig = selectTelebizAgent(global).config;
  const newConfig = { ...currentConfig, ...configUpdate };
  return updateTelebizAgent(global, { config: newConfig });
});

addActionHandler('setTelebizAgentMode', (global, actions, payload): ActionReturnType => {
  const { mode } = payload as { mode: AgentMode };
  const agentState = selectTelebizAgent(global);

  if (mode === 'agent' && !agentState.isAgentEnabled) {
    actions.openTelebizEnableAgentModal();
    return global;
  }

  return updateTelebizAgent(global, { mode });
});

addActionHandler('confirmEnableTelebizAgent', (global, actions): ActionReturnType => {
  global = updateTelebizAgent(global, {
    isAgentEnabled: true,
    mode: 'agent',
  });

  actions.closeTelebizEnableAgentModal();
  return global;
});

addActionHandler('enableTelebizAgent', (global): ActionReturnType => {
  return updateTelebizAgent(global, {
    isAgentEnabled: true,
    mode: 'agent',
  });
});

addActionHandler('disableTelebizAgent', (global): ActionReturnType => {
  const agentState = selectTelebizAgent(global);
  return updateTelebizAgent(global, {
    isAgentEnabled: false,
    mode: agentState.mode === 'agent' ? 'ask' : agentState.mode,
  });
});

// ============================================================================
// Message State Actions
// ============================================================================

addActionHandler('addTelebizAgentMessage', (global, _actions, payload): ActionReturnType => {
  const messageData = payload;
  const newMessage: AgentMessage = {
    ...messageData,
    id: generateUniqueId(),
    timestamp: Date.now(),
  };

  return addTelebizAgentMessage(global, newMessage);
});

addActionHandler('updateTelebizAgentMessage', (global, _actions, payload): ActionReturnType => {
  const { messageId, updates } = payload as { messageId: string; updates: Partial<AgentMessage> };
  return updateTelebizAgentMessage(global, messageId, updates);
});

addActionHandler('clearTelebizAgentMessages', (global): ActionReturnType => {
  return clearTelebizAgentMessages(global);
});

// ============================================================================
// Agent State Actions
// ============================================================================

addActionHandler('setTelebizAgentRunning', (global, _actions, payload): ActionReturnType => {
  const { isRunning } = payload;
  return updateTelebizAgent(global, { isRunning });
});

addActionHandler('setTelebizAgentError', (global, _actions, payload): ActionReturnType => {
  const { error } = payload;
  return updateTelebizAgent(global, { error });
});

addActionHandler('clearTelebizAgentError', (global): ActionReturnType => {
  return updateTelebizAgent(global, { error: undefined });
});

addActionHandler('setTelebizAgentThinking', (global, _actions, payload): ActionReturnType => {
  const { thinking } = payload;
  const currentThinking = selectTelebizAgent(global).thinking;

  return updateTelebizAgent(global, {
    thinking: { ...currentThinking, ...thinking },
  });
});

addActionHandler('setTelebizAgentPlan', (global, _actions, payload): ActionReturnType => {
  const { plan } = payload;
  return updateTelebizAgent(global, { currentPlan: plan });
});

addActionHandler('setTelebizAgentConfirmation', (global, _actions, payload): ActionReturnType => {
  const { confirmation } = payload;
  return updateTelebizAgent(global, { pendingConfirmation: confirmation });
});

// ============================================================================
// Conversation Management Actions
// ============================================================================

addActionHandler('createAgentConversation', (global): ActionReturnType => {
  // Just clear the current conversation - a new one will be auto-created when user sends a message
  return updateTelebizAgent(global, {
    currentConversationId: undefined,
    messages: [],
    currentPlan: undefined,
    pendingConfirmation: undefined,
    error: undefined,
  });
});

addActionHandler('switchAgentConversation', (global, _actions, payload): ActionReturnType => {
  const { conversationId } = payload;
  return switchAgentConversation(global, conversationId);
});

addActionHandler('deleteAgentConversation', (global, _actions, payload): ActionReturnType => {
  const { conversationId } = payload;
  return deleteAgentConversation(global, conversationId);
});

// ============================================================================
// Agent Execution Actions
// ============================================================================

addActionHandler('sendTelebizAgentMessage', async (global, actions, payload): Promise<void> => {
  const { message } = payload;
  const agentState = selectTelebizAgent(global);
  const { activeProvider } = agentState;

  // Get the appropriate access token based on active provider
  let accessToken: string | undefined;
  switch (activeProvider) {
    case 'claude':
      accessToken = getClaudeApiKey();
      if (!accessToken) {
        global = updateTelebizAgent(global, { error: 'Claude not connected' });
        setGlobal(global);
        return;
      }
      break;
    case 'openai':
      accessToken = getOpenAIApiKey();
      if (!accessToken) {
        global = updateTelebizAgent(global, { error: 'OpenAI not connected' });
        setGlobal(global);
        return;
      }
      break;
    case 'gemini':
      accessToken = getGeminiApiKey();
      if (!accessToken) {
        global = updateTelebizAgent(global, { error: 'Gemini not connected' });
        setGlobal(global);
        return;
      }
      break;
    case 'openrouter':
    default:
      accessToken = getOpenRouterApiKey();
      if (!accessToken) {
        global = updateTelebizAgent(global, { error: 'OpenRouter not connected' });
        setGlobal(global);
        return;
      }
      break;
  }

  resetRequestCallCount();
  abortController = new AbortController();

  // Auto-create conversation if none exists
  if (!agentState.currentConversationId) {
    const newConversation: AgentConversation = {
      id: generateUniqueId(),
      title: generateConversationTitle(message),
      messages: [],
      provider: activeProvider,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    global = createAgentConversation(global, newConversation);
    setGlobal(global);
  }

  // Add user message
  const userMessage: AgentMessage = {
    id: generateUniqueId(),
    timestamp: Date.now(),
    role: 'user',
    content: message,
  };

  global = getGlobal();
  global = addTelebizAgentMessage(global, userMessage);
  global = saveCurrentConversation(global);
  global = updateTelebizAgent(global, { isRunning: true, error: undefined });
  setGlobal(global);

  const updatedAgentState = selectTelebizAgent(global);

  try {
    const result = await runAgentLoop(
      {
        accessToken,
        userMessage: message,
        mode: updatedAgentState.mode,
        config: updatedAgentState.config,
        existingMessages: updatedAgentState.messages,
        abortSignal: abortController.signal,
        provider: activeProvider,
      },
      {
        onThinkingUpdate: (thinking) => {
          global = getGlobal();
          const currentThinking = selectTelebizAgent(global).thinking;
          global = updateTelebizAgent(global, {
            thinking: { ...currentThinking, ...thinking },
          });
          setGlobal(global);
        },
        onMessageAdd: (msg) => {
          global = getGlobal();
          global = addTelebizAgentMessage(global, msg);
          global = saveCurrentConversation(global);
          setGlobal(global);
        },
        onMessageUpdate: (messageId, updates) => {
          global = getGlobal();
          global = updateTelebizAgentMessage(global, messageId, updates);
          global = saveCurrentConversation(global);
          setGlobal(global);
        },
        onError: (error) => {
          global = getGlobal();
          global = updateTelebizAgent(global, { error });
          setGlobal(global);
        },
        onConfirmationRequired: (plan, confirmation) => {
          global = getGlobal();
          global = updateTelebizAgent(global, {
            currentPlan: plan,
            pendingConfirmation: confirmation,
            isRunning: false,
            thinking: { isThinking: false, steps: [] },
          });
          setGlobal(global);
        },
      },
    );

    // Update final state if execution completed (not paused for confirmation)
    if (result) {
      global = getGlobal();
      global = saveCurrentConversation(global);
      global = updateTelebizAgent(global, {
        isRunning: false,
        thinking: { isThinking: false, steps: [] },
      });
      setGlobal(global);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logDebugMessage('error', 'Agent: Error processing message', error);
    global = getGlobal();
    global = updateTelebizAgent(global, {
      error: errorMessage,
      isRunning: false,
      thinking: { isThinking: false, steps: [] },
    });
    setGlobal(global);
    getActions().showNotification({
      message: errorMessage,
    });
  }
});

addActionHandler('confirmTelebizAgentPlan', async (global, actions): Promise<void> => {
  const agentState = selectTelebizAgent(global);
  const { currentPlan, pendingConfirmation } = agentState;
  if (!currentPlan || !pendingConfirmation) return;

  global = updateTelebizAgent(global, {
    currentPlan: { ...currentPlan, status: 'executing' },
    pendingConfirmation: undefined,
    isRunning: true,
  });
  setGlobal(global);

  try {
    const { completedPlan, completionMessage } = await executePlan(
      currentPlan,
      pendingConfirmation,
    );

    global = getGlobal();
    global = addTelebizAgentMessage(global, completionMessage);
    global = saveCurrentConversation(global);
    global = updateTelebizAgent(global, {
      currentPlan: completedPlan,
      isRunning: false,
    });
    setGlobal(global);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute plan';
    logDebugMessage('error', 'Agent: Failed to execute plan', error);
    global = getGlobal();
    global = updateTelebizAgent(global, {
      error: errorMessage,
      isRunning: false,
    });
    setGlobal(global);
    getActions().showNotification({
      message: errorMessage,
    });
  }
});

addActionHandler('cancelTelebizAgentPlan', (global, actions): ActionReturnType => {
  const cancelMessage: AgentMessage = {
    id: generateUniqueId(),
    role: 'assistant',
    content: 'Action cancelled.',
    timestamp: Date.now(),
  };

  global = addTelebizAgentMessage(global, cancelMessage);
  global = saveCurrentConversation(global);

  const agentState = selectTelebizAgent(global);
  global = updateTelebizAgent(global, {
    currentPlan: agentState.currentPlan ? { ...agentState.currentPlan, status: 'cancelled' } : undefined,
    pendingConfirmation: undefined,
    isRunning: false,
  });

  return global;
});

addActionHandler('stopTelebizAgentExecution', (global): ActionReturnType => {
  abortController?.abort();

  global = updateTelebizAgent(global, {
    isRunning: false,
    thinking: { isThinking: false, steps: [] },
  });
  return global;
});

// ============================================================================
// Skills Actions
// ============================================================================

addActionHandler('addSkill', (global, _actions, payload): ActionReturnType => {
  const {
    name, context, content, skillType, isActive = true,
  } = payload;
  return addSkill(global, {
    name, context, content, skillType, isActive,
  });
});

addActionHandler('updateSkill', (global, _actions, payload): ActionReturnType => {
  const { id, updates } = payload;
  return updateSkillData(global, id, updates);
});

addActionHandler('deleteSkill', (global, _actions, payload): ActionReturnType => {
  const { id } = payload;
  return deleteSkill(global, id);
});

// ============================================================================
// MCP Bridge Actions
// ============================================================================

addActionHandler('enableMcpBridge', (global): ActionReturnType => {
  startMcpBridge();
  return updateTelebizAgent(global, { isMcpEnabled: true });
});

addActionHandler('disableMcpBridge', (global): ActionReturnType => {
  stopMcpBridge();
  return updateTelebizAgent(global, { isMcpEnabled: false, isMcpConnected: false });
});

addActionHandler('updateMcpConnectionStatus', (global, _actions, payload): ActionReturnType => {
  const { isConnected } = payload;
  return updateTelebizAgent(global, { isMcpConnected: isConnected });
});
