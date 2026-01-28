import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { ActionReturnType } from '../../../global/types';
import type {
  CreateProviderEntityData,
  ProviderEntity,
  ProviderEntityParent,
  ProviderRelationship } from '../../services/types';
import {
  ProviderEntityType,
} from '../../services/types';

import {
  ENTITIES_SYNC_THRESHOLD,
  PIPELINES_SYNC_THRESHOLD,
  TELEBIZ_ERROR_NOTIFICATION_ID,
} from '../../config/constants';
import { selectCurrentMessageList } from '../../../global/selectors';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { LoadingType, telebizApiClient } from '../../services';
import {
  addEntityToParentAssociations,
  addTelebizRelationship,
  removeEntityFromParentAssociations,
  removeTelebizEntity,
  setTelebizChatRelationships,
  updateEntityInParentAssociations,
  updateTelebizEntity,
  updateTelebizPipelines,
  updateTelebizProperties,
  updateTelebizRelationships,
  updateTelebizRelationshipsByChatId,
  updateTelebizRelationshipsLoadingState,
} from '../reducers';
import {
  selectCurrentTelebizOrganization,
  selectIsTelebizAuthenticated,
  selectTelebizEntity,
  selectTelebizPipelines,
  selectTelebizPipelinesLastSyncAt,
  selectTelebizProperties,
  selectTelebizPropertiesLastSyncAt,
  selectTelebizRelationships,
  selectTelebizSelectedRelationship,
} from '../selectors';

/**
 * Fetches an entity from the API and stores it in global state.
 * Returns the entity if successful, undefined otherwise.
 * Note: Caller should call getGlobal() after this to get fresh state.
 */
async function fetchAndStoreEntity(
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
): Promise<ProviderEntity | undefined> {
  const entity = await telebizApiClient.integrations.getProviderEntity(
    integrationId,
    entityType,
    entityId,
  );

  entity.lastSyncAt = Date.now();

  let global = getGlobal();
  global = updateTelebizEntity(global, integrationId, entityType, entityId, entity);
  setGlobal(global);

  return entity;
}

addActionHandler('loadTelebizRelationships', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  global = updateTelebizRelationships(global, { isLoading: true, error: undefined });
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: LoadingType.Relationships });
  setGlobal(global);

  try {
    const currentOrganization = selectCurrentTelebizOrganization(global);
    if (!currentOrganization) return;
    const response = await telebizApiClient.integrations.getEntities({
      organizationId: currentOrganization.id,
    });
    const relationships = response?.entities || [];

    // Group relationships by chat ID
    const byChatId: Record<string, { relationships: ProviderRelationship[]; isLoading: boolean }> = {};
    for (const relationship of relationships) {
      const chatId = relationship.telegram_id;
      if (!chatId) continue;

      if (!byChatId[chatId]) {
        byChatId[chatId] = { relationships: [], isLoading: false };
      }
      byChatId[chatId].relationships.push(relationship);
    }

    global = getGlobal();
    const currentState = selectTelebizRelationships(global);

    // Preserve selected relationship IDs, or set to last relationship if none selected
    for (const chatId of Object.keys(byChatId)) {
      const currentChatData = currentState.byChatId[chatId];
      const chatRelationships = byChatId[chatId].relationships;

      const selectedRelationship = chatRelationships.find((r) => r.id === currentChatData?.selectedRelationshipId);

      if (selectedRelationship) {
        byChatId[chatId] = {
          ...byChatId[chatId],
          selectedRelationshipId: currentChatData.selectedRelationshipId,
        } as any;
      } else if (chatRelationships.length) {
        byChatId[chatId] = {
          ...byChatId[chatId],
          selectedRelationshipId: chatRelationships[chatRelationships.length - 1].id,
        } as any;
      }
    }

    global = updateTelebizRelationships(global, {
      byChatId,
      isLoading: false,
    });
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load relationships';
    global = getGlobal();
    global = updateTelebizRelationships(global, {
      error: errorMessage,
      isLoading: false,
    });
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  }
});

