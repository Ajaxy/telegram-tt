// AI Provider Types
export type AIProvider = 'openrouter' | 'claude' | 'openai' | 'gemini';

// Claude Model Types
export interface ClaudeModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

// OpenAI Model Types
export interface OpenAIModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

// Gemini Model Types
export interface GeminiModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

// Agent Configuration
export interface AgentConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// OpenRouter Types
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

// Tool Definition Types (OpenRouter Function Calling Format)
export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required?: string[];
    };
  };
}

// Tool Call Types
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  affectedChatIds?: string[];
}

// Agent Message Types
export type AgentMessageRole = 'user' | 'assistant' | 'tool' | 'system';

// Gemini reasoning details (thought signatures)
export interface ReasoningDetail {
  id?: string;
  type: string;
  text?: string;
  data?: string;
  format?: string;
  index?: number;
}

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: number;
  // For Gemini models - preserve reasoning tokens
  reasoning?: string;
  reasoningDetails?: ReasoningDetail[];
  // How long the agent spent thinking (in seconds)
  thoughtDuration?: number;
}

// Plan Types
export type PlanStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type PlanStatus = 'planning' | 'awaiting_confirmation' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface PlanStep {
  id: string;
  tool: string;
  description: string;
  args: Record<string, unknown>;
  status: PlanStepStatus;
  result?: ToolResult;
  timestamp?: number;
}

export interface AgentPlan {
  id: string;
  description: string;
  steps: PlanStep[];
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
}

// Execution Types (local-only, not persisted to backend)
export interface ExecutionStep {
  id: string;
  toolCallId?: string; // Original tool call ID for API response matching
  planId: string;
  tool: string;
  args: Record<string, unknown>;
  status: PlanStepStatus;
  result?: ToolResult;
  affectedChatIds?: string[];
  timestamp: number;
  undoAction?: {
    tool: string;
    args: Record<string, unknown>;
  };
}

export interface AgentExecution {
  id: string;
  userId: number;
  organizationId?: number;
  request: string;
  plan: AgentPlan;
  steps: ExecutionStep[];
  affectedChatIds: string[];
  status: 'completed' | 'failed' | 'cancelled' | 'partial';
  createdAt: string;
  completedAt?: string;
  canUndo: boolean;
}

// Confirmation Types
export interface ConfirmationRequest {
  planId: string;
  description: string;
  steps: PlanStep[];
  estimatedImpact: {
    chatsAffected: number;
    messagesAffected?: number;
    isDestructive: boolean;
  };
}

// Streaming Types
export interface StreamDelta {
  type: 'content' | 'tool_call' | 'reasoning' | 'thinking_start' | 'done' | 'error';
  content?: string;
  toolCall?: Partial<ToolCall>;
  reasoning?: string;
  reasoningDetails?: ReasoningDetail[];
  thinkingTitle?: string; // e.g. "Analyzing chat history"
  error?: string;
}

export type StreamCallback = (delta: StreamDelta) => void;

// Thinking state for UI
export interface ThinkingState {
  isThinking: boolean;
  startedAt?: number;
  currentStep?: string; // The current reasoning step title
  steps: string[]; // All reasoning steps so far
}

// Extra Tools System Types (built-in tool sets: CRM, Notion, etc.)
export type ExtraToolName = 'crm' | 'notion' | 'reminders' | 'bulk' | 'skills';

export interface ExtraTool {
  name: ExtraToolName;
  description: string;
  tools: ToolDefinition[];
  contextPrompt: string;
  /** Tool names that are read-only (safe for ask/plan modes) */
  readOnlyTools?: string[];
}

export type ExtraToolExecutor = (toolName: string, args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;

export interface LoadedExtraTool {
  name: ExtraToolName;
  loadedAt: number;
}

// Conversation Types
export interface AgentConversation {
  id: string;
  title: string; // Auto-generated from first user message
  messages: AgentMessage[];
  provider: AIProvider; // Which AI provider was used for this conversation
  createdAt: number;
  updatedAt: number;
}

// Skills - User-defined skills with context + content model
export type SkillType = 'knowledge' | 'tool' | 'onDemand';

export interface Skill {
  id: string;
  name: string; // Unique tag name for /skill-name invocation (e.g., "pricing" for "/pricing")
  context: string; // When to apply (e.g., "when sending a message always use the user tone")
  content: string; // What to do (e.g., "the user tone is professional, calm, builder voice...")
  skillType: SkillType; // How the skill is injected into context
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Skill type descriptions:
 * - 'knowledge': Injected directly into the initial system prompt. Always available to the agent.
 *                Use for general instructions, tone guidelines, or facts the agent should always know.
 *
 * - 'tool': The agent can retrieve this skill using getSkillData when it determines it's relevant.
 *           Use for situational instructions that may apply in specific contexts.
 *
 * - 'onDemand': Only injected when the user explicitly invokes it with /skill-name in their message.
 *               Use for specialized instructions that should only apply when explicitly requested.
 */
