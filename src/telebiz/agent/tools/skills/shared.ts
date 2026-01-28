/**
 * Shared utilities for skill tool executors
 * Reduces code duplication across CRM, Notion, and other skills
 */
import { getActions, getGlobal, getPromiseActions } from '../../../../global';

import type { CreateProviderEntityData, ProviderEntity } from '../../../services/types';
import type { ToolResult } from '../../types';
import { ProviderEntityType } from '../../../services/types';

import { TELEBIZ_ERROR_NOTIFICATION_ID } from '../../../config/constants';
import { getMainUsername } from '../../../../global/helpers';
import { selectTabState, selectUser } from '../../../../global/selectors';
import { selectCurrentTelebizOrganization, selectTelebizEntity } from '../../../global/selectors';
import { isUserId } from '../../../../util/entities/ids';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';
import { telebizApiClient } from '../../../services';

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

type ParamSpec = {
  name: string;
  value: unknown;
  nonEmpty?: boolean; // For strings that can't be empty/whitespace
};

/**
 * Validates required parameters for tool executors.
 * Returns a ToolResult error if validation fails, undefined if all valid.
 */
export function validateRequiredParams(params: ParamSpec[]): ToolResult | undefined {
  for (const { name, value, nonEmpty } of params) {
    if (value === undefined) {
      return { success: false, error: `${name} is required` };
    }
    if (nonEmpty && typeof value === 'string' && !value.trim()) {
      return { success: false, error: `${name} cannot be empty` };
    }
  }
  return undefined; // All valid
}

/**
 * Checks for telebiz error notifications after awaiting an action.
 * Returns the error message if found, undefined otherwise.
 */
function checkForTelebizError(): string | undefined {
  const global = getGlobal();
  const tabId = getCurrentTabId();
  const notifications = selectTabState(global, tabId).notifications;
  const errorNotification = notifications.find((n) => n.localId === TELEBIZ_ERROR_NOTIFICATION_ID);

  if (errorNotification) {
    // Dismiss the notification so it doesn't persist
    getActions().dismissNotification({ localId: TELEBIZ_ERROR_NOTIFICATION_ID });
    return typeof errorNotification.message === 'string'
      ? errorNotification.message
      : 'Operation failed';
  }
  return undefined;
}

/**
 * Wraps an action promise and checks for telebiz error notifications after completion.
 * Returns { error } if an error notification was shown, { result } otherwise.
 */
async function withErrorDetection<T>(
  actionPromise: Promise<T>,
): Promise<{ result: T; error?: string }> {
  const result = await actionPromise;
  const error = checkForTelebizError();
  return { result, error };
}

// ============================================================================
// ENTITY OPERATIONS
// ============================================================================

/**
 * Get an entity from state, triggering load if not found
 */
export function getEntityFromState(
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
): { entity: ProviderEntity | undefined; loadingResult?: ToolResult } {
  const global = getGlobal();
  const entity = selectTelebizEntity(global, integrationId, entityType, entityId);

  if (!entity) {
    // Trigger load
    const { loadTelebizEntity } = getActions();
    loadTelebizEntity({ integrationId, entityType, entityId });

    return {
      entity: undefined,
      loadingResult: {
        success: true,
        data: {
          status: 'loading',
          message: `${entityType} is being loaded. Retry in a moment.`,
        },
      },
    };
  }

  return { entity };
}

/**
 * Create an entity and link it to a Telegram chat
 * Follows the same pattern as CreateEntity.tsx in the UI
 */