addActionHandler('selectTelebizRelationship', (global, actions, payload): ActionReturnType => {
  const { chatId, relationshipId } = payload;

  // Update selected relationship
  global = updateTelebizRelationshipsByChatId(global, chatId, {
    selectedRelationshipId: relationshipId,
  });

  return global;
});

addActionHandler('addTelebizRelationship', (global, actions, payload): ActionReturnType => {
  const { relationship, entity } = payload;

  // Add the relationship (which also selects it)
  global = addTelebizRelationship(global, relationship);

  // If entity data is provided, store it in state
  if (entity) {
    global = updateTelebizEntity(
      global,
      relationship.integration_id,
      relationship.entity_type,
      entity.id,
      entity,
    );
  }

  return global;
});

addActionHandler('loadTelebizDealPipelines', async (global, actions, payload): Promise<void> => {
  const { integrationId, forceRefresh = false } = payload;
  const existingPipelines = selectTelebizPipelines(global, integrationId);
  const existingPipelinesLastSyncAt = selectTelebizPipelinesLastSyncAt(global, integrationId);
  if (existingPipelines && !forceRefresh && existingPipelinesLastSyncAt) {
    if (existingPipelinesLastSyncAt > Date.now() - PIPELINES_SYNC_THRESHOLD) {
      return;
    }
  }

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: LoadingType.Pipelines });
  setGlobal(global);

  try {
    const pipelines = await telebizApiClient.integrations.getDealPipelines(integrationId);

    global = getGlobal();
    global = updateTelebizPipelines(global, integrationId, pipelines);
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load pipelines';
    global = getGlobal();
    global = updateTelebizRelationships(global, { error: errorMessage });
    setGlobal(global);
  }
});

addActionHandler('loadTelebizProviderProperties', async (global, actions, payload): Promise<void> => {
  const { integrationId, forceRefresh } = payload;

  const existingProperties = selectTelebizProperties(global, integrationId);
  const existingPropertiesLastSyncAt = selectTelebizPropertiesLastSyncAt(global, integrationId);
  // if (existingProperties && !forceRefresh && existingPropertiesLastSyncAt) {
  //   if (existingPropertiesLastSyncAt > Date.now() - PROPERTIES_SYNC_THRESHOLD) {
  //     return;
  //   }
  // }

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: LoadingType.Properties });
  setGlobal(global);

  try {
    const properties = await telebizApiClient.integrations.getProviderProperties(integrationId);

    global = getGlobal();
    global = updateTelebizProperties(global, integrationId, properties);
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load properties';
    global = getGlobal();
    global = updateTelebizRelationships(global, { error: errorMessage });
    setGlobal(global);
  }
});

