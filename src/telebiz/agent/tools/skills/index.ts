import type { ExtraTool, ExtraToolName, LoadedExtraTool, ToolDefinition, ToolResult } from '../../types';

import { BULK_EXTRA_TOOL, executeBulkTool } from './bulk';
import { CRM_EXTRA_TOOL, executeCrmTool } from './crm';
import { executeNotionTool, NOTION_EXTRA_TOOL } from './notion';
import { executeRemindersTool, REMINDERS_EXTRA_TOOL } from './reminders';
import { executeSkillsTool, SKILLS_EXTRA_TOOL } from './skills';

/**
 * Extra Tools Registry - Maps extra tool names to their definitions
 */
export const EXTRA_TOOLS_REGISTRY: Record<ExtraToolName, ExtraTool> = {
  crm: CRM_EXTRA_TOOL,
  notion: NOTION_EXTRA_TOOL,
  reminders: REMINDERS_EXTRA_TOOL,
  bulk: BULK_EXTRA_TOOL,
  skills: SKILLS_EXTRA_TOOL,
};

/**
 * Get all available extra tool names and descriptions
 */
export function getAvailableExtraTools(): Array<{ name: ExtraToolName; description: string }> {
  return Object.entries(EXTRA_TOOLS_REGISTRY).map(([name, extraTool]) => ({
    name: name as ExtraToolName,
    description: extraTool.description,
  }));
}

/**
 * Get an extra tool by name
 */
export function getExtraTool(name: ExtraToolName): ExtraTool {
  return EXTRA_TOOLS_REGISTRY[name];
}

/**
 * Get tools for a specific extra tool
 */
export function getExtraToolTools(name: ExtraToolName): ToolDefinition[] {
  return EXTRA_TOOLS_REGISTRY[name]?.tools || [];
}

/**
 * Get context prompt for a loaded extra tool
 */
export function getExtraToolContext(name: ExtraToolName): string {
  return EXTRA_TOOLS_REGISTRY[name]?.contextPrompt || '';
}

/**
 * Check if a tool belongs to an extra tool
 */
export function getToolExtraTool(toolName: string) {
  for (const [extraToolName, extraTool] of Object.entries(EXTRA_TOOLS_REGISTRY)) {
    if (extraTool.tools.some((t) => t.function.name === toolName)) {
      return extraToolName as ExtraToolName;
    }
  }
  return undefined;
}

/**
 * Execute an extra tool
 */
export async function executeExtraToolTool(
  extraToolName: ExtraToolName,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (extraToolName) {
    case 'crm':
      return executeCrmTool(toolName, args);
    case 'notion':
      return executeNotionTool(toolName, args);
    case 'reminders':
      return executeRemindersTool(toolName, args);
    case 'bulk':
      return executeBulkTool(toolName, args);
    case 'skills':
      return executeSkillsTool(toolName, args);
    default: {
      const unknownExtraTool: string = extraToolName;
      return { success: false, error: `Unknown extra tool: ${unknownExtraTool}` };
    }
  }
}

/**
 * Build extra tools summary for system prompt
 */
export function buildExtraToolsSummary(): string {
  const extraTools = getAvailableExtraTools();
  return extraTools.map((s) => `- "${s.name}" - ${s.description}`).join('\n');
}

/**
 * Create a loaded extra tool record
 */
export function createLoadedExtraTool(name: ExtraToolName): LoadedExtraTool {
  return {
    name,
    loadedAt: Date.now(),
  };
}

export { CRM_EXTRA_TOOL, executeCrmTool } from './crm';
export { executeNotionTool, NOTION_EXTRA_TOOL } from './notion';
export { executeRemindersTool, REMINDERS_EXTRA_TOOL } from './reminders';
export { BULK_EXTRA_TOOL, executeBulkTool } from './bulk';
export { executeSkillsTool, SKILLS_EXTRA_TOOL } from './skills';
