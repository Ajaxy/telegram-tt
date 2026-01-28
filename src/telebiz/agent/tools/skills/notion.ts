import { getActions, getGlobal } from '../../../../global';

import type { NotionBlock, Property, ProviderPage } from '../../../services/types';
import type { ExtraTool, ToolDefinition, ToolResult } from '../../types';
import { ProviderEntityType } from '../../../services/types';

import { selectTelebizEntity, selectTelebizProperties } from '../../../global/selectors';
import { convertFormFieldsToNotionProperties, decodeEntityId } from '../../../util/notion';
import { createAndLinkEntity, createChildEntity, getEntityFromState, validateRequiredParams } from './shared';

// Notion Tool Definitions
const getNotionProperties: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getNotionProperties',
    description: [
      'Get available properties for Notion databases and their valid options.',
      'Pass pageId to get properties for that specific page\'s database.',
      'Use BEFORE updateNotionPageProperty to know what properties exist and valid values.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID',
        },
        pageId: {
          type: 'string',
          description: 'Optional: Page ID to get properties for its specific database',
        },
      },
      required: ['integrationId'],
    },
  },
};

const getNotionPageContent: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getNotionPageContent',
    description: [
      'Get the content of a Notion page including its blocks (text, todos, headings).',
      'Returns the page properties and all block content.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID',
        },
        pageId: {
          type: 'string',
          description: 'The Notion page ID',
        },
      },
      required: ['integrationId', 'pageId'],
    },
  },
};

const updateNotionBlock: ToolDefinition = {
  type: 'function',
  function: {
    name: 'updateNotionBlock',
    description: [
      'Update the content of a Notion block.',
      'Can update text content in paragraphs, headings, and other text blocks.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID',
        },
        pageId: {
          type: 'string',
          description: 'The Notion page ID containing the block',
        },
        blockId: {
          type: 'string',
          description: 'The block ID to update',
        },
        content: {
          type: 'string',
          description: 'The new text content for the block',
        },
      },
      required: ['integrationId', 'pageId', 'blockId', 'content'],
    },
  },
};

const toggleNotionTodo: ToolDefinition = {
  type: 'function',
  function: {
    name: 'toggleNotionTodo',
    description: 'Toggle the checked state of a Notion to-do block.',
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID',
        },
        pageId: {
          type: 'string',
          description: 'The Notion page ID containing the todo',
        },
        blockId: {
          type: 'string',
          description: 'The to-do block ID',
        },
        checked: {
          type: 'boolean',
          description: 'Whether the todo should be checked (true) or unchecked (false)',
        },
      },
      required: ['integrationId', 'pageId', 'blockId', 'checked'],
    },
  },
};

const updateNotionPageProperty: ToolDefinition = {
  type: 'function',
  function: {
    name: 'updateNotionPageProperty',
    description: [
      'Update a property on a Notion page (e.g., priority, status, title, dates).',
      'Use getNotionPageContent first to see available properties and their current values.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID',
        },
        pageId: {
          type: 'string',
          description: 'The Notion page ID',
        },
        propertyName: {
          type: 'string',
          description: 'The property name to update (e.g., "priority", "status", "title")',
        },
        value: {
          type: 'string',
          description: 'The new value for the property',
        },
      },
      required: ['integrationId', 'pageId', 'propertyName', 'value'],
    },
  },
};

const addNoteToPage: ToolDefinition = {
  type: 'function',
  function: {
    name: 'addNoteToPage',
    description: [
      'Add a note/comment to a Notion page.',
      'Use this for conversation summaries, activity logs, or important updates.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID (required)',
        },
        pageId: {
          type: 'string',
          description: 'The Notion page ID to add the note to (required)',
        },
        noteContent: {
          type: 'string',
          description: 'The note content (required, cannot be empty)',
        },
      },
      required: ['integrationId', 'pageId', 'noteContent'],
    },
  },
};

const createNotionPage: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createNotionPage',
    description: [
      'Create a new Notion page and link it to a Telegram chat.',
      'Use getCurrentChat to get the chatId first.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The Notion integration ID (required)',
        },
        chatId: {
          type: 'string',
          description: 'Telegram chat ID to link the page to (required)',
        },
        title: {
          type: 'string',
          description: 'The page title (required, cannot be empty)',
        },
        parentPageId: {
          type: 'string',
          description: 'Parent page ID to create under (optional)',
        },
      },
      required: ['integrationId', 'chatId', 'title'],
    },
  },
};

