import { getActions, getGlobal } from '../../../../global';

import type { ExtraTool, SkillType, ToolDefinition, ToolResult } from '../../types';

import {
  selectActiveSkills,
  selectTelebizSkillById,
  selectTelebizSkillsList,
} from '../../../global/selectors';

// Skills Tool Definitions
const getSkillData: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getSkillData',
    description: [
      'Get skill data that matches a context.',
      'Use this when you see a relevant skill context in the system prompt.',
      'Returns the full content for how to behave in that context.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        contextQuery: {
          type: 'string',
          description: 'The context to search for (e.g., "sending messages", "how are you")',
        },
      },
      required: ['contextQuery'],
    },
  },
};

const getAllSkillData: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getAllSkillData',
    description: [
      'Get all active skill data.',
      'Use this to get a complete view of all skill instructions.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {},
    },
  },
};

// Skill Management Tool Definitions
const listSkills: ToolDefinition = {
  type: 'function',
  function: {
    name: 'listSkills',
    description: [
      'List all skills with their details.',
      'Shows skill name, type (knowledge/tool/onDemand), context, and active status.',
      'Use this to see what skills exist before creating or updating.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        includeInactive: {
          type: 'boolean',
          description: 'Include inactive skills in the list (default: false)',
        },
      },
    },
  },
};

const createSkill: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createSkill',
    description: [
      'Create a new skill to teach the agent specific behaviors.',
      'Skills can be:',
      '- knowledge: Always applied to all responses (brand voice, company facts)',
      '- tool: Retrieved when context matches (customer support guidelines)',
      '- onDemand: Only used when user invokes /skill-name',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Unique skill name for /skill-name invocation (lowercase, hyphens allowed). Auto-generated from context if not provided.',
        },
        skillType: {
          type: 'string',
          enum: ['knowledge', 'tool', 'onDemand'],
          description: 'Type of skill: knowledge (always applied), tool (agent retrieves when needed), onDemand (user invokes with /name)',
        },
        context: {
          type: 'string',
          description: 'When or why to apply this skill (e.g., "When discussing pricing", "For customer support replies")',
        },
        content: {
          type: 'string',
          description: 'The actual instructions, knowledge, or guidelines the agent should follow',
        },
      },
      required: ['skillType', 'context', 'content'],
    },
  },
};

const updateSkill: ToolDefinition = {
  type: 'function',
  function: {
    name: 'updateSkill',
    description: [
      'Update an existing skill.',
      'Use listSkills first to find the skill ID.',
      'Only provide the fields you want to change.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        skillId: {
          type: 'string',
          description: 'The skill ID to update (from listSkills)',
        },
        name: {
          type: 'string',
          description: 'New skill name (optional)',
        },
        skillType: {
          type: 'string',
          enum: ['knowledge', 'tool', 'onDemand'],
          description: 'New skill type (optional)',
        },
        context: {
          type: 'string',
          description: 'New context description (optional)',
        },
        content: {
          type: 'string',
          description: 'New skill content/instructions (optional)',
        },
        isActive: {
          type: 'boolean',
          description: 'Enable or disable the skill (optional)',
        },
      },
      required: ['skillId'],
    },
  },
};

const deleteSkill: ToolDefinition = {
  type: 'function',
  function: {
    name: 'deleteSkill',
    description: [
      'Permanently delete a skill.',
      'Use listSkills first to find the skill ID.',
      'This action cannot be undone.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        skillId: {
          type: 'string',
          description: 'The skill ID to delete (from listSkills)',
        },
      },
      required: ['skillId'],
    },
  },
};

