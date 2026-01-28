import { getGlobal } from '../../../global';

import type { AgentMode } from '../../global/types';
import type {
  AgentConfig,
  AgentExecution,
  AgentMessage,
  AgentPlan,
  AIProvider,
  ConfirmationRequest,
  ExecutionStep,
  ReasoningDetail,
  Skill,
  ThinkingState,
  ToolCall,
  ToolDefinition,
} from '../types';

import {
  selectCurrentTelebizOrganization,
  selectKnowledgeSkills,
  selectOnDemandSkillByName,
  selectTelebizUser,
  selectToolSkills,
} from '../../global/selectors';
import { logDebugMessage } from '../../../util/debugConsole';
import generateUniqueId from '../../../util/generateUniqueId';
import { isDestructiveTool } from '../tools';
import { buildSystemPrompt, processToolCalls, validateConversationHistory } from '../utils';

import { AgentApiClient } from '../../services/api/AgentApiClient';
import { ClaudeApiClient } from '../../services/api/ClaudeApiClient';
import { GeminiApiClient } from '../../services/api/GeminiApiClient';
import { OpenAIApiClient } from '../../services/api/OpenAIApiClient';

const MAX_ITERATIONS = 100;

const apiClient = new AgentApiClient();
const claudeApiClient = new ClaudeApiClient();
const openaiApiClient = new OpenAIApiClient();
const geminiApiClient = new GeminiApiClient();

// Callbacks for state updates during agent execution
export interface AgentRunnerCallbacks {
  onThinkingUpdate: (thinking: Partial<ThinkingState>) => void;
  onMessageAdd: (message: AgentMessage) => void;
  onMessageUpdate: (messageId: string, updates: Partial<AgentMessage>) => void;
  onError: (error: string) => void;
  onConfirmationRequired: (plan: AgentPlan, confirmation: ConfirmationRequest) => void;
}

// Result from running the agent loop
export interface AgentRunResult {
  steps: ExecutionStep[];
  affectedChatIds: string[];
  execution?: AgentExecution;
}

// Input for running the agent loop
export interface AgentRunInput {
  accessToken: string;
  userMessage: string;
  mode: AgentMode;
  config: Partial<AgentConfig>;
  existingMessages: AgentMessage[];
  abortSignal?: AbortSignal;
  provider?: AIProvider;
}

/**
 * Get the tools available for a given agent mode
 */
function getToolsForMode(mode: AgentMode): ToolDefinition[] {
  // Import lazily to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ALL_TOOLS, READ_ONLY_TOOLS } = require('../tools');
  return mode === 'ask' ? READ_ONLY_TOOLS : ALL_TOOLS;
}

/**
 * Get extra tool tools for a loaded extra tool
 */
function getExtraToolToolsForMode(extraToolName: string, mode: AgentMode): ToolDefinition[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getExtraToolTools, EXTRA_TOOLS_REGISTRY } = require('../tools');
  const tools = getExtraToolTools(extraToolName);

  // In ask or plan mode, only return read-only extra tool tools
  if (mode === 'ask' || mode === 'plan') {
    const extraTool = EXTRA_TOOLS_REGISTRY[extraToolName];
    const readOnlyToolNames = extraTool?.readOnlyTools || [];
    return tools.filter((t: ToolDefinition) => readOnlyToolNames.includes(t.function.name));
  }

  return tools;
}

/**
 * Validate and filter tool calls from LLM response
 */
function validateToolCalls(toolCallsMap: Map<string, ToolCall>): ToolCall[] {
  return Array.from(toolCallsMap.values()).filter((tc) => {
    if (!tc.id || !tc.function.name) return false;
    try {
      JSON.parse(tc.function.arguments || '{}');
      return true;
    } catch {
      logDebugMessage('warn', `Skipping malformed tool call: ${tc.id}`, tc.function.arguments);
      return false;
    }
  });
}

/**
 * Build a confirmation request for destructive tools
 */
