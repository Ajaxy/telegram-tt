import { getActions, getGlobal } from '../../../../global';

import type { ProviderDeal } from '../../../services/types';
import type { ExtraTool, ToolDefinition, ToolResult } from '../../types';
import { ProviderEntityType } from '../../../services/types';

import { selectTelebizIntegrationsList, selectTelebizProperties } from '../../../global/selectors';
import {
  associateEntities as associateEntitiesShared,
  createAndLinkEntity,
  createChildEntity,
  getEntityFromState,
  linkEntityToChat as linkEntityToChatShared,
  searchEntities as searchEntitiesShared,
  updateEntityField as updateEntityFieldShared,
  validateRequiredParams,
} from './shared';

// CRM Tool Definitions
const getEntityDetails: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getEntityDetails',
    description: [
      'Get full details of a CRM entity (contact, deal, organization).',
      'Requires integrationId, entityType, and entityId.',
      'Returns all entity fields, associations, and metadata.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (from getChatRelationship or listIntegrations)',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'organization'],
          description: 'The type of entity',
        },
        entityId: {
          type: 'string',
          description: 'The entity ID',
        },
      },
      required: ['integrationId', 'entityType', 'entityId'],
    },
  },
};

const updateDealStage: ToolDefinition = {
  type: 'function',
  function: {
    name: 'updateDealStage',
    description: [
      'Update the pipeline stage of a deal in the CRM.',
      'Use getEntityProperties first to get available stages.',
      'Returns the updated deal.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID',
        },
        dealId: {
          type: 'string',
          description: 'The deal ID to update',
        },
        stage: {
          type: 'string',
          description: 'The new stage ID (from getEntityProperties with propertyName="stage")',
        },
      },
      required: ['integrationId', 'dealId', 'stage'],
    },
  },
};

const updateEntityField: ToolDefinition = {
  type: 'function',
  function: {
    name: 'updateEntityField',
    description: [
      'Update a property/field value on a CRM entity (name, email, phone, amount, etc.).',
      'IMPORTANT: This is for updating field VALUES only.',
      'Do NOT use this for associations/relationships between entities - use associateEntities instead.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (required)',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'company'],
          description: 'The type of entity (required)',
        },
        entityId: {
          type: 'string',
          description: 'The entity ID (required)',
        },
        field: {
          type: 'string',
          description: 'The field name to update, e.g. name, email, phone, amount (required)',
        },
        value: {
          type: 'string',
          description: 'The new value for the field (required)',
        },
      },
      required: ['integrationId', 'entityType', 'entityId', 'field', 'value'],
    },
  },
};

const createDeal: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createDeal',
    description: [
      'Create a new deal in the CRM and link it to a Telegram chat.',
      'PREFERRED for group chats and business opportunities.',
      'Use getEntityProperties first to get valid pipelineId and stage values.',
      'The chatId is required to link the deal to the Telegram chat.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID from listIntegrations (required)',
        },
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID from getCurrentChat (required)',
        },
        title: {
          type: 'string',
          description: 'The deal title/name (required, cannot be empty)',
        },
        pipelineId: {
          type: 'string',
          description: 'The pipeline ID from getEntityProperties with propertyName="pipeline" (required)',
        },
        stage: {
          type: 'string',
          description: 'The initial stage ID from getEntityProperties with propertyName="stage" (required)',
        },
        amount: {
          type: 'number',
          description: 'Deal amount (optional)',
        },
      },
      required: ['integrationId', 'chatId', 'title', 'pipelineId', 'stage'],
    },
  },
};

const createContact: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createContact',
    description: [
      'Create a new contact in the CRM and link it to a Telegram chat.',
      'Best for private/direct chats with individuals.',
      'For group chats, prefer createDeal instead.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (required)',
        },
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID to link the contact to (required)',
        },
        name: {
          type: 'string',
          description: 'Contact full name (required, cannot be empty)',
        },
        email: {
          type: 'string',
          description: 'Contact email (optional)',
        },
        phone: {
          type: 'string',
          description: 'Contact phone number (optional)',
        },
      },
      required: ['integrationId', 'chatId', 'name'],
    },
  },
};