// Notion Extra Tool Definition
export const NOTION_EXTRA_TOOL: ExtraTool = {
  name: 'notion',
  description: 'Notion page operations - read/update properties, blocks, todos, notes',
  tools: [
    getNotionProperties,
    getNotionPageContent,
    updateNotionPageProperty,
    updateNotionBlock,
    toggleNotionTodo,
    addNoteToPage,
    createNotionPage,
  ],
  readOnlyTools: ['getNotionProperties', 'getNotionPageContent'],
  contextPrompt: `NOTION SKILL LOADED. You can now:
- Get property schema with getNotionProperties (shows available properties + valid options for select/status)
- Get page content with getNotionPageContent (shows current property values and blocks)
- Update page properties (priority, status, etc.) with updateNotionPageProperty
- Update block text with updateNotionBlock
- Toggle todo items with toggleNotionTodo
- Add notes/comments to a page with addNoteToPage (noteContent required)
- Create new pages with createNotionPage (chatId and title required)

REQUIRED FIELDS:
- addNoteToPage: noteContent cannot be empty
- createNotionPage: title cannot be empty

WORKFLOW for updating properties:
1. getNotionProperties → see available properties and valid options
2. getNotionPageContent → see current values
3. updateNotionPageProperty → update with a valid value

Block types: paragraph, heading_1, heading_2, heading_3, to_do, bulleted_list_item, numbered_list_item`,
};

// Notion Tool Executors
export async function executeNotionTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'getNotionProperties':
      return executeGetNotionProperties(args.integrationId as number, args.pageId as string | undefined);
    case 'getNotionPageContent':
      return executeGetNotionPageContent(
        args.integrationId as number,
        args.pageId as string,
      );
    case 'updateNotionPageProperty':
      return executeUpdateNotionPageProperty(
        args.integrationId as number,
        args.pageId as string,
        args.propertyName as string,
        args.value as string,
      );
    case 'updateNotionBlock':
      return executeUpdateNotionBlock(
        args.integrationId as number,
        args.pageId as string,
        args.blockId as string,
        args.content as string,
      );
    case 'toggleNotionTodo':
      return executeToggleNotionTodo(
        args.integrationId as number,
        args.pageId as string,
        args.blockId as string,
        args.checked as boolean,
      );
    case 'addNoteToPage':
      return executeAddNoteToPage(
        args.integrationId as number,
        args.pageId as string,
        args.noteContent as string,
      );
    case 'createNotionPage':
      return executeCreateNotionPage(args);
    default:
      return { success: false, error: `Unknown Notion tool: ${toolName}` };
  }
}

function executeGetNotionProperties(integrationId: number, pageId?: string): ToolResult {
  const { loadTelebizProviderProperties } = getActions();
  const global = getGlobal();

  const allProperties = selectTelebizProperties(global, integrationId);

  if (!allProperties || allProperties.length === 0) {
    loadTelebizProviderProperties({ integrationId });
    return {
      success: true,
      data: {
        status: 'loading',
        message: 'Loading properties schema. Retry in a moment.',
      },
    };
  }

  // If pageId provided, get properties for that specific database
  let targetDatabaseId: string | undefined;
  if (pageId) {
    const [, databaseId] = decodeEntityId(pageId);
    targetDatabaseId = databaseId;
  }

  // Summarize all databases and their properties
  const databases = allProperties.map((db) => {
    const props = db.properties.map((prop: Property) => {
      const summary: Record<string, unknown> = {
        name: prop.name,
        label: prop.label,
        type: prop.fieldType || prop.type,
      };

      if (prop.options && Array.isArray(prop.options)) {
        summary.options = prop.options.map((opt) => opt.label);
      }

      return summary;
    });

    return {
      databaseId: db.id,
      databaseLabel: db.label,
      properties: props,
    };
  });

  // If we have a target database, highlight it
  if (targetDatabaseId) {
    const targetDb = databases.find((db) => db.databaseId === targetDatabaseId);
    if (targetDb) {
      return {
        success: true,
        data: {
          pageDatabase: targetDb,
          allDatabases: databases.map((db) => ({ id: db.databaseId, label: db.databaseLabel })),
        },
      };
    }
  }

  return {
    success: true,
    data: {
      databases,
      message: 'Use getNotionPageContent to get a page, then check properties for that specific database.',
    },
  };
}

