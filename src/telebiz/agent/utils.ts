import type { AgentMode } from '../global/types';
import type { Organization, TelebizUser } from '../services/types';
import type { AgentMessage, ExecutionStep, ToolCall } from './types';

import { logDebugMessage } from '../../util/debugConsole';
import generateUniqueId from '../../util/generateUniqueId';
import { EXTRA_TOOLS_REGISTRY, getToolExtraTool } from './tools/skills';
import { buildUndoAction, executeTool, isReadOnlyTool } from './tools';

// ============================================================================
// UTILITIES
// ============================================================================

const DEFAULT_TITLE_MAX_LENGTH = 50;

export function generateConversationTitle(content: string, maxLength = DEFAULT_TITLE_MAX_LENGTH): string {
  if (content.length <= maxLength) return content;
  return `${content.substring(0, maxLength)}...`;
}

// ============================================================================
// SYSTEM PROMPT BUILDING - Inherited structure
// ============================================================================

/**
 * Context about user and organization - injected into all prompts
 */
export interface AgentContext {
  user?: TelebizUser;
  organization?: Organization;
}

/**
 * Base knowledge shared across ALL modes
 */
const BASE_KNOWLEDGE = `You are Telebiz, an AI assistant for Telegram business workflows.

TOOL SELECTION (when to use what):
- Questions about CRM/integrations → useExtraTool("crm") → listIntegrations
- "this chat" / "current chat" → getCurrentChat → getChatRelationship
- Questions about a chat's CRM entity → getChatRelationship (returns integrationId + entityType + entityId)
- "pending tasks" / "work to do" / "focus mode" / "tasks mode" → listPendingChats (ONLY for task management)
- Send message / manage chats → use Telegram tools directly

CORE TOOLS:
- getCurrentChat: Get the chat user is viewing right now
- getChatRelationship: Get the CRM entity (contact/deal/page) linked to a chat
- listChats: Search/filter Telegram chats
- getRecentMessages: Read recent messages from a chat
- sendMessage: Send a message to a chat
- listPendingChats: Chats with pending tasks (for task management only)
- getChatTasks: Tasks/notifications for a specific chat
- useExtraTool: Load specialized tool sets

EXTRA TOOLS (load with useExtraTool before using):
- "crm" → listIntegrations, getEntityDetails, updateDealStage, updateEntityField,
          addNoteToEntity, createDeal, createContact, searchEntities, getEntityProperties
- "notion" → getNotionProperties, getNotionPageContent, updateNotionPageProperty,
             updateNotionBlock, toggleNotionTodo, addNoteToPage, createNotionPage
- "reminders" → listReminders, createReminder, completeReminder, deleteReminder
- "bulk" → processAllPendingTasks, batchDismissTasks, getWorkflowContext
- "skills" → getSkillData, getAllSkillData, listSkills, createSkill, updateSkill, deleteSkill

SKILLS SYSTEM:
The user can define skills that teach you specific behaviors, knowledge, or instructions.
Skills come in three types:

1. KNOWLEDGE SKILLS (in "KNOWLEDGE" section)
   - Always present in your context
   - Apply these instructions to ALL responses
   - Examples: brand voice, tone guidelines, company facts

2. TOOL SKILLS (in "AVAILABLE SKILLS" section)
   - Listed by context description
   - Call getSkillData("context") to retrieve when the context matches
   - The agent decides when to load these based on relevance

3. ON-DEMAND SKILLS (in "INVOKED SKILLS" section)
   - Only appear when user types /skill-name in their message
   - Apply these instructions specifically to the current request
   - User explicitly requested this skill

Priority: Invoked skills > Knowledge > Tool skills (when contexts overlap).

MANAGING SKILLS:
When the user asks you to create, update, or manage skills, load the "skills" extra tool.
Available management tools:
- listSkills: See all skills (name, type, context, active status)
- createSkill: Create a new skill with name, context, content, and skillType (knowledge/tool/onDemand)
- updateSkill: Update an existing skill's content, type, or active status
- deleteSkill: Permanently remove a skill

Examples of when to create skills:
- "Remember that I prefer formal language" → knowledge skill
- "When I ask about pricing, here's what to say..." → tool skill
- "Create a /summary skill that..." → onDemand skill

DATA MODEL:
- Telegram chats can be linked to CRM entities (HubSpot contacts/deals, Notion pages)
- getChatRelationship returns: integrationId, entityType, entityId, provider name
- Use these IDs with extra tool tools (e.g., getEntityDetails, updateDealStage)`;