const createCompany: ToolDefinition = {
  type: 'function',
  function: {
    name: 'createCompany',
    description: [
      'Create a new company/organization in the CRM and link it to a Telegram chat.',
      'Best for group chats representing a company or organization.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (required)',
        },
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID to link the company to (required)',
        },
        name: {
          type: 'string',
          description: 'Company name (required, cannot be empty)',
        },
        website: {
          type: 'string',
          description: 'Company website URL (optional)',
        },
        industry: {
          type: 'string',
          description: 'Company industry (optional)',
        },
        type: {
          type: 'string',
          description: 'Company type (optional)',
        },
      },
      required: ['integrationId', 'chatId', 'name'],
    },
  },
};

const linkEntityToChat: ToolDefinition = {
  type: 'function',
  function: {
    name: 'linkEntityToChat',
    description: [
      'Link an EXISTING CRM entity to a Telegram chat.',
      'The entity must already exist in the CRM.',
      'If this fails, report the error to the user - do NOT automatically create a new entity instead.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (required)',
        },
        chatId: {
          type: 'string',
          description: 'The Telegram chat ID (required)',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'company'],
          description: 'The type of entity to link (required)',
        },
        entityId: {
          type: 'string',
          description: 'The entity ID to link (required)',
        },
      },
      required: ['integrationId', 'chatId', 'entityType', 'entityId'],
    },
  },
};

const associateEntities: ToolDefinition = {
  type: 'function',
  function: {
    name: 'associateEntities',
    description: [
      'Link an EXISTING CRM entity to another EXISTING entity.',
      'Use this to connect a company to a contact, company to a deal, contact to a deal, etc.',
      'Both entities must already exist in the CRM - this does NOT create new entities.',
      'If this fails, report the error - do NOT create new entities as a workaround.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (required)',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'company'],
          description: 'The type of the entity to link (required)',
        },
        entityId: {
          type: 'string',
          description: 'The ID of the entity to link (required)',
        },
        associatedEntityType: {
          type: 'string',
          enum: ['contact', 'deal', 'company'],
          description: 'The type of the parent/target entity (required)',
        },
        associatedEntityId: {
          type: 'string',
          description: 'The ID of the parent/target entity (required)',
        },
      },
      required: ['integrationId', 'entityType', 'entityId', 'associatedEntityType', 'associatedEntityId'],
    },
  },
};

const searchEntities: ToolDefinition = {
  type: 'function',
  function: {
    name: 'searchEntities',
    description: 'Search for entities in the CRM by name or other criteria.',
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'organization'],
          description: 'The type of entity to search',
        },
        searchTerm: {
          type: 'string',
          description: 'The search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
      },
      required: ['integrationId', 'entityType', 'searchTerm'],
    },
  },
};

const addNoteToEntity: ToolDefinition = {
  type: 'function',
  function: {
    name: 'addNoteToEntity',
    description: [
      'Add a note/comment to a CRM entity (contact, deal, or organization).',
      'Creates a Note engagement associated with the entity.',
      'Use for conversation summaries, activity logs, or important updates.',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID (required)',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'organization', 'company'],
          description: 'The parent entity type to attach note to (required)',
        },
        entityId: {
          type: 'string',
          description: 'The parent entity ID (required)',
        },
        noteContent: {
          type: 'string',
          description: 'The note content (required, cannot be empty)',
        },
      },
      required: ['integrationId', 'entityType', 'entityId', 'noteContent'],
    },
  },
};

const getEntityProperties: ToolDefinition = {
  type: 'function',
  function: {
    name: 'getEntityProperties',
    description: [
      'Get available properties and their options for a CRM entity type.',
      'Use this to find valid values for creating or updating entities.',
      'Standard property names (standardName) include:',
      '- Deal: pipeline, stage (stage depends on pipeline)',
      '- Contact: lifecyclestage, email, phone, name',
      '- Company: lifecyclestage, industry, type, name',
    ].join('\n'),
    parameters: {
      type: 'object',
      properties: {
        integrationId: {
          type: 'number',
          description: 'The integration ID',
        },
        entityType: {
          type: 'string',
          enum: ['contact', 'deal', 'company'],
          description: 'The entity type to get properties for',
        },
        propertyName: {
          type: 'string',
          description: 'Optional: specific property standardName to get options for '
            + '(e.g., "lifecyclestage", "pipeline", "stage")',
        },
      },
      required: ['integrationId', 'entityType'],
    },
  },
};