// Skills Extra Tool Definition
export const SKILLS_EXTRA_TOOL: ExtraTool = {
  name: 'skills',
  description: 'Access and manage user-created skills',
  tools: [getSkillData, getAllSkillData, listSkills, createSkill, updateSkill, deleteSkill],
  readOnlyTools: ['getSkillData', 'getAllSkillData', 'listSkills'],
  contextPrompt: `SKILLS EXTRA TOOL LOADED. You can access and manage user-created skills:

READ OPERATIONS:
- getSkillData: Get skill content for a specific context
- getAllSkillData: Get all skill data
- listSkills: List all skills with details (ID, name, type, context, status)

WRITE OPERATIONS:
- createSkill: Create a new skill (knowledge/tool/onDemand)
- updateSkill: Update an existing skill's content, type, or status
- deleteSkill: Permanently delete a skill

Skill types:
- knowledge: Always applied to all responses
- tool: Agent retrieves when context is relevant
- onDemand: Only when user types /skill-name`,
};

// Skills Tool Executors
export function executeSkillsTool(
  toolName: string,
  args: Record<string, unknown>,
): ToolResult {
  switch (toolName) {
    case 'getSkillData':
      return executeGetSkillData(args.contextQuery as string);
    case 'getAllSkillData':
      return executeGetAllSkillData();
    case 'listSkills':
      return executeListSkills(args.includeInactive as boolean | undefined);
    case 'createSkill':
      return executeCreateSkill(args);
    case 'updateSkill':
      return executeUpdateSkill(args);
    case 'deleteSkill':
      return executeDeleteSkill(args.skillId as string);
    default:
      return { success: false, error: `Unknown skills tool: ${toolName}` };
  }
}

/**
 * Tokenize text into words for matching
 */
function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

/**
 * Calculate match score between query and context
 * Returns a score from 0-100 based on word overlap
 */
function calculateMatchScore(query: string, context: string): number {
  const queryWords = tokenize(query);
  const contextWords = tokenize(context);

  if (queryWords.length === 0 || contextWords.length === 0) return 0;

  // Check for exact substring match (highest priority)
  if (context.toLowerCase().includes(query.toLowerCase())) {
    return 100;
  }

  // Count matching words (check if context words contain query words)
  const matchingWords = queryWords.filter((qWord) => contextWords.some((cWord) => cWord.includes(qWord)));

  // Calculate score based on percentage of query words matched
  const wordMatchScore = (matchingWords.length / queryWords.length) * 80;

  // Bonus for matching important keywords at the start
  const firstQueryWord = queryWords[0];
  const startsWithBonus = contextWords[0]?.includes(firstQueryWord) ? 10 : 0;

  return Math.min(100, wordMatchScore + startsWithBonus);
}

const MIN_MATCH_SCORE = 30;

function executeGetSkillData(contextQuery: string): ToolResult {
  const global = getGlobal();
  const skills = selectActiveSkills(global);

  if (skills.length === 0) {
    return {
      success: true,
      data: {
        message: 'No skill data available. Respond naturally.',
      },
    };
  }

  // Score all skills and filter by minimum threshold
  const scoredSkills = skills
    .map((item) => ({
      skill: item,
      score: calculateMatchScore(contextQuery, item.context),
    }))
    .filter((item) => item.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score);

  if (scoredSkills.length === 0) {
    return {
      success: true,
      data: {
        message: `No skill data matching "${contextQuery}". Respond naturally.`,
        availableContexts: skills.map((item) => item.context),
      },
    };
  }

  return {
    success: true,
    data: {
      matchingItems: scoredSkills.map((item) => ({
        context: item.skill.context,
        content: item.skill.content,
        matchScore: item.score,
      })),
      count: scoredSkills.length,
      note: 'Results sorted by relevance score (highest first)',
    },
  };
}

function executeGetAllSkillData(): ToolResult {
  const global = getGlobal();
  const skills = selectActiveSkills(global);

  if (skills.length === 0) {
    return {
      success: true,
      data: {
        message: 'No skill data available.',
        items: [],
      },
    };
  }

  return {
    success: true,
    data: {
      items: skills.map((item) => ({
        context: item.context,
        content: item.content,
      })),
      count: skills.length,
    },
  };
}

// Skill Management Executors

