import { addActionHandler, getGlobal, setGlobal } from '../../../global';

import type { ActionReturnType } from '../../../global/types';

import { telebizApiClient } from '../../services';
import { updateTelebizIntegrations } from '../reducers';
import {
  selectCurrentTelebizOrganization,
  selectCurrentTelebizTeam,
  selectIsTelebizAuthenticated,
  selectTelebizIntegrationsList,
  selectTelebizSelectedIntegrationId,
} from '../selectors';

addActionHandler('loadTelebizIntegrations', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  const currentOrganization = selectCurrentTelebizOrganization(global);
  if (!currentOrganization) {
    global = updateTelebizIntegrations(global, { isLoading: false, integrations: [] });
    setGlobal(global);
    return;
  }

  global = updateTelebizIntegrations(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const currentTeam = selectCurrentTelebizTeam(global);
    const response = await telebizApiClient.integrations.getIntegrations({
      organizationId: currentOrganization?.id,
      teamId: currentTeam?.id,
      status: 'active',
    });

    global = getGlobal();
    const integrations = response.integrations || [];
    const currentSelectedId = selectTelebizSelectedIntegrationId(global);

    // Auto-select first integration if none selected
    const selectedIntegrationId = currentSelectedId && integrations.some((i) => i.id === currentSelectedId)
      ? currentSelectedId
      : integrations[0]?.id;

    global = updateTelebizIntegrations(global, {
      integrations,
      selectedIntegrationId,
      isLoading: false,
    });
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch integrations';
    global = getGlobal();
    global = updateTelebizIntegrations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('loadTelebizProviders', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  global = updateTelebizIntegrations(global, { isLoadingProviders: true });
  setGlobal(global);

  try {
    const providers = await telebizApiClient.integrations.getProviders();

    global = getGlobal();
    global = updateTelebizIntegrations(global, {
      providers,
      isLoadingProviders: false,
    });
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to fetch providers';
    global = getGlobal();
    global = updateTelebizIntegrations(global, {
      error: errorMessage,
      isLoadingProviders: false,
    });
    setGlobal(global);
  }
});

addActionHandler('setTelebizSelectedIntegrationId', (global, actions, payload): ActionReturnType => {
  const { integrationId } = payload;
  return updateTelebizIntegrations(global, { selectedIntegrationId: integrationId });
});

addActionHandler('setTelebizSelectedProviderName', (global, actions, payload): ActionReturnType => {
  const { providerName } = payload;
  return updateTelebizIntegrations(global, { selectedProviderName: providerName });
});

addActionHandler('updateTelebizIntegrationSettings', async (global, actions, payload): Promise<void> => {
  const { integrationId, settings } = payload;

  try {
    const updatedIntegration = await telebizApiClient.integrations.updateIntegrationSettings(
      integrationId,
      settings,
    );

    global = getGlobal();
    const integrations = selectTelebizIntegrationsList(global);
    const updatedIntegrations = integrations.map((integration) =>
      integration.id === integrationId ? updatedIntegration : integration);

    global = updateTelebizIntegrations(global, {
      integrations: updatedIntegrations,
    });
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update integration settings';
    global = getGlobal();
    global = updateTelebizIntegrations(global, { error: errorMessage });
    setGlobal(global);
    throw err;
  }
});

addActionHandler('clearTelebizIntegrationsError', (global): ActionReturnType => {
  return updateTelebizIntegrations(global, { error: undefined });
});