/**
 * Ask mode = Base + read-only restrictions
 */
const ASK_ADDITIONS = `

MODE: READ-ONLY (Ask Mode)
You can query data but CANNOT modify anything.
No sending messages, updating CRM, dismissing tasks, etc.

Available read operations:
- All query tools (getCurrentChat, getChatRelationship, listChats, getRecentMessages, searchMessages)
- CRM reads: listIntegrations, getEntityDetails, getEntityProperties, searchEntities
- Notion reads: getNotionPageContent
- Reminders: listReminders
- Bulk: processAllPendingTasks, getWorkflowContext

Be concise and informative.`;

/**
 * Plan mode = Ask + planning instructions
 */
const PLAN_ADDITIONS = `

MODE: PLANNING (Plan Mode)
You can query data and CREATE PLANS, but do NOT execute actions.

Planning process:
1. Gather context using read tools
2. Create a detailed step-by-step plan
3. Explain what each step does and expected outcome
4. Present the plan and wait for user confirmation

You have same read access as Ask mode, plus you can plan write operations.
Present plans clearly with expected outcomes.`;

/**
 * Agent mode = Full capabilities
 */
const AGENT_ADDITIONS = `

MODE: FULL ACCESS (Agent Mode)
You can read AND write - execute actions on user's behalf.

Write operations available:
- Telegram: sendMessage, archiveChat, pinChat, deleteMessages, createFolder
- CRM: updateDealStage, updateEntityField, addNoteToEntity, createDeal, createContact
- Notion: updateNotionBlock, toggleNotionTodo, createNotionPage
- Tasks: dismissTask, snoozeTask
- Reminders: createReminder, completeReminder, deleteReminder

Guidelines:
- Explain plan before destructive actions (delete, archive)
- Summarize completed actions
- Be concise but informative`;

/**
 * Build user/org context string
 */
function buildContextString(context: AgentContext): string {
  const parts: string[] = [];

  if (context.user) {
    const name = [context.user.first_name, context.user.last_name].filter(Boolean).join(' ')
      || context.user.username || 'User';
    parts.push(`User: ${name}${context.user.username ? ` (@${context.user.username})` : ''}`);
  }

  if (context.organization) {
    parts.push(`Organization: ${context.organization.name}`);
  }

  if (parts.length === 0) return '';

  return `\nCONTEXT:\n${parts.join('\n')}\n`;
}

/**
 * Build complete system prompt for a mode with optional context
 */
export function buildSystemPrompt(mode: AgentMode, context?: AgentContext): string {
  const contextStr = context ? buildContextString(context) : '';

  switch (mode) {
    case 'ask':
      return BASE_KNOWLEDGE + contextStr + ASK_ADDITIONS;
    case 'plan':
      return BASE_KNOWLEDGE + contextStr + PLAN_ADDITIONS;
    case 'agent':
    default:
      return BASE_KNOWLEDGE + contextStr + AGENT_ADDITIONS;
  }
}

/**
 * Static prompts (for backward compatibility)
 */
export const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  ask: buildSystemPrompt('ask'),
  plan: buildSystemPrompt('plan'),
  agent: buildSystemPrompt('agent'),
};

export const SUPPORTED_MODELS = [
  'anthropic/claude-opus-4.5',
  'anthropic/claude-sonnet-4.5',
  'google/gemini-3-pro-preview',
  'openai/gpt-5',
  'openai/gpt-5.2',
  'x-ai/grok-4',
  'mistralai/devstral-2512:free',
  'z-ai/glm-4.6',
];

/**
 * Validate conversation history to ensure all tool_calls have matching tool results.
 * This prevents the "tool_use without tool_result" error from providers.
 */