const listIntegrations: ToolDefinition = {
  type: 'function',
  function: {
    name: 'listIntegrations',
    description: 'Get all connected CRM integrations (HubSpot, Pipedrive, etc.)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
};

// CRM Extra Tool Definition
export const CRM_EXTRA_TOOL: ExtraTool = {
  name: 'crm',
  description: 'HubSpot/CRM operations - manage deals, contacts, companies, stages, notes, and entity linking',
  tools: [
    getEntityDetails,
    updateDealStage,
    updateEntityField,
    addNoteToEntity,
    createDeal,
    createContact,
    createCompany,
    linkEntityToChat,
    associateEntities,
    searchEntities,
    getEntityProperties,
    listIntegrations,
  ],
  readOnlyTools: [
    'getEntityDetails',
    'searchEntities',
    'getEntityProperties',
    'listIntegrations',
  ],
  contextPrompt: `CRM SKILL LOADED.

IMPORTANT RULES:
- If link/associate FAILS, report the error - do NOT create a new entity as workaround
- Only create new entities when explicitly asked to create something new
- Linking and creating are DIFFERENT operations - respect what the user asked for

PROPERTIES SYSTEM:
- Use getEntityProperties to discover available properties and their valid options
- Properties have a "standardName" for consistent access across CRM providers:
  - Deal: "pipeline", "stage" (stage options depend on pipeline value)
  - Contact: "lifecyclestage", "email", "phone", "name"
  - Company: "lifecyclestage", "industry", "type", "name"
- Always use getEntityProperties before creating/updating entities with select fields

CREATING ENTITIES (creates NEW + links to Telegram chat):
- createDeal: Creates new deal and links to current chat (NEEDS chatId, title, pipelineId, stage)
- createContact: Creates new contact and links to current chat (NEEDS chatId, name)
- createCompany: Creates new company and links to current chat (NEEDS chatId, name)

LINKING/ASSOCIATING EXISTING ENTITIES:
- linkEntityToChat: Link EXISTING entity to Telegram chat
- associateEntities: Links TWO EXISTING entities together (company→contact, company→deal, contact→deal)
- NEVER use updateEntityField for associations - it will fail!

UPDATING ENTITY FIELDS:
- updateEntityField: Updates property VALUES only (name, email, phone, amount, lifecyclestage, etc.)
- updateDealStage: Updates deal pipeline stage

WORKFLOW:
1. listIntegrations → get integrationId
2. getCurrentChat → get chatId (needed for create/link operations)
3. getEntityProperties → discover valid property values (pipeline/stage for deals, lifecyclestage for others)
4. Create, link, or associate as needed based on user request`,
};

// CRM Tool Executors
export async function executeCrmTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (toolName) {
    case 'getEntityDetails':
      return executeGetEntityDetails(
        args.integrationId as number,
        args.entityType as ProviderEntityType,
        args.entityId as string,
      );
    case 'updateDealStage':
      return executeUpdateDealStage(
        args.integrationId as number,
        args.dealId as string,
        args.stage as string,
      );
    case 'updateEntityField':
      return executeUpdateEntityField(
        args.integrationId as number,
        args.entityType as ProviderEntityType,
        args.entityId as string,
        args.field as string,
        args.value as string,
      );
    case 'addNoteToEntity':
      return executeAddNoteToEntity(
        args.integrationId as number,
        args.entityType as ProviderEntityType,
        args.entityId as string,
        args.noteContent as string,
      );
    case 'createDeal':
      return executeCreateDeal(args);
    case 'createContact':
      return executeCreateContact(args);
    case 'createCompany':
      return executeCreateCompany(args);
    case 'linkEntityToChat':
      return executeLinkEntityToChat(args);
    case 'associateEntities':
      return executeAssociateEntities(args);
    case 'searchEntities':
      return executeSearchEntities(args);
    case 'getEntityProperties':
      return executeGetEntityProperties(
        args.integrationId as number,
        args.entityType as ProviderEntityType,
        args.propertyName as string | undefined,
      );
    case 'listIntegrations':
      return executeListIntegrations();
    default:
      return { success: false, error: `Unknown CRM tool: ${toolName}` };
  }
}