function buildConfirmationRequest(
  toolCalls: ToolCall[],
  description: string,
): { plan: AgentPlan; confirmation: ConfirmationRequest } {
  const plan: AgentPlan = {
    id: generateUniqueId(),
    description: description || 'Executing requested actions',
    steps: toolCalls.map((tc) => ({
      id: generateUniqueId(),
      tool: tc.function.name,
      description: `Execute ${tc.function.name}`,
      args: JSON.parse(tc.function.arguments),
      status: 'pending' as const,
    })),
    status: 'awaiting_confirmation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const confirmation: ConfirmationRequest = {
    planId: plan.id,
    description: description || 'This action requires confirmation',
    steps: plan.steps,
    estimatedImpact: {
      chatsAffected: plan.steps.length,
      isDestructive: true,
    },
  };

  return { plan, confirmation };
}

/**
 * Build an execution record from completed steps
 */
function buildExecution(
  request: string,
  steps: ExecutionStep[],
  affectedChatIds: string[],
): AgentExecution {
  return {
    id: generateUniqueId(),
    userId: 0,
    request,
    plan: {
      id: generateUniqueId(),
      description: 'Completed actions',
      steps: steps.map((s) => ({
        id: s.id,
        tool: s.tool,
        description: s.tool,
        args: s.args,
        status: s.status,
        result: s.result,
      })),
      status: 'completed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    steps,
    affectedChatIds: [...new Set(affectedChatIds)],
    status: 'completed',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    canUndo: steps.some((s) => s.undoAction),
  };
}

/**
 * Run a single iteration of the agent loop
 * Returns whether to continue the loop and any pending confirmation
 */
async function runIteration(
  conversationMessages: AgentMessage[],
  tools: ToolDefinition[],
  config: Partial<AgentConfig>,
  accessToken: string,
  callbacks: AgentRunnerCallbacks,
  allThinkingSteps: string[],
  abortSignal?: AbortSignal,
  provider: AIProvider = 'openrouter',
): Promise<{
  shouldContinue: boolean;
  assistantMessage: AgentMessage;
  toolCalls: ToolCall[];
  needsConfirmation: boolean;
}> {
  const iterationStartTime = Date.now();
  const assistantMessageId = generateUniqueId();

  // Create assistant message placeholder
  const assistantMessage: AgentMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  };
  callbacks.onMessageAdd(assistantMessage);

  let fullContent = '';
  let fullReasoning = '';
  let allReasoningDetails: ReasoningDetail[] = [];
  const toolCallsMap = new Map<string, ToolCall>();

  // Resume thinking for this iteration (reset currentStep to show "Thinking")
  callbacks.onThinkingUpdate({
    isThinking: true,
    startedAt: iterationStartTime,
    currentStep: undefined,
  });

  // Debounce timer to re-enable thinking after content stops streaming
  let contentIdleTimer: ReturnType<typeof setTimeout> | undefined;
  const CONTENT_IDLE_DELAY_MS = 500;

  // Stream the response using the appropriate API client
  const getClientForProvider = () => {
    switch (provider) {
      case 'claude':
        return claudeApiClient;
      case 'openai':
        return openaiApiClient;
      case 'gemini':
        return geminiApiClient;
      case 'openrouter':
      default:
        return apiClient;
    }
  };
  const client = getClientForProvider();
  await client.streamChat(
    accessToken,
    conversationMessages,
    tools,
    config,
    (delta) => {
      if (delta.type === 'content' && delta.content) {
        fullContent += delta.content;
        callbacks.onMessageUpdate(assistantMessageId, { content: fullContent });
        // Hide thinking while content is actively streaming
        callbacks.onThinkingUpdate({ isThinking: false });

        // Reset idle timer - re-enable thinking if content stops for a bit
        if (contentIdleTimer) clearTimeout(contentIdleTimer);
        contentIdleTimer = setTimeout(() => {
          callbacks.onThinkingUpdate({
            isThinking: true,
            startedAt: Date.now(),
            currentStep: undefined,
          });
        }, CONTENT_IDLE_DELAY_MS);
      }

      if (delta.type === 'reasoning') {
        if (delta.reasoning) {
          fullReasoning += delta.reasoning;
        }
        if (delta.thinkingTitle && !allThinkingSteps.includes(delta.thinkingTitle)) {
          allThinkingSteps.push(delta.thinkingTitle);
          callbacks.onThinkingUpdate({
            currentStep: delta.thinkingTitle,
            steps: [...allThinkingSteps],
          });
        }
        if (delta.reasoningDetails?.length) {
          allReasoningDetails = [...allReasoningDetails, ...delta.reasoningDetails];
        }
      }

      if (delta.type === 'tool_call' && delta.toolCall) {
        // Clear the idle timer since tool calls are arriving
        if (contentIdleTimer) {
          clearTimeout(contentIdleTimer);
          contentIdleTimer = undefined;
        }
        const tc = delta.toolCall;
        if (tc.id) {
          const toolName = tc.function?.name || '';
          const existingTool = toolCallsMap.get(tc.id);

          toolCallsMap.set(tc.id, {
            id: tc.id,
            type: 'function',
            function: {
              name: toolName || existingTool?.function.name || '',
              arguments: (existingTool?.function.arguments || '') + (tc.function?.arguments || ''),
            },
          });

          // Show thinking with tool count as they stream in
          if (toolName || !existingTool) {
            const toolCount = toolCallsMap.size;
            callbacks.onThinkingUpdate({
              isThinking: true,
              startedAt: Date.now(),
              currentStep: toolCount === 1
                ? `Preparing ${toolName || 'tool'}`
                : `Preparing ${toolCount} tools`,
            });
          }
        }
      }

      if (delta.type === 'error') {
        callbacks.onError(delta.error || 'Unknown streaming error');
      }
    },
    abortSignal,
  );

  // Clear idle timer after streaming ends
  if (contentIdleTimer) {
    clearTimeout(contentIdleTimer);
  }

  const collectedToolCalls = validateToolCalls(toolCallsMap);
  const thoughtDuration = Math.floor((Date.now() - iterationStartTime) / 1000);
  const isFinalResponse = collectedToolCalls.length === 0;

  // Update assistant message with final content
  callbacks.onMessageUpdate(assistantMessageId, {
    content: fullContent,
    toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
    reasoning: fullReasoning || undefined,
    reasoningDetails: allReasoningDetails.length > 0 ? allReasoningDetails : undefined,
    thoughtDuration: thoughtDuration && thoughtDuration > 0 ? thoughtDuration : undefined,
  });

  // Build the complete assistant message for conversation history
  const completeAssistantMessage: AgentMessage = {
    id: assistantMessageId,
    role: 'assistant',
    content: fullContent,
    toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
    reasoning: fullReasoning || undefined,
    reasoningDetails: allReasoningDetails.length > 0 ? allReasoningDetails : undefined,
    timestamp: Date.now(),
  };

  // Check for destructive tools
  const hasDestructive = collectedToolCalls.some((tc) => isDestructiveTool(tc.function.name));

  return {
    shouldContinue: !isFinalResponse && !hasDestructive,
    assistantMessage: completeAssistantMessage,
    toolCalls: collectedToolCalls,
    needsConfirmation: hasDestructive,
  };
}