function executeGetNotionPageContent(
  integrationId: number,
  pageId: string,
): ToolResult {
  const { entity, loadingResult } = getEntityFromState(integrationId, ProviderEntityType.Page, pageId);

  if (loadingResult) return loadingResult;

  const page = entity as ProviderPage;

  return {
    success: true,
    data: {
      id: page.id,
      url: page.url,
      title: getPageTitle(page),
      archived: page.archived,
      properties: summarizeProperties(page),
      blocks: (page.blocks || []).map(summarizeBlock),
    },
  };
}

function executeUpdateNotionPageProperty(
  integrationId: number,
  pageId: string,
  propertyName: string,
  value: string,
): ToolResult {
  const { updateTelebizEntity, loadTelebizProviderProperties } = getActions();
  const global = getGlobal();

  // 1. Get the page to find its database ID
  const page = selectTelebizEntity(global, integrationId, ProviderEntityType.Page, pageId) as ProviderPage;
  if (!page) {
    return { success: false, error: 'Page not loaded. Use getNotionPageContent first.' };
  }

  // 2. Decode pageId to get databaseId (format: entityId::databaseId)
  const [, databaseId] = decodeEntityId(pageId);
  if (!databaseId) {
    return { success: false, error: 'Could not determine database ID from page ID.' };
  }

  // 3. Get properties schema for this database
  const allProperties = selectTelebizProperties(global, integrationId);
  if (!allProperties || allProperties.length === 0) {
    loadTelebizProviderProperties({ integrationId });
    return {
      success: true,
      data: {
        status: 'loading',
        message: 'Loading properties schema. Retry in a moment.',
      },
    };
  }

  const database = allProperties.find((et) => et.id === databaseId);
  if (!database) {
    return {
      success: false,
      error: `Database "${databaseId}" not found. Available: ${allProperties.map((p) => p.id).join(', ')}`,
    };
  }

  // 4. Find the property definition
  const propDef = database.properties.find(
    (p: Property) => p.name.toLowerCase() === propertyName.toLowerCase()
      || p.label.toLowerCase() === propertyName.toLowerCase(),
  );
  if (!propDef) {
    const available = database.properties.map((p: Property) => p.name).join(', ');
    return {
      success: false,
      error: `Property "${propertyName}" not found. Available: ${available}`,
    };
  }

  // 5. For select/status fields, find the option ID from the value
  let optionId = value;
  if (propDef.options && Array.isArray(propDef.options)) {
    const option = propDef.options.find(
      (opt) => opt.label.toLowerCase() === value.toLowerCase()
        || opt.value.toLowerCase() === value.toLowerCase(),
    );
    if (option) {
      optionId = option.value;
    } else {
      const validOptions = propDef.options.map((o) => o.label).join(', ');
      return {
        success: false,
        error: `Invalid value "${value}" for ${propDef.name}. Valid options: ${validOptions}`,
      };
    }
  }

  // 6. Convert to Notion format using the utility
  const formField = { name: propDef.name, value: optionId };
  const payload = convertFormFieldsToNotionProperties(
    { [propDef.name]: formField } as any,
    database.properties,
  );

  // 7. Update the entity
  updateTelebizEntity({
    integrationId,
    entityType: ProviderEntityType.Page,
    entityId: pageId,
    data: { properties: payload },
  });

  return {
    success: true,
    data: {
      updated: true,
      pageId,
      property: propDef.name,
      value,
      message: `Updated ${propDef.name} to "${value}"`,
    },
  };
}

