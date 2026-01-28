import type { GlobalState } from '../../../global/types';
import type {
  AgentConversation,
  AgentMessage,
  AgentPlan,
  AIProvider,
  ConfirmationRequest,
  Skill,
  SkillType,
  ThinkingState,
} from '../../agent/types';
import type { TelebizAgentState, TelebizSkillsState } from '../types';

import generateUniqueId from '../../../util/generateUniqueId';
import { generateConversationTitle } from '../../agent/utils';
import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizAgent<T extends GlobalState>(
  global: T,
  update: Partial<TelebizAgentState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      agent: {
        ...(global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent),
        ...update,
      },
    },
  };
}

export function addTelebizAgentMessage<T extends GlobalState>(
  global: T,
  message: AgentMessage,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  return updateTelebizAgent(global, {
    messages: [...current.messages, message],
  });
}

export function updateTelebizAgentMessage<T extends GlobalState>(
  global: T,
  messageId: string,
  updates: Partial<AgentMessage>,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  const updatedMessages = current.messages.map((msg) =>
    msg.id === messageId ? { ...msg, ...updates } : msg);

  return updateTelebizAgent(global, {
    messages: updatedMessages,
  });
}

export function clearTelebizAgentMessages<T extends GlobalState>(global: T): T {
  return updateTelebizAgent(global, {
    messages: [],
    currentPlan: undefined,
    pendingConfirmation: undefined,
    error: undefined,
  });
}

export function setTelebizAgentPlan<T extends GlobalState>(
  global: T,
  plan: AgentPlan | undefined,
): T {
  return updateTelebizAgent(global, {
    currentPlan: plan,
  });
}

export function setTelebizAgentConfirmation<T extends GlobalState>(
  global: T,
  confirmation: ConfirmationRequest | undefined,
): T {
  return updateTelebizAgent(global, {
    pendingConfirmation: confirmation,
  });
}

export function createAgentConversation<T extends GlobalState>(
  global: T,
  conversation: AgentConversation,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  return updateTelebizAgent(global, {
    conversations: {
      ...current.conversations,
      [conversation.id]: conversation,
    },
    currentConversationId: conversation.id,
    messages: conversation.messages,
  });
}

// Get default model for a provider
function getDefaultModelForProvider(provider: AIProvider): string {
  switch (provider) {
    case 'claude':
      return 'claude-sonnet-4-5-20250929';
    case 'openai':
      return 'gpt-4o';
    case 'gemini':
      return 'gemini-2.0-flash';
    case 'openrouter':
    default:
      return 'anthropic/claude-sonnet-4.5';
  }
}

export function switchAgentConversation<T extends GlobalState>(
  global: T,
  conversationId: string,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  const conversation = current.conversations[conversationId];
  if (!conversation) return global;

  // Restore the provider from the conversation (default to openrouter for backward compatibility)
  const provider = conversation.provider || 'openrouter';
  const shouldSwitchProvider = provider !== current.activeProvider;

  // Update config model if switching providers
  const newConfig = shouldSwitchProvider
    ? { ...current.config, model: getDefaultModelForProvider(provider) }
    : current.config;

  return updateTelebizAgent(global, {
    currentConversationId: conversationId,
    messages: conversation.messages,
    activeProvider: provider,
    config: newConfig,
    currentPlan: undefined,
    pendingConfirmation: undefined,
    error: undefined,
  });
}

export function deleteAgentConversation<T extends GlobalState>(
  global: T,
  conversationId: string,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  const { [conversationId]: deleted, ...remainingConversations } = current.conversations;

  // If deleting current conversation, clear messages and reset currentConversationId
  const isCurrentConversation = current.currentConversationId === conversationId;

  return updateTelebizAgent(global, {
    conversations: remainingConversations,
    currentConversationId: isCurrentConversation ? undefined : current.currentConversationId,
    messages: isCurrentConversation ? [] : current.messages,
    currentPlan: isCurrentConversation ? undefined : current.currentPlan,
    pendingConfirmation: isCurrentConversation ? undefined : current.pendingConfirmation,
  });
}

export function saveCurrentConversation<T extends GlobalState>(
  global: T,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  if (!current.currentConversationId) return global;

  const conversation = current.conversations[current.currentConversationId];
  if (!conversation) return global;

  // Generate title from first user message if not set
  let title = conversation.title;
  if (!title || title === 'New Conversation') {
    const firstUserMessage = current.messages.find((m) => m.role === 'user');
    if (firstUserMessage) {
      title = generateConversationTitle(firstUserMessage.content);
    }
  }

  const updatedConversation: AgentConversation = {
    ...conversation,
    title,
    messages: current.messages,
    updatedAt: Date.now(),
  };

  return updateTelebizAgent(global, {
    conversations: {
      ...current.conversations,
      [current.currentConversationId]: updatedConversation,
    },
  });
}

export function setAgentConversations<T extends GlobalState>(
  global: T,
  conversations: Record<string, AgentConversation>,
): T {
  return updateTelebizAgent(global, {
    conversations,
  });
}

export function updateTelebizAgentThinking<T extends GlobalState>(
  global: T,
  thinking: Partial<ThinkingState>,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  return updateTelebizAgent(global, {
    thinking: {
      ...current.thinking,
      ...thinking,
    },
  });
}

// Skills Reducers

export function updateTelebizSkills<T extends GlobalState>(
  global: T,
  update: Partial<TelebizSkillsState>,
): T {
  const current = global.telebiz?.agent || INITIAL_TELEBIZ_STATE.agent;
  return updateTelebizAgent(global, {
    skills: {
      ...current.skills,
      ...update,
    },
  });
}

/**
 * Generate a valid skill name (slug) from context text
 * Used when user doesn't provide a custom name
 */
function generateSkillNameFromContext(context: string): string {
  return context
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Remove consecutive dashes
    .replace(/^-|-$/g, '') // Trim dashes from start/end
    .slice(0, 30); // Limit length
}

export function addSkill<T extends GlobalState>(
  global: T,
  data: {
    name?: string;
    context: string;
    content: string;
    skillType?: SkillType;
    isActive?: boolean;
  },
): T {
  const current = global.telebiz?.agent?.skills || INITIAL_TELEBIZ_STATE.agent.skills;
  const id = generateUniqueId();
  const now = Date.now();

  // Generate name from context if not provided
  const name = data.name?.trim() || generateSkillNameFromContext(data.context);

  const newItem: Skill = {
    id,
    name,
    context: data.context,
    content: data.content,
    skillType: data.skillType ?? 'tool', // Default to 'tool' for backward compatibility
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  return updateTelebizSkills(global, {
    skills: {
      ...current.skills,
      [id]: newItem,
    },
  });
}

export function updateSkillData<T extends GlobalState>(
  global: T,
  id: string,
  updates: Partial<Skill>,
): T {
  const current = global.telebiz?.agent?.skills || INITIAL_TELEBIZ_STATE.agent.skills;
  const existing = current.skills[id];
  if (!existing) return global;

  return updateTelebizSkills(global, {
    skills: {
      ...current.skills,
      [id]: { ...existing, ...updates, updatedAt: Date.now() },
    },
  });
}

export function deleteSkill<T extends GlobalState>(
  global: T,
  id: string,
): T {
  const current = global.telebiz?.agent?.skills || INITIAL_TELEBIZ_STATE.agent.skills;
  const { [id]: deleted, ...remaining } = current.skills;
  return updateTelebizSkills(global, {
    skills: remaining,
  });
}