/**
 * Build a prompt section for knowledge skills (injected directly into system prompt)
 */
function buildKnowledgeSkillsSection(knowledgeSkills: Skill[]): string {
  if (knowledgeSkills.length === 0) return '';

  const skillsContent = knowledgeSkills.map((skill) => {
    return `### ${skill.name.toUpperCase()}
Context: ${skill.context}

${skill.content}`;
  }).join('\n\n');

  return `

=== KNOWLEDGE (ALWAYS APPLY) ===
The following instructions should always guide your responses:

${skillsContent}`;
}

/**
 * Build a prompt section listing tool skill contexts (agent can retrieve via getSkillData)
 */
function buildToolSkillsPromptSection(toolSkills: Skill[]): string {
  if (toolSkills.length === 0) return '';

  const contextList = toolSkills.map((item) => `→ "${item.context}" (/${item.name})`).join('\n');

  return `

=== AVAILABLE SKILLS (RETRIEVE WHEN RELEVANT) ===
${contextList}

For each skill above: if it applies OR says "always/every/all", call getSkillData("context") before responding.`;
}

/**
 * Build a prompt section for on-demand skills invoked via /skill-name
 */
function buildOnDemandSkillsSection(invokedSkills: Skill[]): string {
  if (invokedSkills.length === 0) return '';

  const skillsContent = invokedSkills.map((skill) => {
    return `### /${skill.name.toUpperCase()} (INVOKED BY USER)
Context: ${skill.context}

${skill.content}`;
  }).join('\n\n');

  return `

=== INVOKED SKILLS (APPLY FOR THIS REQUEST) ===
The user explicitly invoked the following skills. Apply them to this request:

${skillsContent}`;
}