function executeListSkills(includeInactive?: boolean): ToolResult {
  const global = getGlobal();
  const allSkills = selectTelebizSkillsList(global);

  const skills = includeInactive
    ? allSkills
    : allSkills.filter((s) => s.isActive);

  if (skills.length === 0) {
    return {
      success: true,
      data: {
        message: includeInactive
          ? 'No skills exist yet.'
          : 'No active skills. Use includeInactive: true to see all.',
        skills: [],
      },
    };
  }

  return {
    success: true,
    data: {
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        skillType: s.skillType,
        context: s.context,
        contentPreview: s.content.length > 100 ? `${s.content.slice(0, 100)}...` : s.content,
        isActive: s.isActive,
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
      count: skills.length,
      totalCount: allSkills.length,
    },
  };
}

function executeCreateSkill(args: Record<string, unknown>): ToolResult {
  const { addSkill } = getActions();

  const skillType = args.skillType as SkillType;
  const context = args.context as string;
  const content = args.content as string;
  const name = args.name as string | undefined;

  if (!['knowledge', 'tool', 'onDemand'].includes(skillType)) {
    return {
      success: false,
      error: `Invalid skill type: ${skillType}. Must be "knowledge", "tool", or "onDemand".`,
    };
  }

  if (!context || context.trim().length === 0) {
    return { success: false, error: 'Context is required.' };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Content is required.' };
  }

  addSkill({
    name,
    skillType,
    context: context.trim(),
    content: content.trim(),
    isActive: true,
  });

  return {
    success: true,
    data: {
      created: true,
      skillType,
      context: context.trim(),
      name: name || '(auto-generated from context)',
      note: skillType === 'knowledge'
        ? 'This skill will now be applied to all responses.'
        : skillType === 'onDemand'
          ? `User can invoke this skill with /${name || 'auto-generated-name'}`
          : 'Agent will retrieve this when the context matches.',
    },
  };
}

function executeUpdateSkill(args: Record<string, unknown>): ToolResult {
  const { updateSkill: updateSkillAction } = getActions();

  const skillId = args.skillId as string;
  if (!skillId) {
    return { success: false, error: 'skillId is required.' };
  }

  const global = getGlobal();
  const existingSkill = selectTelebizSkillById(global, skillId);
  if (!existingSkill) {
    return { success: false, error: `Skill not found: ${skillId}` };
  }

  const updates: Record<string, unknown> = {};

  if (args.name !== undefined) {
    updates.name = args.name;
  }
  if (args.skillType !== undefined) {
    const skillType = args.skillType as string;
    if (!['knowledge', 'tool', 'onDemand'].includes(skillType)) {
      return {
        success: false,
        error: `Invalid skill type: ${skillType}. Must be "knowledge", "tool", or "onDemand".`,
      };
    }
    updates.skillType = skillType;
  }
  if (args.context !== undefined) {
    updates.context = (args.context as string).trim();
  }
  if (args.content !== undefined) {
    updates.content = (args.content as string).trim();
  }
  if (args.isActive !== undefined) {
    updates.isActive = args.isActive;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No updates provided.' };
  }

  updateSkillAction({ id: skillId, updates });

  return {
    success: true,
    data: {
      updated: true,
      skillId,
      previousName: existingSkill.name,
      changes: Object.keys(updates),
    },
  };
}

function executeDeleteSkill(skillId: string): ToolResult {
  const { deleteSkill: deleteSkillAction } = getActions();

  if (!skillId) {
    return { success: false, error: 'skillId is required.' };
  }

  const global = getGlobal();
  const existingSkill = selectTelebizSkillById(global, skillId);
  if (!existingSkill) {
    return { success: false, error: `Skill not found: ${skillId}` };
  }

  deleteSkillAction({ id: skillId });

  return {
    success: true,
    data: {
      deleted: true,
      skillId,
      deletedSkill: {
        name: existingSkill.name,
        skillType: existingSkill.skillType,
        context: existingSkill.context,
      },
    },
  };
}