export function validateConversationHistory(messages: AgentMessage[]): AgentMessage[] {
  const result: AgentMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // If it's an assistant message with tool calls, verify all have matching results
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      const toolCallIds = new Set(msg.toolCalls.map((tc) => tc.id));
      const toolResultIds = new Set<string>();

      // Look for tool results immediately after this message
      let j = i + 1;
      while (j < messages.length && messages[j].role === 'tool') {
        if (messages[j].toolCallId) {
          toolResultIds.add(messages[j].toolCallId!);
        }
        j++;
      }

      // Check if all tool calls have results
      const allHaveResults = [...toolCallIds].every((id) => toolResultIds.has(id));

      if (allHaveResults) {
        // Include the assistant message and all its tool results
        result.push(msg);
        for (let k = i + 1; k < j; k++) {
          result.push(messages[k]);
        }
        i = j - 1; // Skip processed tool results
      } else {
        // Missing tool results - strip toolCalls from assistant message
        logDebugMessage('warn', 'Removing incomplete tool calls from conversation', {
          messageId: msg.id,
          toolCallIds: [...toolCallIds],
          toolResultIds: [...toolResultIds],
        });
        result.push({
          ...msg,
          toolCalls: undefined, // Remove tool calls that don't have results
        });
      }
    } else if (msg.role === 'tool') {
      // Tool messages are handled above with their assistant messages
      // If we get here, it's an orphan tool result - skip it
      logDebugMessage('warn', 'Skipping orphan tool result', { messageId: msg.id });
    } else {
      result.push(msg);
    }
  }

  return result;
}

/**
 * Check if a tool is allowed in the given mode
 */
function isToolAllowedInMode(toolName: string, mode: AgentMode): boolean {
  // Agent mode can use all tools
  if (mode === 'agent') return true;

  // Ask and Plan modes are read-only
  // Check core read-only tools
  if (isReadOnlyTool(toolName)) return true;

  // useExtraTool is always allowed (it just loads tools)
  if (toolName === 'useExtraTool') return true;

  // Check if it's an extra tool
  const extraToolName = getToolExtraTool(toolName);
  if (extraToolName) {
    const extraTool = EXTRA_TOOLS_REGISTRY[extraToolName];
    // Check if tool is in extra tool's readOnlyTools list
    return extraTool?.readOnlyTools?.includes(toolName) ?? false;
  }

  return false;
}

/**
 * Process tool calls by executing them and collecting results
 */
export async function processToolCalls(
  toolCalls: ToolCall[],
  planId: string,
  mode: AgentMode = 'agent',
): Promise<{ steps: ExecutionStep[]; affectedChatIds: string[] }> {
  const steps: ExecutionStep[] = [];
  const allAffectedChatIds: string[] = [];

  for (const toolCall of toolCalls) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments || '{}');
    } catch (parseError) {
      logDebugMessage('error', 'Agent: Failed to parse tool arguments', {
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        arguments: toolCall.function.arguments,
        error: parseError,
      });
      // Skip this tool call if args are invalid
      continue;
    }

    const toolName = toolCall.function.name;

    // Check if tool is allowed in this mode
    if (!isToolAllowedInMode(toolName, mode)) {
      const step: ExecutionStep = {
        id: toolCall.id || generateUniqueId(),
        toolCallId: toolCall.id,
        planId,
        tool: toolName,
        args,
        status: 'failed',
        timestamp: Date.now(),
        result: {
          success: false,
          error: `Tool "${toolName}" is not available in ${mode} mode. Only read-only operations are allowed.`,
        },
      };
      steps.push(step);
      continue;
    }

    const step: ExecutionStep = {
      id: toolCall.id || generateUniqueId(),
      toolCallId: toolCall.id,
      planId,
      tool: toolName,
      args,
      status: 'running',
      timestamp: Date.now(),
    };

    steps.push(step);

    try {
      const result = await executeTool(toolName, args);
      step.status = result.success ? 'completed' : 'failed';
      step.result = result;
      step.affectedChatIds = result.affectedChatIds;
      step.undoAction = buildUndoAction(toolName, args);

      if (result.affectedChatIds) {
        allAffectedChatIds.push(...result.affectedChatIds);
      }
    } catch (error) {
      step.status = 'failed';
      step.result = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  return { steps, affectedChatIds: [...new Set(allAffectedChatIds)] };
}