addActionHandler('createTelebizAssociation', async (global, actions, payload): Promise<void> => {
  const { data, parentEntity } = payload as {
    data: CreateProviderEntityData;
    parentEntity: ProviderEntityParent;
  };

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: data.entityType, entityId: data.entityId });
  setGlobal(global);

  try {
    const entity = await telebizApiClient.integrations.createProviderEntity(data);

    if (!entity) return;

    global = getGlobal();
    global = addEntityToParentAssociations(
      global,
      data.integrationId,
      parentEntity.entityType,
      parentEntity.entityId,
      data.entityType,
      entity,
    );
    // Check if that child already exists in state
    const childEntity = selectTelebizEntity(
      global,
      data.integrationId,
      data.entityType,
      entity.id,
    );
    if (childEntity) {
      const parentEntityData = selectTelebizEntity(
        global,
        data.integrationId,
        parentEntity.entityType,
        parentEntity.entityId,
      );
      // Add parent entity to child entity's associations if both entities exist (contacts)
      if (childEntity && parentEntityData) {
        global = addEntityToParentAssociations(
          global,
          data.integrationId,
          data.entityType,
          entity.id,
          parentEntity.entityType,
          parentEntityData,
        );
      }
    }

    global = updateTelebizRelationshipsLoadingState(global, undefined);

    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create entity';
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('updateTelebizEntity', async (global, actions, payload): Promise<void> => {
  const { integrationId, entityType, entityId, data, parentEntity } = payload as {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    data: any;
    parentEntity?: ProviderEntityParent;
  };

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: entityType, entityId });
  setGlobal(global);

  try {
    // HubSpot requires clearing lifecyclestage before setting a lower value
    // So we always clear it first, then set the new value
    if ('lifecyclestage' in data) {
      await telebizApiClient.integrations.updateEntity(
        integrationId,
        entityType,
        entityId,
        { lifecyclestage: '' },
      );
    }

    const entity = await telebizApiClient.integrations.updateEntity(
      integrationId,
      entityType,
      entityId,
      data,
    );

    if (!entity) return;

    // Add local sync timestamp
    entity.lastSyncAt = Date.now();

    global = getGlobal();
    global = updateTelebizEntity(global, integrationId, entityType, entityId, entity);

    // Update parent entity's associations directly
    if (parentEntity) {
      global = updateEntityInParentAssociations(
        global,
        integrationId,
        parentEntity.entityType,
        parentEntity.entityId,
        entityType,
        entity,
      );
    }

    global = updateTelebizRelationshipsLoadingState(global, undefined);

    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update entity';
    global = getGlobal();
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('deleteTelebizEntity', async (global, actions, payload): Promise<void> => {
  const { integrationId, entityType, entityId, deleteFromProvider = true, parentEntity } = payload as {
    integrationId: number;
    entityType: ProviderEntityType;
    entityId: string;
    deleteFromProvider?: boolean;
    parentEntity?: ProviderEntityParent;
  };
  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: entityType, entityId });
  setGlobal(global);

  try {
    // Only call API to delete from provider if the flag is true
    if (deleteFromProvider) {
      await telebizApiClient.integrations.deleteEntity(integrationId, entityType, entityId);
    }

    global = getGlobal();
    global = removeTelebizEntity(global, integrationId, entityType, entityId);

    // Update parent entity's associations directly
    if (parentEntity) {
      global = removeEntityFromParentAssociations(
        global,
        integrationId,
        parentEntity.entityType,
        parentEntity.entityId,
        entityType,
        entityId,
      );
      // Remove child entity from parent entity's associations
      const childEntityData = selectTelebizEntity(
        global,
        integrationId,
        entityType,
        entityId,
      );
      if (childEntityData) {
        global = removeEntityFromParentAssociations(
          global,
          integrationId,
          entityType,
          entityId,
          parentEntity.entityType,
          parentEntity.entityId,
        );
      }
    }

    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete entity';
    global = getGlobal();
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('unlinkTelebizEntity', async (global, actions, payload): Promise<void> => {
  const { relationship } = payload as { relationship: ProviderRelationship };

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: LoadingType.Entities });
  setGlobal(global);

  try {
    await telebizApiClient.integrations.unlinkEntity(relationship.id);

    global = getGlobal();
    const chatId = relationship.telegram_id;
    if (chatId) {
      const currentState = selectTelebizRelationships(global);
      const currentChatData = currentState.byChatId[chatId];

      if (currentChatData) {
        const updatedRelationships = currentChatData.relationships.filter(
          (r) => r.id !== relationship.id,
        );
        global = setTelebizChatRelationships(global, chatId, updatedRelationships);
      }
    }

    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to unlink entity';
    global = getGlobal();
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('removeEntityAssociation', async (global, actions, payload): Promise<void> => {
  const {
    integrationId,
    entityType,
    entityId,
    associatedEntityType,
    associatedEntityId,
  } = payload;

  try {
    await telebizApiClient.integrations.removeEntityAssociation({
      integrationId,
      entityType,
      entityId,
      associatedEntityType,
      associatedEntityId,
    });

    // Update parent entity's associations directly
    global = getGlobal();
    global = removeEntityFromParentAssociations(
      global,
      integrationId,
      associatedEntityType,
      associatedEntityId,
      entityType,
      entityId,
    );
    // Remove child entity from parent entity's associations
    const childEntityData = selectTelebizEntity(
      global,
      integrationId,
      entityType,
      entityId,
    );
    if (childEntityData) {
      global = removeEntityFromParentAssociations(
        global,
        integrationId,
        entityType,
        entityId,
        associatedEntityType,
        associatedEntityId,
      );
    }
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to remove association';
    global = getGlobal();
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('setTelebizRelationshipsLoadingState', (global, actions, payload): ActionReturnType => {
  const { loadingEntityState } = payload;
  return updateTelebizRelationshipsLoadingState(global, loadingEntityState);
});

addActionHandler('clearTelebizRelationshipsError', (global): ActionReturnType => {
  return updateTelebizRelationships(global, { error: undefined });
});

addActionHandler('setTelebizActiveTab', (global, actions, payload): ActionReturnType => {
  const { tabIndex } = payload;
  return updateTelebizRelationships(global, { activeTab: tabIndex });
});

addActionHandler('setTelebizIsAddingRelationship', (global, actions, payload): ActionReturnType => {
  const { isAdding } = payload;
  return updateTelebizRelationships(global, { isAddingRelationship: isAdding });
});

addActionHandler('setTelebizChatSelectedRelationship', (global, actions, payload): ActionReturnType => {
  const { chatId, relationshipId } = payload;
  const currentChatData = selectTelebizRelationships(global).byChatId[chatId] || {
    relationships: [],
    isLoading: false,
  };

  // Update selected relationship
  global = updateTelebizRelationshipsByChatId(global, chatId, {
    ...currentChatData,
    selectedRelationshipId: relationshipId,
  });

  return global;
});

addActionHandler('loadTelebizEntity', async (global, actions, payload): Promise<void> => {
  const { integrationId, entityType, entityId, forceRefresh } = payload;

  // Check if entity already exists in state
  const currentRelationships = selectTelebizRelationships(global);
  const existingEntity = currentRelationships.entitiesByIntegrationId[integrationId]?.[entityType]?.[entityId];

  // Check if entity is stale (older than 5 minutes)
  const isStale = !existingEntity?.lastSyncAt
    || existingEntity.lastSyncAt < Date.now() - ENTITIES_SYNC_THRESHOLD;

  if (existingEntity && !forceRefresh && !isStale) {
    // Entity already loaded and fresh, no need to fetch again
    return;
  }

  global = updateTelebizRelationships(global, {
    loadingEntityState: { loadingType: entityType, entityId },
    entityLoadError: undefined,
  });
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: entityType, entityId });
  setGlobal(global);

  try {
    await fetchAndStoreEntity(integrationId, entityType, entityId);
    global = getGlobal();
    global = updateTelebizRelationships(global, { entityLoadError: undefined });
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load entity';
    global = getGlobal();
    global = updateTelebizRelationships(global, {
      entityLoadError: {
        integrationId,
        entityType,
        entityId,
        message: errorMessage,
      },
    });
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  }
});

addActionHandler('confirmTelebizRemoveEntityFromChat', async (global, actions, payload): Promise<void> => {
  const { deleteFromProvider } = payload;
  const tabId = getCurrentTabId();

  // Get the selected relationship from state
  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId) return;

  const selectedRelationship = selectTelebizSelectedRelationship(global, chatId);
  if (!selectedRelationship) return;

  const { integration_id: integrationId, entity_id: entityId, entity_type: entityType } = selectedRelationship;

  try {
    // First, unlink the entity from the chat
    await telebizApiClient.integrations.unlinkEntity(selectedRelationship.id);

    // Remove the relationship from state
    global = getGlobal();
    const currentState = selectTelebizRelationships(global);
    const currentChatData = currentState.byChatId[chatId];

    if (currentChatData) {
      const updatedRelationships = currentChatData.relationships.filter(
        (r) => r.id !== selectedRelationship.id,
      );
      const selectedRelationshipId = updatedRelationships.length ?
        updatedRelationships[updatedRelationships.length - 1].id : undefined;
      global = setTelebizChatRelationships(global, chatId, updatedRelationships, selectedRelationshipId);
    }

    setGlobal(global);

    // If deleteFromProvider is true, also delete from the provider
    if (deleteFromProvider) {
      await telebizApiClient.integrations.deleteProviderEntity({
        integrationId,
        entityType,
        entityId,
        deleteFromProvider: true,
      });

      // Re-fetch global after async call and remove the entity from state
      global = getGlobal();
      global = removeTelebizEntity(global, integrationId, entityType, entityId);
      setGlobal(global);
    }

    // Reset active tab and close dialog
    global = getGlobal();
    global = updateTelebizRelationships(global, { activeTab: 0 });
    setGlobal(global);
    actions.closeTelebizRemoveEntityFromChatDialog();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to remove entity from chat';
    global = getGlobal();
    setGlobal(global);
    actions.closeTelebizRemoveEntityFromChatDialog();
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('linkTelebizEntity', async (global, actions, payload): Promise<void> => {
  const {
    integrationId, telegramId, telegramHandle, organizationId, entityType, entityId,
  } = payload;

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: entityType, entityId });
  setGlobal(global);

  try {
    const relationship = await telebizApiClient.integrations.linkEntity({
      integrationId,
      telegramId,
      telegramHandle,
      organizationId,
      entityType,
      entityId,
    });

    // Add the new relationship to state
    global = getGlobal();
    global = addTelebizRelationship(global, relationship);
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to link entity';
    global = getGlobal();
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});

addActionHandler('associateTelebizEntity', async (global, actions, payload): Promise<void> => {
  const {
    integrationId,
    entityType,
    entityId,
    associatedEntityType,
    associatedEntityId,
  } = payload;

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(
    global,
    { loadingType: associatedEntityType, entityId: associatedEntityId },
  );
  setGlobal(global);

  try {
    await telebizApiClient.integrations.associateEntity({
      integrationId,
      entityType,
      entityId,
      associatedEntityType,
      associatedEntityId,
    });

    // Get the child entity to add to parent's associations
    global = getGlobal();
    const currentRelationships = selectTelebizRelationships(global);
    let childEntity: ProviderEntity | undefined = currentRelationships.entitiesByIntegrationId[integrationId]
      ?.[entityType]?.[entityId];
    const parentEntity = currentRelationships.entitiesByIntegrationId[integrationId]
      ?.[associatedEntityType]?.[associatedEntityId];

    // Fetch child entity from backend if not in state, and store it
    if (!childEntity) {
      try {
        childEntity = await fetchAndStoreEntity(integrationId, entityType, entityId);
        global = getGlobal();
      } catch {}
    }

    // Update parent entity's associations directly
    if (parentEntity && childEntity) {
      global = addEntityToParentAssociations(
        global,
        integrationId,
        associatedEntityType,
        associatedEntityId,
        entityType,
        childEntity,
      );
    }

    // Add parent entity to child entity's associations
    if (childEntity && parentEntity) {
      global = addEntityToParentAssociations(
        global,
        integrationId,
        entityType,
        entityId,
        associatedEntityType,
        parentEntity,
      );
    }
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to associate entity';
    global = getGlobal();
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  } finally {
    global = getGlobal();
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  }
});

addActionHandler('updateTelebizNotionBlock', async (global, actions, payload): Promise<void> => {
  const { integrationId, pageId, blockId, blockData } = payload;

  global = getGlobal();
  global = updateTelebizRelationshipsLoadingState(global, { loadingType: ProviderEntityType.Page, entityId: pageId });
  setGlobal(global);

  try {
    const updatedBlock = await telebizApiClient.integrations.updateBlock(integrationId, blockId, blockData);

    global = getGlobal();
    const pageEntity = selectTelebizEntity(global, integrationId, ProviderEntityType.Page, pageId);

    if (pageEntity && 'blocks' in pageEntity && pageEntity.blocks) {
      const updatedBlocks = pageEntity.blocks.map((block: any) =>
        block.id === blockId ? { ...block, ...updatedBlock } : block);

      global = updateTelebizEntity(global, integrationId, ProviderEntityType.Page, pageId, {
        ...pageEntity,
        blocks: updatedBlocks,
      });
    }

    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update block';
    global = getGlobal();
    global = updateTelebizRelationshipsLoadingState(global, undefined);
    setGlobal(global);
    getActions().showNotification({
      localId: TELEBIZ_ERROR_NOTIFICATION_ID,
      message: errorMessage,
    });
  }
});
