import type { GlobalState } from '../../../global/types';
import type {
  PropertiesByEntityType,
  ProviderEntity,
  ProviderEntityAssociations,
  ProviderEntityType,
  ProviderPipeline,
  ProviderRelationship,
} from '../../services/types';
import type {
  RelationshipChatData,
  TelebizRelationshipsState,
} from '../types';
import { ProviderEntityType as EntityTypeEnum } from '../../services/types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

// Helper to map entity type to association key
function getEntityAssociationKey(
  entityType: ProviderEntityType,
): ProviderEntityAssociations | undefined {
  switch (entityType) {
    case EntityTypeEnum.Note:
      return 'notes';
    case EntityTypeEnum.Task:
      return 'tasks';
    case EntityTypeEnum.Meeting:
      return 'meetings';
    case EntityTypeEnum.Contact:
      return 'contacts';
    case EntityTypeEnum.Company:
      return 'companies';
    case EntityTypeEnum.Deal:
      return 'deals';
    default:
      return undefined;
  }
}

export function updateTelebizRelationships<T extends GlobalState>(
  global: T,
  update: Partial<TelebizRelationshipsState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...(global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships),
        ...update,
      },
    },
  };
}

export function updateTelebizRelationshipsLoadingState<T extends GlobalState>(
  global: T,
  update: Partial<TelebizRelationshipsState['loadingEntityState']>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...(global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships),
        loadingEntityState: update,
      },
    },
  };
}

export function updateTelebizRelationshipsByChatId<T extends GlobalState>(
  global: T,
  chatId: string,
  update: Partial<RelationshipChatData>,
): T {
  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const currentChatData = currentRelationships.byChatId[chatId] || {
    relationships: [],
    isLoading: false,
  };

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...currentRelationships,
        byChatId: {
          ...currentRelationships.byChatId,
          [chatId]: {
            ...currentChatData,
            ...update,
          },
        },
      },
    },
  };
}

export function clearTelebizRelationshipsByChatId<T extends GlobalState>(
  global: T,
): T {
  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...currentRelationships,
        byChatId: {},
        isLoading: false,
        error: undefined,
        loadingEntityState: undefined,
        isAddingRelationship: false,
        selectedIntegrationId: undefined,
        activeTab: undefined,
        tabList: undefined,
        entityLoadError: undefined,
      },
    },
  };
}

export function setTelebizChatRelationships<T extends GlobalState>(
  global: T,
  chatId: string,
  relationships: ProviderRelationship[],
  selectedRelationshipId?: number,
): T {
  return updateTelebizRelationshipsByChatId(global, chatId, {
    relationships,
    selectedRelationshipId,
    isLoading: false,
  });
}

export function addTelebizRelationship<T extends GlobalState>(
  global: T,
  relationship: ProviderRelationship,
): T {
  const chatId = relationship.telegram_id;
  if (!chatId) return global;

  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const currentChatData = currentRelationships.byChatId[chatId] || {
    relationships: [],
    isLoading: false,
  };
  const integration = global.telebiz?.integrations?.integrations.find((i) => i.id === relationship.integration_id);

  return updateTelebizRelationshipsByChatId(global, chatId, {
    relationships: [...currentChatData.relationships,
      { ...relationship, integration }],
    selectedRelationshipId: relationship.id,
  });
}

export function updateTelebizEntity<T extends GlobalState>(
  global: T,
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
  entity: ProviderEntity,
): T {
  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const currentIntegrationEntities = currentRelationships.entitiesByIntegrationId[integrationId] || {};
  const currentTypeEntities = currentIntegrationEntities[entityType] || {};
  const normalizedId = String(entityId);
  const currentEntity = currentTypeEntities[normalizedId];

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...currentRelationships,
        entitiesByIntegrationId: {
          ...currentRelationships.entitiesByIntegrationId,
          [integrationId]: {
            ...currentIntegrationEntities,
            [entityType]: {
              ...currentTypeEntities,
              [normalizedId]: { ...currentEntity, ...entity, lastSyncAt: Date.now() },
            },
          },
        },
      },
    },
  };
}

export function updateTelebizPipelines<T extends GlobalState>(
  global: T,
  integrationId: number,
  pipelines: ProviderPipeline[],
): T {
  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...currentRelationships,
        pipelinesByIntegrationId: {
          ...currentRelationships.pipelinesByIntegrationId,
          [integrationId]: {
            pipelines,
            isLoading: false,
            lastSyncAt: Date.now(),
          },
        },
      },
    },
  };
}