export async function createAndLinkEntity(
  integrationId: number,
  chatId: string,
  entityType: ProviderEntityType,
  entityData: Record<string, unknown>,
): Promise<ToolResult> {
  const { addTelebizRelationship } = getActions();

  if (!chatId) {
    return {
      success: false,
      error: `chatId is required to create and link a ${entityType}`,
    };
  }

  const global = getGlobal();
  const organizationId = selectCurrentTelebizOrganization(global)?.id;

  const createData: CreateProviderEntityData = {
    integrationId,
    telegramId: chatId,
    entityType,
    organizationId,
    ...entityData,
  };

  try {
    // 1. Create the entity via API
    const entity = await telebizApiClient.integrations.createProviderEntity(createData);
    if (!entity) {
      return { success: false, error: `Failed to create ${entityType}` };
    }

    // 2. Link entity to chat via API
    const user = isUserId(chatId) ? selectUser(global, chatId) : undefined;
    const relationship = await telebizApiClient.integrations.linkEntity({
      integrationId,
      telegramId: chatId,
      telegramHandle: user ? getMainUsername(user) : undefined,
      entityType,
      entityId: entity.id,
      organizationId,
    });

    // 3. Update state with relationship AND entity
    entity.lastSyncAt = Date.now();
    addTelebizRelationship({ relationship, entity });

    return {
      success: true,
      data: {
        created: true,
        entityId: entity.id,
        entityType,
        chatId,
        ...summarizeCreatedEntity(entity, entityType),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : `Failed to create ${entityType}`,
    };
  }
}

/**
 * Create an entity without linking to a chat (e.g., notes attached to other entities)
 * Uses createTelebizAssociation action to properly update UI state
 */
export async function createChildEntity(
  integrationId: number,
  entityType: ProviderEntityType,
  entityData: Record<string, unknown>,
): Promise<ToolResult> {
  // Validation for notes
  if (entityType === ProviderEntityType.Note) {
    const validationError = validateRequiredParams([
      { name: 'noteContent', value: entityData.body, nonEmpty: true },
    ]);
    if (validationError) return validationError;
  }

  const global = getGlobal();
  const organizationId = selectCurrentTelebizOrganization(global)?.id;

  // Extract parent entity info from entityData
  const parentEntityType = entityData.parentEntityType as ProviderEntityType;
  const parentEntityId = entityData.parentEntityId as string;

  if (!parentEntityType || !parentEntityId) {
    return {
      success: false,
      error: `Parent entity info required: parentEntityType and parentEntityId`,
    };
  }

  const createData: CreateProviderEntityData = {
    integrationId,
    telegramId: '', // No chat link for child entities
    entityType,
    organizationId,
    ...entityData,
  };

  const parentEntity = {
    entityType: parentEntityType,
    entityId: parentEntityId,
  };

  // Use action to create entity AND update state, with error detection
  const { error } = await withErrorDetection(
    getPromiseActions().createTelebizAssociation({ data: createData, parentEntity }),
  );

  if (error) {
    return { success: false, error };
  }

  return {
    success: true,
    data: {
      created: true,
      entityType,
      parentEntityType,
      parentEntityId,
    },
  };
}

/**
 * Update an entity field
 */
export async function updateEntityField(
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
  data: Record<string, unknown>,
): Promise<ToolResult> {
  // Use action with error detection
  const { error } = await withErrorDetection(
    getPromiseActions().updateTelebizEntity({
      integrationId,
      entityType,
      entityId,
      data,
    }),
  );

  if (error) {
    return { success: false, error };
  }

  return {
    success: true,
    data: { updated: true, entityId, ...data },
  };
}

/**
 * Link an existing entity to a chat
 */
export async function linkEntityToChat(
  integrationId: number,
  chatId: string,
  entityType: ProviderEntityType,
  entityId: string,
): Promise<ToolResult> {
  const global = getGlobal();
  const organizationId = selectCurrentTelebizOrganization(global)?.id;
  const user = isUserId(chatId) ? selectUser(global, chatId) : undefined;

  const { error } = await withErrorDetection(
    getPromiseActions().linkTelebizEntity({
      integrationId,
      telegramId: chatId,
      telegramHandle: user ? getMainUsername(user) : undefined,
      organizationId,
      entityType,
      entityId,
    }),
  );

  if (error) {
    return { success: false, error };
  }

  return {
    success: true,
    data: { linked: true, chatId, entityType, entityId },
  };
}

/**
 * Associate two entities together (e.g., company to contact, company to deal)
 */
export async function associateEntities(
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
  associatedEntityType: ProviderEntityType,
  associatedEntityId: string,
): Promise<ToolResult> {
  const { error } = await withErrorDetection(
    getPromiseActions().associateTelebizEntity({
      integrationId,
      entityType,
      entityId,
      associatedEntityType,
      associatedEntityId,
    }),
  );

  if (error) {
    return { success: false, error };
  }

  return {
    success: true,
    data: {
      associated: true,
      entityType,
      entityId,
      associatedEntityType,
      associatedEntityId,
    },
  };
}

/**
 * Search entities via API
 */
export async function searchEntities(
  integrationId: number,
  entityType: ProviderEntityType,
  searchTerm: string,
  limit = 10,
): Promise<ToolResult> {
  try {
    const results = await telebizApiClient.integrations.searchProviderEntities(
      integrationId,
      entityType,
      searchTerm,
      limit,
    );

    if (!results || results.length === 0) {
      return {
        success: true,
        data: {
          entityType,
          searchTerm,
          count: 0,
          results: [],
          message: `No ${entityType}s found matching "${searchTerm}". `
            + `Create a new one with createDeal, createContact, or createNotionPage.`,
        },
      };
    }

    return {
      success: true,
      data: {
        entityType,
        searchTerm,
        count: results.length,
        results: results.map((entity: Record<string, unknown>) => ({
          id: entity.id,
          name: entity.name || entity.title || entity.firstname,
          ...summarizeSearchResult(entity, entityType),
        })),
        message: `Found ${results.length} ${entityType}(s). Use linkEntityToChat to link one.`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
    };
  }
}

// Helpers for summarizing entities

function summarizeCreatedEntity(
  entity: ProviderEntity,
  entityType: ProviderEntityType,
): Record<string, unknown> {
  const e = entity as unknown as Record<string, unknown>;
  switch (entityType) {
    case ProviderEntityType.Deal:
      return { title: e.title };
    case ProviderEntityType.Contact:
      return { name: e.name };
    case ProviderEntityType.Company:
      return { name: e.name };
    case ProviderEntityType.Page:
      return { title: e.title };
    default:
      return {};
  }
}

function summarizeSearchResult(
  entity: Record<string, unknown>,
  entityType: ProviderEntityType,
): Record<string, unknown> {
  switch (entityType) {
    case ProviderEntityType.Deal:
      return {
        amount: entity.amount,
        stage: entity.stage,
        status: entity.status,
      };
    case ProviderEntityType.Contact:
      return {
        email: entity.email,
        company: entity.company,
        phone: entity.phone,
      };
    case ProviderEntityType.Organization:
      return {
        industry: entity.industry,
        domain: entity.domain,
      };
    case ProviderEntityType.Page:
      return {
        url: entity.url,
      };
    default:
      return {};
  }
}
