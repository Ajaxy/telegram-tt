import { addActionHandler, getActions, getGlobal, setGlobal } from '../../../global';

import type { ActionReturnType } from '../../../global/types';

import { ORGANIZATION_OWNER_ROLE } from '../../config/constants';
import { fetchChatByUsername } from '../../../global/actions/api/chats';
import { telebizApiClient } from '../../services';
import { INITIAL_TELEBIZ_STATE } from '../initialState';
import {
  addTelebizOrganization,
  clearTelebizRelationshipsByChatId,
  removeTelebizOrganization,
  updateTelebizIntegrations,
  updateTelebizNotifications,
  updateTelebizOrganization,
  updateTelebizOrganizations,
  updateTelebizReminders,
  updateTelebizSettings,
} from '../reducers';
import { selectIsTelebizAuthenticated,
  selectTelebizIntegrations,
  selectTelebizOrganizations,
} from '../selectors';

addActionHandler('loadTelebizOrganizations', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  global = updateTelebizOrganizations(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const organizations = await telebizApiClient.organizations.getOrganizations();

    global = getGlobal();
    const currentState = selectTelebizOrganizations(global);

    // Check if current org still exists in the list, otherwise use first org
    const selectedOrg = currentState.currentOrganization
      ? organizations.find((org) => org.id === currentState.currentOrganization!.id)
      : undefined;

    const newOrganization = selectedOrg || organizations[0];
    const organizationChanged = currentState.currentOrganization?.id !== newOrganization?.id;

    global = updateTelebizOrganizations(global, {
      organizations,
      isLoading: false,
      currentOrganization: newOrganization,
    });

    // If organization changed or was removed, clear organization-specific data
    // Preserve providers since they're global (not organization-specific)
    // Only clear byChatId for relationships - entities/pipelines/properties are keyed by
    // integration ID and will be reused if switching back to the same org
    if (organizationChanged || !newOrganization) {
      const { providers } = selectTelebizIntegrations(global);
      global = updateTelebizIntegrations(global, {
        ...INITIAL_TELEBIZ_STATE.integrations,
        providers,
      });
      global = clearTelebizRelationshipsByChatId(global);
      global = updateTelebizNotifications(global, INITIAL_TELEBIZ_STATE.notifications);
      global = updateTelebizReminders(global, INITIAL_TELEBIZ_STATE.reminders);
      global = updateTelebizSettings(global, INITIAL_TELEBIZ_STATE.settings);
    }

    setGlobal(global);

    const {
      loadTelebizIntegrations,
      loadTelebizProviders,
      loadTelebizPendingNotifications,
      loadTelebizReminders,
      loadTelebizUserSettings,
      loadTelebizAllChatSettings,
      syncTelebizChatActivities,
    } = getActions();

    loadTelebizIntegrations();
    loadTelebizPendingNotifications();
    loadTelebizReminders();
    loadTelebizUserSettings();
    loadTelebizAllChatSettings();
    syncTelebizChatActivities();

    // Ensure providers are loaded (they might not be if this is a fresh org)
    const { providers } = selectTelebizIntegrations(getGlobal());
    if (!providers?.length) {
      loadTelebizProviders();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load organizations';
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('switchTelebizOrganization', async (global, actions, payload): Promise<void> => {
  const { organization } = payload;

  // Clear organization-specific data and set new organization
  global = updateTelebizOrganizations(global, {
    currentOrganization: organization,
    currentTeam: undefined,
    isLoading: true,
    error: undefined,
  });

  // Reset integrations but preserve providers (they're global, not org-specific)
  const { providers } = selectTelebizIntegrations(global);
  global = updateTelebizIntegrations(global, {
    ...INITIAL_TELEBIZ_STATE.integrations,
    providers,
    isLoading: true,
  });

  // Only clear byChatId for relationships - entities/pipelines/properties are keyed by
  // integration ID and will be reused if switching back to the same org
  global = clearTelebizRelationshipsByChatId(global);

  // Reset notifications
  global = updateTelebizNotifications(global, INITIAL_TELEBIZ_STATE.notifications);

  // Reset reminders
  global = updateTelebizReminders(global, INITIAL_TELEBIZ_STATE.reminders);

  // Reset settings
  global = updateTelebizSettings(global, INITIAL_TELEBIZ_STATE.settings);

  setGlobal(global);

  try {
    // Load teams for the new organization
    const teams = await telebizApiClient.organizations.getTeams(organization.id);
    const firstTeam = teams[0];

    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      currentTeam: firstTeam,
      isLoading: false,
    });
    setGlobal(global);

    // Reload data for new organization
    const {
      loadTelebizIntegrations,
      loadTelebizProviders,
      loadTelebizRelationships,
      loadTelebizPendingNotifications,
      loadTelebizReminders,
      loadTelebizUserSettings,
      loadTelebizAllChatSettings,
    } = getActions();

    loadTelebizIntegrations();
    loadTelebizRelationships();
    loadTelebizPendingNotifications();
    loadTelebizReminders();
    loadTelebizUserSettings();
    loadTelebizAllChatSettings();

    // Ensure providers are loaded (they might not be if this is a fresh org)
    const { providers: currentProviders } = selectTelebizIntegrations(getGlobal());
    if (!currentProviders?.length) {
      loadTelebizProviders();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to switch organization';
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('switchTelebizTeam', (global, _actions, payload): ActionReturnType => {
  const { team } = payload;
  return updateTelebizOrganizations(global, {
    currentTeam: team,
    error: undefined,
  });
});

addActionHandler('setPendingTelebizOrganization', (global, _actions, payload): ActionReturnType => {
  const { key, value } = payload;
  const currentState = selectTelebizOrganizations(global);

  if (typeof key === 'object') {
    return updateTelebizOrganizations(global, {
      pendingOrganization: key,
    });
  }

  return updateTelebizOrganizations(global, {
    pendingOrganization: {
      ...(currentState.pendingOrganization || {}),
      [key]: value,
    },
  });
});

addActionHandler('resetPendingTelebizOrganization', (global): ActionReturnType => {
  const currentUserId = global.currentUserId;

  return updateTelebizOrganizations(global, {
    pendingOrganization: {
      name: '',
      description: '',
      logo_url: '',
      members: [{
        telegram_id: currentUserId,
        role_name: ORGANIZATION_OWNER_ROLE,
      }],
    },
  });
});

addActionHandler('clearTelebizOrganizationsError', (global): ActionReturnType => {
  return updateTelebizOrganizations(global, { error: undefined });
});

addActionHandler('createTelebizOrganization', async (global, actions, payload): Promise<void> => {
  const { data } = payload;

  global = updateTelebizOrganizations(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const newOrganization = await telebizApiClient.organizations.createOrganization(data);

    global = getGlobal();
    global = addTelebizOrganization(global, newOrganization);
    global = updateTelebizOrganizations(global, { isLoading: false });
    setGlobal(global);

    getActions().resetPendingTelebizOrganization();
    getActions().switchTelebizOrganization({ organization: newOrganization });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create organization';
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('updateTelebizOrganizationData', async (global, actions, payload): Promise<void> => {
  const { organizationId, data } = payload;

  global = updateTelebizOrganizations(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    const updatedOrganization = await telebizApiClient.organizations.updateOrganization(organizationId, data);

    global = getGlobal();
    global = updateTelebizOrganization(global, organizationId, updatedOrganization);
    global = updateTelebizOrganizations(global, { isLoading: false });
    setGlobal(global);

    getActions().resetPendingTelebizOrganization();
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to update organization';
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('deleteTelebizOrganization', async (global, actions, payload): Promise<void> => {
  const { organizationId } = payload;

  global = updateTelebizOrganizations(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    await telebizApiClient.organizations.deleteOrganization(organizationId);

    global = getGlobal();
    const currentState = selectTelebizOrganizations(global);
    const wasCurrentOrg = currentState.currentOrganization?.id === organizationId;

    global = removeTelebizOrganization(global, organizationId);
    global = updateTelebizOrganizations(global, { isLoading: false });
    setGlobal(global);

    getActions().resetPendingTelebizOrganization();

    // If we deleted the current org, switch to the first available one
    if (wasCurrentOrg) {
      const remainingOrgs = selectTelebizOrganizations(getGlobal()).organizations;
      const newCurrentOrg = remainingOrgs[0];

      if (newCurrentOrg) {
        getActions().switchTelebizOrganization({ organization: newCurrentOrg });
      } else {
        global = getGlobal();
        global = updateTelebizOrganizations(global, { currentOrganization: undefined });
        setGlobal(global);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete organization';
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('acceptTelebizOrganizationInvitation', async (global, actions, payload): Promise<void> => {
  const { invitationId } = payload;

  global = updateTelebizOrganizations(global, { isLoading: true, error: undefined });
  setGlobal(global);

  try {
    await telebizApiClient.organizations.acceptOrganizationInvitation(invitationId);

    // Refresh organizations list since API doesn't return the new organization
    const organizations = await telebizApiClient.organizations.getOrganizations();

    global = getGlobal();
    const currentState = selectTelebizOrganizations(global);

    // Keep current organization if it still exists
    const currentOrg = currentState.currentOrganization
      ? organizations.find((org) => org.id === currentState.currentOrganization!.id)
      : organizations[0];

    global = updateTelebizOrganizations(global, {
      organizations,
      currentOrganization: currentOrg,
      isLoading: false,
    });
    setGlobal(global);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to accept invitation';
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      error: errorMessage,
      isLoading: false,
    });
    setGlobal(global);
  }
});

addActionHandler('loadTelebizUserRoles', async (global): Promise<void> => {
  if (!selectIsTelebizAuthenticated(global)) return;

  global = updateTelebizOrganizations(global, { isLoadingRoles: true });
  setGlobal(global);

  try {
    const roles = await telebizApiClient.organizations.getOrganizationRoles();

    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      roles,
      isLoadingRoles: false,
    });
    setGlobal(global);
  } catch (err) {
    global = getGlobal();
    global = updateTelebizOrganizations(global, {
      isLoadingRoles: false,
    });
    setGlobal(global);
  }
});

addActionHandler('resolveUserByUsername', async (_global, _actions, payload): Promise<void> => {
  const { username } = payload;
  if (!username) return;

  await fetchChatByUsername(getGlobal(), username);
});