function executeGetEntityDetails(
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
): ToolResult {
  const { entity, loadingResult } = getEntityFromState(integrationId, entityType, entityId);

  if (loadingResult) return loadingResult;

  return {
    success: true,
    data: summarizeEntity(entity!, entityType),
  };
}

async function executeUpdateDealStage(
  integrationId: number,
  dealId: string,
  stage: string,
): Promise<ToolResult> {
  return updateEntityFieldShared(integrationId, ProviderEntityType.Deal, dealId, { stage });
}

async function executeUpdateEntityField(
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
  field: string,
  value: string,
): Promise<ToolResult> {
  return updateEntityFieldShared(integrationId, entityType, entityId, { [field]: value });
}

async function executeAddNoteToEntity(
  integrationId: number,
  parentEntityType: ProviderEntityType,
  parentEntityId: string,
  noteContent: string,
): Promise<ToolResult> {
  // Notes are child entities - created and associated with parent, not linked to chat
  return createChildEntity(integrationId, ProviderEntityType.Note, {
    body: noteContent,
    parentEntityId,
    parentEntityType,
  });
}

async function executeCreateDeal(args: Record<string, unknown>): Promise<ToolResult> {
  const validationError = validateRequiredParams([
    { name: 'integrationId', value: args.integrationId },
    { name: 'chatId', value: args.chatId },
    { name: 'title', value: args.title, nonEmpty: true },
    { name: 'pipelineId', value: args.pipelineId },
    { name: 'stage', value: args.stage },
  ]);
  if (validationError) return validationError;

  // Per forms.ts: Deal uses 'title', 'amount', 'closeDate' plus pipeline fields
  return createAndLinkEntity(
    args.integrationId as number,
    args.chatId as string,
    ProviderEntityType.Deal,
    {
      title: args.title as string,
      amount: args.amount as number | undefined,
      closeDate: args.closeDate as string | undefined,
      pipelineId: args.pipelineId as string,
      stage: args.stage as string,
    },
  );
}

async function executeCreateContact(args: Record<string, unknown>): Promise<ToolResult> {
  const validationError = validateRequiredParams([
    { name: 'integrationId', value: args.integrationId },
    { name: 'chatId', value: args.chatId },
    { name: 'name', value: args.name, nonEmpty: true },
  ]);
  if (validationError) return validationError;

  // Per forms.ts: Contact uses 'name', 'phone', 'email' fields
  return createAndLinkEntity(
    args.integrationId as number,
    args.chatId as string,
    ProviderEntityType.Contact,
    {
      name: args.name as string,
      email: args.email as string | undefined,
      phone: args.phone as string | undefined,
    },
  );
}

async function executeCreateCompany(args: Record<string, unknown>): Promise<ToolResult> {
  const validationError = validateRequiredParams([
    { name: 'integrationId', value: args.integrationId },
    { name: 'chatId', value: args.chatId },
    { name: 'name', value: args.name, nonEmpty: true },
  ]);
  if (validationError) return validationError;

  // Per forms.ts: Company uses 'name', 'website', 'industry', 'type' fields
  return createAndLinkEntity(
    args.integrationId as number,
    args.chatId as string,
    ProviderEntityType.Company,
    {
      name: args.name as string,
      website: args.website as string | undefined,
      industry: args.industry as string | undefined,
      type: args.type as string | undefined,
    },
  );
}