export function updateTelebizProperties<T extends GlobalState>(
  global: T,
  integrationId: number,
  properties: PropertiesByEntityType[],
): T {
  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...currentRelationships,
        propertiesByIntegrationId: {
          ...currentRelationships.propertiesByIntegrationId,
          [integrationId]: {
            properties,
            isLoading: false,
            lastSyncAt: Date.now(),
          },
        },
      },
    },
  };
}

export function removeTelebizEntity<T extends GlobalState>(
  global: T,
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
): T {
  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const currentIntegrationEntities = currentRelationships.entitiesByIntegrationId[integrationId];
  const normalizedId = String(entityId);

  if (!currentIntegrationEntities?.[entityType]?.[normalizedId]) {
    return global;
  }

  const { [normalizedId]: _, ...remainingEntities } = currentIntegrationEntities[entityType];

  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      relationships: {
        ...currentRelationships,
        entitiesByIntegrationId: {
          ...currentRelationships.entitiesByIntegrationId,
          [integrationId]: {
            ...currentIntegrationEntities,
            [entityType]: remainingEntities,
          },
        },
      },
    },
  };
}

export function addEntityToParentAssociations<T extends GlobalState>(
  global: T,
  integrationId: number,
  parentEntityType: ProviderEntityType,
  parentEntityId: string,
  childEntityType: ProviderEntityType,
  childEntity: ProviderEntity,
): T {
  const associationKey = getEntityAssociationKey(childEntityType);
  if (!associationKey) return global;

  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const normalizedParentId = String(parentEntityId);
  const parentEntity = currentRelationships.entitiesByIntegrationId[integrationId]
    ?.[parentEntityType]?.[normalizedParentId];

  if (!parentEntity) return global;

  const currentArray = parentEntity.associations?.[associationKey] || [];
  const updatedArray = [...currentArray, childEntity];

  const updatedParent = {
    ...parentEntity,
    associations: {
      ...(parentEntity.associations || {}),
      [associationKey]: updatedArray,
    },
  };

  return updateTelebizEntity(global, integrationId, parentEntityType, parentEntityId, updatedParent);
}

export function updateEntityInParentAssociations<T extends GlobalState>(
  global: T,
  integrationId: number,
  parentEntityType: ProviderEntityType,
  parentEntityId: string,
  childEntityType: ProviderEntityType,
  updatedChildEntity: ProviderEntity,
): T {
  const associationKey = getEntityAssociationKey(childEntityType);
  if (!associationKey) return global;

  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const normalizedParentId = String(parentEntityId);
  const parentEntity = currentRelationships.entitiesByIntegrationId[integrationId]
    ?.[parentEntityType]?.[normalizedParentId];

  if (!parentEntity) return global;

  const currentArray = parentEntity.associations?.[associationKey] || [];
  // Use String() to ensure consistent comparison (API may return number IDs)
  const updatedArray = currentArray.map((entity) =>
    String(entity.id) === String(updatedChildEntity.id) ? updatedChildEntity : entity);

  const updatedParent = {
    ...parentEntity,
    associations: {
      ...(parentEntity.associations || {}),
      [associationKey]: updatedArray,
    },
  };

  return updateTelebizEntity(global, integrationId, parentEntityType, parentEntityId, updatedParent);
}

export function removeEntityFromParentAssociations<T extends GlobalState>(
  global: T,
  integrationId: number,
  parentEntityType: ProviderEntityType,
  parentEntityId: string,
  childEntityType: ProviderEntityType,
  childEntityId: string,
): T {
  const associationKey = getEntityAssociationKey(childEntityType);
  if (!associationKey) return global;

  const currentRelationships = global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
  const normalizedParentId = String(parentEntityId);
  const parentEntity = currentRelationships.entitiesByIntegrationId[integrationId]
    ?.[parentEntityType]?.[normalizedParentId];

  if (!parentEntity) return global;

  const currentArray = parentEntity.associations?.[associationKey] || [];
  // Use String() to ensure consistent comparison (API may return number IDs)
  const updatedArray = currentArray.filter((entity) => String(entity.id) !== String(childEntityId));

  const updatedParent = {
    ...parentEntity,
    associations: {
      ...(parentEntity.associations || {}),
      [associationKey]: updatedArray,
    },
  };

  return updateTelebizEntity(global, integrationId, parentEntityType, parentEntityId, updatedParent);
}