/**
 * Parse /skill-name tags from user message
 * Returns the skill names found and the cleaned message
 */
function parseSkillTags(message: string): { skillNames: string[]; cleanedMessage: string } {
  // Match /skill-name patterns (alphanumeric, dashes, underscores)
  const skillTagRegex = /\/([a-zA-Z][a-zA-Z0-9_-]*)/g;
  const skillNames: string[] = [];
  let match;

  while ((match = skillTagRegex.exec(message)) !== null) {
    skillNames.push(match[1].toLowerCase());
  }

  // Remove skill tags from the message
  const cleanedMessage = message.replace(skillTagRegex, '').trim().replace(/\s+/g, ' ');

  return { skillNames, cleanedMessage };
}

/**
 * Run the main agent loop
 * Handles streaming, tool execution, and iterative processing
 */
export async function runAgentLoop(
  input: AgentRunInput,
  callbacks: AgentRunnerCallbacks,
): Promise<AgentRunResult | undefined> {
  const { accessToken, userMessage, mode, config, existingMessages, abortSignal, provider = 'openrouter' } = input;

  // Build system prompt with user/org context
  const global = getGlobal();
  const user = selectTelebizUser(global);
  const organization = selectCurrentTelebizOrganization(global);

  // Get skills by type
  const knowledgeSkills = selectKnowledgeSkills(global);
  const toolSkills = selectToolSkills(global);

  // Parse /skill-name tags from user message
  const { skillNames: invokedSkillNames, cleanedMessage } = parseSkillTags(userMessage);

  // Find invoked on-demand skills
  const invokedOnDemandSkills: Skill[] = [];
  const notFoundSkills: string[] = [];

  for (const skillName of invokedSkillNames) {
    const skill = selectOnDemandSkillByName(global, skillName);
    if (skill) {
      invokedOnDemandSkills.push(skill);
    } else {
      notFoundSkills.push(skillName);
    }
  }

  // Log skill parsing results
  if (invokedSkillNames.length > 0) {
    logDebugMessage('info', 'Skill tags parsed from user message', {
      found: invokedOnDemandSkills.map((s) => s.name),
      notFound: notFoundSkills,
    });
  }

  // Build system prompt with all skill sections
  let systemPrompt = buildSystemPrompt(mode, { user, organization });

  // 1. Inject knowledge skills (always present)
  if (knowledgeSkills.length > 0) {
    systemPrompt += buildKnowledgeSkillsSection(knowledgeSkills);
    logDebugMessage('info', `Injected ${knowledgeSkills.length} knowledge skill(s) into system prompt`);
  }

  // 2. Add tool skills section (agent can retrieve via getSkillData)
  if (toolSkills.length > 0) {
    systemPrompt += buildToolSkillsPromptSection(toolSkills);
  }

  // 3. Inject invoked on-demand skills directly
  if (invokedOnDemandSkills.length > 0) {
    systemPrompt += buildOnDemandSkillsSection(invokedOnDemandSkills);
    logDebugMessage('info', `Injected ${invokedOnDemandSkills.length} on-demand skill(s): ${invokedOnDemandSkills.map((s) => s.name).join(', ')}`);
  }

  let tools = getToolsForMode(mode);

  // Track loaded skills for dynamic tool expansion
  const loadedSkills = new Set<string>();

  // Auto-load skills extra tool when tool skills exist
  // This gives the agent access to getSkillData/getAllSkillData from the start
  if (toolSkills.length > 0) {
    loadedSkills.add('skills');
    const skillsExtraToolTools = getExtraToolToolsForMode('skills', mode);
    tools = [...tools, ...skillsExtraToolTools];
    logDebugMessage('info', `Auto-loaded skills extra tool (${toolSkills.length} tool skill(s) available)`);
  }

  // Use cleaned message (without skill tags) for the conversation
  const processedUserMessage = cleanedMessage || userMessage;

  // Track all steps across the loop
  const allSteps: ExecutionStep[] = [];
  const allAffectedChatIds: string[] = [];
  const allThinkingSteps: string[] = [];

  // Build initial conversation
  const validatedHistory = validateConversationHistory(existingMessages);
  const userMsg: AgentMessage = {
    id: generateUniqueId(),
    role: 'user',
    content: processedUserMessage,
    timestamp: Date.now(),
  };

  const conversationMessages: AgentMessage[] = [
    { id: 'system', role: 'system', content: systemPrompt, timestamp: 0 },
    ...validatedHistory,
    userMsg,
  ];

  // Start thinking state
  callbacks.onThinkingUpdate({
    isThinking: true,
    startedAt: Date.now(),
    steps: [],
    currentStep: undefined,
  });

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const result = await runIteration(
      conversationMessages,
      tools,
      config,
      accessToken,
      callbacks,
      allThinkingSteps,
      abortSignal,
      provider,
    );

    // If needs confirmation, pause and return
    if (result.needsConfirmation) {
      const { plan, confirmation } = buildConfirmationRequest(
        result.toolCalls,
        result.assistantMessage.content,
      );
      callbacks.onThinkingUpdate({ isThinking: false, steps: [] });
      callbacks.onConfirmationRequired(plan, confirmation);
      return undefined; // Execution paused for confirmation
    }

    // If final response (no tool calls), we're done
    if (!result.shouldContinue) {
      callbacks.onThinkingUpdate({ isThinking: false, steps: [] });
      break;
    }

    // Show thinking during tool execution
    callbacks.onThinkingUpdate({
      isThinking: true,
      startedAt: Date.now(),
      currentStep: 'Executing tools',
    });

    // Execute tools and continue loop
    const planId = generateUniqueId();
    const { steps, affectedChatIds } = await processToolCalls(result.toolCalls, planId, mode);
    allSteps.push(...steps);
    allAffectedChatIds.push(...affectedChatIds);

    // Check for useExtraTool calls and dynamically add extra tool tools
    for (const step of steps) {
      if (step.tool === 'useExtraTool' && step.result?.success) {
        const extraToolName = step.args.extraTool as string;
        if (extraToolName && !loadedSkills.has(extraToolName)) {
          loadedSkills.add(extraToolName);
          const extraToolTools = getExtraToolToolsForMode(extraToolName, mode);
          // Add extra tool tools to available tools for next iteration
          tools = [...tools, ...extraToolTools];
          logDebugMessage('info', `Extra tool loaded: ${extraToolName}, added ${extraToolTools.length} tools`);
        }
      }
    }

    // Add assistant message to conversation
    conversationMessages.push(result.assistantMessage);

    // Add tool results to conversation and state
    for (const step of steps) {
      const toolResultContent = JSON.stringify(step.result?.data || step.result?.error);
      const toolMsg: AgentMessage = {
        id: generateUniqueId(),
        role: 'tool',
        content: toolResultContent,
        toolCallId: step.toolCallId,
        timestamp: Date.now(),
      };
      conversationMessages.push(toolMsg);
      callbacks.onMessageAdd(toolMsg);
      callbacks.onThinkingUpdate({
        isThinking: true,
        startedAt: Date.now(),
        currentStep: `Executing ${step.tool}`,
      });
    }
  }

  // Build execution record if we executed any tools
  if (allSteps.length > 0) {
    const execution = buildExecution(userMessage, allSteps, allAffectedChatIds);
    return {
      steps: allSteps,
      affectedChatIds: [...new Set(allAffectedChatIds)],
      execution,
    };
  }

  return {
    steps: [],
    affectedChatIds: [],
  };
}