function executeUpdateNotionBlock(
  integrationId: number,
  pageId: string,
  blockId: string,
  content: string,
): ToolResult {
  const { updateTelebizNotionBlock } = getActions();

  // Determine block type and build update data
  const global = getGlobal();
  const entity = selectTelebizEntity(global, integrationId, ProviderEntityType.Page, pageId);

  if (!entity) {
    return { success: false, error: 'Page not loaded. Use getNotionPageContent first.' };
  }

  const page = entity as ProviderPage;
  const block = page.blocks?.find((b) => b.id === blockId);

  if (!block) {
    return { success: false, error: `Block not found: ${blockId}` };
  }

  // Build rich_text update based on block type
  const richText = [{
    type: 'text',
    text: { content },
    plain_text: content,
  }];

  const blockData: Record<string, unknown> = {};
  blockData[block.type] = { rich_text: richText };

  updateTelebizNotionBlock({
    integrationId,
    pageId,
    blockId,
    blockData,
  });

  return {
    success: true,
    data: { updated: true, blockId, content },
  };
}

function executeToggleNotionTodo(
  integrationId: number,
  pageId: string,
  blockId: string,
  checked: boolean,
): ToolResult {
  const { updateTelebizNotionBlock } = getActions();

  updateTelebizNotionBlock({
    integrationId,
    pageId,
    blockId,
    blockData: {
      to_do: { checked },
    },
  });

  return {
    success: true,
    data: { updated: true, blockId, checked },
  };
}

async function executeAddNoteToPage(
  integrationId: number,
  pageId: string,
  noteContent: string,
): Promise<ToolResult> {
  // Create a Note entity associated with the Notion page
  return createChildEntity(integrationId, ProviderEntityType.Note, {
    body: noteContent,
    parentEntityId: pageId,
    parentEntityType: ProviderEntityType.Page,
  });
}

async function executeCreateNotionPage(args: Record<string, unknown>): Promise<ToolResult> {
  const validationError = validateRequiredParams([
    { name: 'integrationId', value: args.integrationId },
    { name: 'chatId', value: args.chatId },
    { name: 'title', value: args.title, nonEmpty: true },
  ]);
  if (validationError) return validationError;

  // Per forms.ts: Page uses 'title' field
  return createAndLinkEntity(
    args.integrationId as number,
    args.chatId as string,
    ProviderEntityType.Page,
    {
      title: args.title as string,
      parentEntityId: args.parentPageId as string | undefined,
      parentEntityType: ProviderEntityType.Page,
    },
  );
}

// Helper to get page title from properties
function getPageTitle(page: ProviderPage): string {
  const titleProp = page.properties?.title || page.properties?.Name;
  if (titleProp?.title) {
    return (titleProp.title as Array<{ plain_text: string }>)
      .map((t) => t.plain_text)
      .join('');
  }
  return 'Untitled';
}

// Helper to summarize page properties for the agent
function summarizeProperties(page: ProviderPage): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const props = page.properties || {};

  Object.entries(props).forEach(([name, prop]) => {
    const type = prop.type;
    // Extract value based on property type
    switch (type) {
      case 'title':
        result[name] = (prop.title as Array<{ plain_text: string }>)?.map((t) => t.plain_text).join('') || '';
        break;
      case 'rich_text':
        result[name] = (prop.rich_text as Array<{ plain_text: string }>)?.map((t) => t.plain_text).join('') || '';
        break;
      case 'select':
        result[name] = prop.select?.name || undefined;
        break;
      case 'multi_select':
        result[name] = (prop.multi_select as Array<{ name: string }>)?.map((s) => s.name) || [];
        break;
      case 'status':
        result[name] = prop.status?.name || undefined;
        break;
      case 'date':
        result[name] = prop.date?.start || undefined;
        break;
      case 'checkbox':
        result[name] = prop.checkbox || false;
        break;
      case 'number':
        result[name] = prop.number;
        break;
      case 'url':
        result[name] = prop.url || undefined;
        break;
      case 'email':
        result[name] = prop.email || undefined;
        break;
      case 'phone_number':
        result[name] = prop.phone_number || undefined;
        break;
      default:
        // For other types, just indicate the type exists
        result[name] = `[${type}]`;
    }
  });

  return result;
}

// Helper to summarize a block for LLM
function summarizeBlock(block: NotionBlock): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    id: block.id,
    type: block.type,
  };

  // Extract text content based on block type
  const blockContent = block[block.type];
  if (blockContent?.rich_text) {
    summary.text = (blockContent.rich_text as Array<{ plain_text: string }>)
      .map((t) => t.plain_text)
      .join('');
  }

  // Add todo-specific info
  if (block.type === 'to_do' && blockContent) {
    summary.checked = blockContent.checked;
  }

  return summary;
}
