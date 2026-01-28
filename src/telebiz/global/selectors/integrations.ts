import type { GlobalState } from '../../../global/types';
import type { Integration, Provider } from '../../services/types';
import type { TelebizIntegrationsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizIntegrations(global: GlobalState): TelebizIntegrationsState {
  return global.telebiz?.integrations || INITIAL_TELEBIZ_STATE.integrations;
}

export function selectTelebizIntegrationsList(global: GlobalState): Integration[] {
  return selectTelebizIntegrations(global).integrations;
}

export function selectTelebizProviders(global: GlobalState): Provider[] {
  return selectTelebizIntegrations(global).providers;
}

export function selectTelebizSelectedIntegrationId(global: GlobalState): number | undefined {
  return selectTelebizIntegrations(global).selectedIntegrationId;
}

export function selectTelebizSelectedProviderName(global: GlobalState): string | undefined {
  return selectTelebizIntegrations(global).selectedProviderName;
}

export function selectTelebizIntegration(global: GlobalState, id: number): Integration | undefined {
  return selectTelebizIntegrationsList(global).find((i) => i.id === id);
}

export function selectTelebizSelectedIntegration(global: GlobalState): Integration | undefined {
  const selectedId = selectTelebizSelectedIntegrationId(global);
  if (!selectedId) return undefined;
  return selectTelebizIntegration(global, selectedId);
}

export function selectTelebizIntegrationsIsLoading(global: GlobalState): boolean {
  return selectTelebizIntegrations(global).isLoading;
}

export function selectTelebizIntegrationsError(global: GlobalState): string | undefined {
  return selectTelebizIntegrations(global).error;
}
