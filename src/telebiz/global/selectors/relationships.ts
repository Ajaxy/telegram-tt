import type { GlobalState } from '../../../global/types';
import type {
  PropertiesByEntityType,
  Property,
  ProviderEntity,
  ProviderEntityType,
  ProviderPipeline,
  ProviderRelationship,
} from '../../services/types';
import type { RelationshipChatData, TelebizRelationshipsState } from '../types';

import { selectCurrentMessageList } from '../../../global/selectors';
import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizRelationships(global: GlobalState): TelebizRelationshipsState {
  return global.telebiz?.relationships || INITIAL_TELEBIZ_STATE.relationships;
}

export function selectTelebizRelationshipsByChatId(
  global: GlobalState,
  chatId: string,
): RelationshipChatData | undefined {
  return selectTelebizRelationships(global).byChatId[chatId];
}

export function selectTelebizRelationshipsByEntity(
  global: GlobalState,
  entityId: string,
  entityType: ProviderEntityType,
  integrationId: number,
): ProviderRelationship[] {
  const relationships = selectAllTelebizRelationships(global);
  return relationships.filter(
    (r) => r.entity_id === entityId
      && r.entity_type === entityType
      && r.integration?.id === integrationId,
  );
}

export function selectTelebizChatRelationships(
  global: GlobalState,
  chatId: string,
): ProviderRelationship[] {
  return selectTelebizRelationshipsByChatId(global, chatId)?.relationships || [];
}

export function selectTelebizSelectedRelationshipId(
  global: GlobalState,
  chatId: string,
): number | undefined {
  return selectTelebizRelationshipsByChatId(global, chatId)?.selectedRelationshipId;
}

export function selectTelebizSelectedRelationship(
  global: GlobalState,
  chatId: string,
): ProviderRelationship | undefined {
  const chatData = selectTelebizRelationshipsByChatId(global, chatId);
  if (!chatData?.selectedRelationshipId) return undefined;
  return chatData.relationships.find((r) => r.id === chatData.selectedRelationshipId);
}

export function selectTelebizEntity(
  global: GlobalState,
  integrationId: number,
  entityType: ProviderEntityType,
  entityId: string,
): ProviderEntity | undefined {
  const relationships = selectTelebizRelationships(global);
  return relationships.entitiesByIntegrationId[integrationId]?.[entityType]?.[entityId];
}

export function selectTelebizPipelinesLastSyncAt(
  global: GlobalState,
  integrationId: number,
): number | undefined {
  const relationships = selectTelebizRelationships(global);
  return relationships.pipelinesByIntegrationId[integrationId]?.lastSyncAt;
}

export function selectTelebizPipelines(
  global: GlobalState,
  integrationId: number,
): ProviderPipeline[] {
  const relationships = selectTelebizRelationships(global);
  return relationships.pipelinesByIntegrationId[integrationId]?.pipelines || [];
}

export function selectTelebizProperties(
  global: GlobalState,
  integrationId: number,
): PropertiesByEntityType[] {
  const relationships = selectTelebizRelationships(global);
  return relationships.propertiesByIntegrationId[integrationId]?.properties || [];
}

export function selectTelebizPropertiesByEntityType(
  global: GlobalState,
  integrationId: number,
  entityType: ProviderEntityType,
): Property[] {
  const properties = selectTelebizProperties(global, integrationId);
  const entityProperties = properties.find((e) => e.id as ProviderEntityType === entityType);
  return entityProperties?.properties || [];
}

export function selectTelebizPropertiesLastSyncAt(
  global: GlobalState,
  integrationId: number,
): number | undefined {
  const relationships = selectTelebizRelationships(global);
  return relationships.propertiesByIntegrationId[integrationId]?.lastSyncAt;
}

export function selectTelebizPropertiesBySelectedRelationship(
  global: GlobalState,
): Property[] {
  const { chatId } = selectCurrentMessageList(global) || {};
  const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;
  if (!selectedRelationship) return [];
  const properties = selectTelebizProperties(global, selectedRelationship.integration_id);
  return properties.find((e) => e.id as ProviderEntityType === selectedRelationship.entity_type)?.properties || [];
}

export function selectTelebizRelationshipsIsLoading(global: GlobalState): boolean {
  return selectTelebizRelationships(global).isLoading;
}

export function selectTelebizRelationshipsError(global: GlobalState): string | undefined {
  return selectTelebizRelationships(global).error;
}

export function selectTelebizEntityLoadError(global: GlobalState) {
  return selectTelebizRelationships(global).entityLoadError;
}

export function selectTelebizRelationshipsLoadingState(global: GlobalState) {
  return selectTelebizRelationships(global).loadingEntityState;
}

export function selectAllTelebizRelationships(global: GlobalState): ProviderRelationship[] {
  const relationships = selectTelebizRelationships(global);
  return Object.values(relationships.byChatId).flatMap((data) => data.relationships);
}

export function selectTelebizIsAddingRelationship(global: GlobalState): boolean {
  return selectTelebizRelationships(global).isAddingRelationship;
}

export function selectTelebizActiveTab(global: GlobalState): number {
  return selectTelebizRelationships(global).activeTab || 0;
}

export function selectTelebizTabList(global: GlobalState) {
  const { chatId } = selectCurrentMessageList(global) || {};
  const selectedRelationship = chatId ? selectTelebizSelectedRelationship(global, chatId) : undefined;

  if (!chatId || !selectedRelationship) return [];
  const currentChatData = selectTelebizRelationships(global).byChatId[chatId];
  if (currentChatData) {
    const relationship = currentChatData.relationships.find((r) => r.id === selectedRelationship?.id);
    if (relationship && global.telebiz?.integrations) {
      const integration = global.telebiz.integrations.integrations.find(
        (i) => i.id === relationship.integration_id,
      );

      if (integration) {
        const entityDetail = integration.provider.entity_details.find(
          (detail) => detail.type === relationship.entity_type,
        );

        if (entityDetail) {
          return entityDetail.tabs;
        }
      }
    }
  }
  return [];
}

export function selectTelebizEntityLoadingState(global: GlobalState) {
  return selectTelebizRelationships(global).loadingEntityState;
}