async function executeAssociateEntities(args: Record<string, unknown>): Promise<ToolResult> {
  const validationError = validateRequiredParams([
    { name: 'integrationId', value: args.integrationId },
    { name: 'entityType', value: args.entityType },
    { name: 'entityId', value: args.entityId },
    { name: 'associatedEntityType', value: args.associatedEntityType },
    { name: 'associatedEntityId', value: args.associatedEntityId },
  ]);
  if (validationError) return validationError;

  return associateEntitiesShared(
    args.integrationId as number,
    args.entityType as ProviderEntityType,
    args.entityId as string,
    args.associatedEntityType as ProviderEntityType,
    args.associatedEntityId as string,
  );
}

async function executeLinkEntityToChat(args: Record<string, unknown>): Promise<ToolResult> {
  return linkEntityToChatShared(
    args.integrationId as number,
    args.chatId as string,
    args.entityType as ProviderEntityType,
    args.entityId as string,
  );
}

function executeSearchEntities(args: Record<string, unknown>): Promise<ToolResult> {
  return searchEntitiesShared(
    args.integrationId as number,
    args.entityType as ProviderEntityType,
    args.searchTerm as string,
    (args.limit as number) || 10,
  );
}

function executeGetEntityProperties(
  integrationId: number,
  entityType: ProviderEntityType,
  propertyName?: string,
): ToolResult {
  const global = getGlobal();
  const allProperties = selectTelebizProperties(global, integrationId);

  // Find the entity type properties
  const entityTypeData = allProperties.find((et) => et.id as ProviderEntityType === entityType);
  if (!entityTypeData) {
    // Trigger load
    const { loadTelebizProviderProperties } = getActions();
    loadTelebizProviderProperties({ integrationId });
    return {
      success: true,
      data: {
        status: 'loading',
        message: 'Properties are being loaded. Retry in a moment.',
      },
    };
  }

  // If a specific property is requested, return just that property's options
  if (propertyName) {
    const property = entityTypeData.properties.find((p) => p.standardName === propertyName);
    if (!property) {
      return {
        success: false,
        error: `Property "${propertyName}" not found for ${entityType}. `
          + 'Use getEntityProperties without propertyName to see available properties.',
      };
    }

    return {
      success: true,
      data: {
        property: {
          name: property.name,
          standardName: property.standardName,
          label: property.label,
          type: property.type,
          dependsOn: property.dependsOn,
          options: property.options,
        },
      },
    };
  }

  // Return all properties with their options (summarized)
  const propertiesWithOptions = entityTypeData.properties
    .filter((p) => p.options || p.standardName)
    .map((p) => ({
      name: p.name,
      standardName: p.standardName,
      label: p.label,
      type: p.type,
      dependsOn: p.dependsOn,
      hasOptions: Boolean(p.options),
      // Include options for select-type properties
      options: Array.isArray(p.options)
        ? (p.options as { value: string; label: string }[]).map((o) => ({ value: o.value, label: o.label }))
        : typeof p.options === 'object'
          ? Object.keys(p.options)
          : undefined,
    }));

  return {
    success: true,
    data: {
      entityType,
      properties: propertiesWithOptions,
      hint: 'Use getEntityProperties with propertyName to get full options for a specific property.',
    },
  };
}

function executeListIntegrations(): ToolResult {
  const global = getGlobal();
  const integrations = selectTelebizIntegrationsList(global);

  return {
    success: true,
    data: {
      integrations: integrations.map((i) => ({
        id: i.id,
        provider: i.provider.name,
        displayName: i.provider.display_name,
        status: i.status,
        accountEmail: i.provider_account_email,
      })),
    },
  };
}

// Helper to summarize entity for LLM
function summarizeEntity(entity: unknown, entityType: ProviderEntityType): Record<string, unknown> {
  const e = entity as Record<string, unknown>;

  switch (entityType) {
    case ProviderEntityType.Deal: {
      const deal = entity as ProviderDeal;
      return {
        id: deal.id,
        title: deal.title,
        amount: deal.amount,
        currency: deal.currency,
        stage: deal.stage,
        status: deal.status,
        closeDate: deal.closeDate,
        owner: deal.owner,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      };
    }
    case ProviderEntityType.Contact:
      return {
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        company: e.company,
        jobTitle: e.jobTitle,
        lastContact: e.lastContact,
      };
    default:
      return {
        id: e.id,
        type: entityType,
        ...e,
      };
  }
}
