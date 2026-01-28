import type { GlobalState } from '../../../global/types';
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
import type { AgentMode, TelebizAgentState, TelebizSkillsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizAgent(global: GlobalState): TelebizAgentState {
  return global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
}

export function selectTelebizAgentMessages(global: GlobalState): AgentMessage[] {
  return selectTelebizAgent(global).messages;
}

export function selectTelebizAgentIsRunning(global: GlobalState): boolean {
  return selectTelebizAgent(global).isRunning;
}

export function selectTelebizAgentCurrentPlan(global: GlobalState): AgentPlan | undefined {
  return selectTelebizAgent(global).currentPlan;
}

export function selectTelebizAgentPendingConfirmation(global: GlobalState): ConfirmationRequest | undefined {
  return selectTelebizAgent(global).pendingConfirmation;
}

export function selectTelebizAgentConversations(global: GlobalState): Record<string, AgentConversation> {
  return selectTelebizAgent(global).conversations || {};
}

export function selectTelebizAgentConversationsList(global: GlobalState): AgentConversation[] {
  const conversations = selectTelebizAgentConversations(global);
  return Object.values(conversations).sort((a, b) => b.createdAt - a.createdAt);
}

export function selectTelebizAgentCurrentConversationId(global: GlobalState): string | undefined {
  return selectTelebizAgent(global).currentConversationId;
}

export function selectTelebizAgentCurrentConversation(global: GlobalState): AgentConversation | undefined {
  const agent = selectTelebizAgent(global);
  if (!agent.currentConversationId) return undefined;
  return agent.conversations?.[agent.currentConversationId];
}

export function selectTelebizAgentConfig(global: GlobalState): AgentConfig {
  return selectTelebizAgent(global).config;
}

export function selectTelebizAgentAvailableModels(global: GlobalState): OpenRouterModel[] {
  return selectTelebizAgent(global).availableModels;
}

// Returns models for the currently active provider
export function selectTelebizAgentModelsForActiveProvider(global: GlobalState): OpenRouterModel[] {
  const agent = selectTelebizAgent(global);
  switch (agent.activeProvider) {
    case 'claude':
      return agent.claudeModels;
    case 'openai':
      return agent.openaiModels;
    case 'gemini':
      return agent.geminiModels;
    case 'openrouter':
    default:
      return agent.availableModels;
  }
}

// Returns isLoadingModels for the currently active provider
export function selectTelebizAgentIsLoadingModelsForActiveProvider(global: GlobalState): boolean {
  const agent = selectTelebizAgent(global);
  switch (agent.activeProvider) {
    case 'claude':
      return agent.isLoadingClaudeModels;
    case 'openai':
      return agent.isLoadingOpenAIModels;
    case 'gemini':
      return agent.isLoadingGeminiModels;
    case 'openrouter':
    default:
      return agent.isLoadingModels;
  }
}

export function selectIsTelebizAgentConnected(global: GlobalState): boolean {
  return selectTelebizAgent(global).isConnected;
}

export function selectIsTelebizAgentConnecting(global: GlobalState): boolean {
  return selectTelebizAgent(global).isConnecting;
}

export function selectIsTelebizAgentEnabled(global: GlobalState): boolean {
  return selectTelebizAgent(global).isAgentEnabled;
}

export function selectTelebizAgentMode(global: GlobalState): AgentMode {
  return selectTelebizAgent(global).mode;
}

export function selectTelebizAgentThinking(global: GlobalState): ThinkingState {
  return selectTelebizAgent(global).thinking;
}

export function selectTelebizAgentError(global: GlobalState): string | undefined {
  return selectTelebizAgent(global).error;
}

export function selectTelebizAgentBalance(global: GlobalState): number | undefined {
  return selectTelebizAgent(global).balance;
}

export function selectTelebizAgentIsLoadingModels(global: GlobalState): boolean {
  return selectTelebizAgent(global).isLoadingModels;
}

export function selectTelebizAgentIsLoadingBalance(global: GlobalState): boolean {
  return selectTelebizAgent(global).isLoadingBalance;
}

// Skills Selectors
export function selectTelebizSkills(global: GlobalState): TelebizSkillsState {
  return selectTelebizAgent(global).skills || INITIAL_TELEBIZ_STATE.agent.skills;
}

export function selectTelebizSkillsData(global: GlobalState): Record<string, Skill> {
  return selectTelebizSkills(global).skills || {};
}

export function selectTelebizSkillsList(global: GlobalState): Skill[] {
  const data = selectTelebizSkillsData(global);
  return Object.values(data).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function selectTelebizSkillById(global: GlobalState, id: string): Skill | undefined {
  return selectTelebizSkillsData(global)[id];
}

export function selectTelebizSkillsIsLoading(global: GlobalState): boolean {
  return selectTelebizSkills(global).isLoading;
}

export function selectTelebizSkillsIsSaving(global: GlobalState): boolean {
  return selectTelebizSkills(global).isSaving;
}

export function selectTelebizSkillsError(global: GlobalState): string | undefined {
  return selectTelebizSkills(global).error;
}

export function selectActiveSkills(global: GlobalState): Skill[] {
  return selectTelebizSkillsList(global).filter((item) => item.isActive);
}

// Selectors by skill type

export function selectKnowledgeSkills(global: GlobalState): Skill[] {
  return selectActiveSkills(global).filter((item) => item.skillType === 'knowledge');
}

export function selectToolSkills(global: GlobalState): Skill[] {
  return selectActiveSkills(global).filter((item) => item.skillType === 'tool');
}

export function selectOnDemandSkills(global: GlobalState): Skill[] {
  return selectActiveSkills(global).filter((item) => item.skillType === 'onDemand');
}

export function selectSkillByName(global: GlobalState, name: string): Skill | undefined {
  return selectActiveSkills(global).find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
}

export function selectOnDemandSkillByName(global: GlobalState, name: string): Skill | undefined {
  return selectOnDemandSkills(global).find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
}

// MCP Bridge Selectors
export function selectIsMcpEnabled(global: GlobalState): boolean {
  return selectTelebizAgent(global).isMcpEnabled;
}

export function selectIsMcpConnected(global: GlobalState): boolean {
  return selectTelebizAgent(global).isMcpConnected;
}

// Provider Selectors
export function selectTelebizAgentActiveProvider(global: GlobalState): AIProvider {
  return selectTelebizAgent(global).activeProvider;
}

// Claude Selectors
export function selectIsTelebizClaudeConnected(global: GlobalState): boolean {
  return selectTelebizAgent(global).isClaudeConnected;
}

export function selectIsTelebizClaudeConnecting(global: GlobalState): boolean {
  return selectTelebizAgent(global).isClaudeConnecting;
}

export function selectTelebizClaudeModels(global: GlobalState): ClaudeModel[] {
  return selectTelebizAgent(global).claudeModels;
}

export function selectTelebizAgentIsLoadingClaudeModels(global: GlobalState): boolean {
  return selectTelebizAgent(global).isLoadingClaudeModels;
}

// OpenAI Selectors
export function selectIsTelebizOpenAIConnected(global: GlobalState): boolean {
  return selectTelebizAgent(global).isOpenAIConnected;
}

export function selectIsTelebizOpenAIConnecting(global: GlobalState): boolean {
  return selectTelebizAgent(global).isOpenAIConnecting;
}

export function selectTelebizOpenAIModels(global: GlobalState): OpenAIModel[] {
  return selectTelebizAgent(global).openaiModels;
}

export function selectTelebizAgentIsLoadingOpenAIModels(global: GlobalState): boolean {
  return selectTelebizAgent(global).isLoadingOpenAIModels;
}

// Gemini Selectors
export function selectIsTelebizGeminiConnected(global: GlobalState): boolean {
  return selectTelebizAgent(global).isGeminiConnected;
}

export function selectIsTelebizGeminiConnecting(global: GlobalState): boolean {
  return selectTelebizAgent(global).isGeminiConnecting;
}

export function selectTelebizGeminiModels(global: GlobalState): GeminiModel[] {
  return selectTelebizAgent(global).geminiModels;
}

export function selectTelebizAgentIsLoadingGeminiModels(global: GlobalState): boolean {
  return selectTelebizAgent(global).isLoadingGeminiModels;
}

// Helper to check if any AI provider is connected
export function selectIsAnyAIProviderConnected(global: GlobalState): boolean {
  const agent = selectTelebizAgent(global);
  return agent.isConnected || agent.isClaudeConnected || agent.isOpenAIConnected || agent.isGeminiConnected;
}

// Helper to check if the active provider is connected
export function selectIsActiveProviderConnected(global: GlobalState): boolean {
  const agent = selectTelebizAgent(global);
  switch (agent.activeProvider) {
    case 'claude':
      return agent.isClaudeConnected;
    case 'openai':
      return agent.isOpenAIConnected;
    case 'gemini':
      return agent.isGeminiConnected;
    case 'openrouter':
    default:
      return agent.isConnected;
  }
}