/**
 * Execute a confirmed plan's tool calls
 */
export async function executePlan(
  plan: AgentPlan,
  pendingConfirmation: ConfirmationRequest,
): Promise<{
  completedPlan: AgentPlan;
  execution: AgentExecution;
  completionMessage: AgentMessage;
}> {
  const toolCalls: ToolCall[] = plan.steps.map((step) => ({
    id: step.id,
    type: 'function',
    function: {
      name: step.tool,
      arguments: JSON.stringify(step.args),
    },
  }));

  // Confirmed plans are always executed in 'agent' mode since user approved the action
  const { steps, affectedChatIds } = await processToolCalls(toolCalls, plan.id, 'agent');

  const completedPlan: AgentPlan = {
    ...plan,
    status: steps.every((s) => s.status === 'completed') ? 'completed' : 'failed',
    steps: steps.map((s) => ({
      id: s.id,
      tool: s.tool,
      description: s.tool,
      args: s.args,
      status: s.status,
      result: s.result,
    })),
    updatedAt: Date.now(),
  };

  const successCount = steps.filter((s) => s.status === 'completed').length;
  const completionMessage: AgentMessage = {
    id: generateUniqueId(),
    role: 'assistant',
    content: `Completed ${successCount}/${steps.length} actions.${
      affectedChatIds.length > 0 ? ` Affected ${affectedChatIds.length} chat(s).` : ''
    }`,
    timestamp: Date.now(),
  };

  const execution: AgentExecution = {
    id: plan.id,
    userId: 0,
    request: pendingConfirmation.description,
    plan: completedPlan,
    steps,
    affectedChatIds,
    status: completedPlan.status === 'completed' ? 'completed' : 'failed',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    canUndo: steps.some((s) => s.undoAction),
  };

  return { completedPlan, execution, completionMessage };
}

/**
 * Execute undo actions for a previous execution
 */
export async function executeUndo(execution: AgentExecution): Promise<AgentMessage> {
  // Import lazily to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { executeTool } = require('../tools');

  for (const step of execution.steps) {
    if (step.undoAction) {
      await executeTool(step.undoAction.tool, step.undoAction.args);
    }
  }

  return {
    id: generateUniqueId(),
    role: 'assistant',
    content: `Undone: ${execution.request}`,
    timestamp: Date.now(),
  };
}

/**
 * Get the API client instance (for use by actions that need direct access)
 */
export function getApiClient(): AgentApiClient {
  return apiClient;
}

/**
 * Get the Claude API client instance
 */
export function getClaudeApiClient(): ClaudeApiClient {
  return claudeApiClient;
}

/**
 * Get the OpenAI API client instance
 */
export function getOpenAIApiClient(): OpenAIApiClient {
  return openaiApiClient;
}

/**
 * Get the Gemini API client instance
 */
export function getGeminiApiClient(): GeminiApiClient {
  return geminiApiClient;
}
