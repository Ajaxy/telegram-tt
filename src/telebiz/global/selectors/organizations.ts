import type { GlobalState } from '../../../global/types';
import type { Organization, OrganizationMember, Role, Team } from '../../services/types';
import type { TelebizOrganizationsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizOrganizations(global: GlobalState): TelebizOrganizationsState {
  return global.telebiz?.organizations || INITIAL_TELEBIZ_STATE.organizations;
}

export function selectTelebizOrganizationsList(global: GlobalState): Organization[] {
  return selectTelebizOrganizations(global).organizations;
}

export function selectCurrentTelebizOrganization(global: GlobalState): Organization | undefined {
  return selectTelebizOrganizations(global).currentOrganization;
}

export function selectCurrentTelebizTeam(global: GlobalState): Team | undefined {
  return selectTelebizOrganizations(global).currentTeam;
}

export function selectTelebizPendingOrganization(global: GlobalState): Partial<Organization> | undefined {
  return selectTelebizOrganizations(global).pendingOrganization;
}

export function selectTelebizOrganizationsIsLoading(global: GlobalState): boolean {
  return selectTelebizOrganizations(global).isLoading;
}

export function selectTelebizOrganizationsError(global: GlobalState): string | undefined {
  return selectTelebizOrganizations(global).error;
}

export function selectTelebizOrganizationMemberByUserId(
  global: GlobalState,
  userId: number,
): Partial<OrganizationMember> | undefined {
  const organization = selectCurrentTelebizOrganization(global);
  return organization?.members?.find((member) => member.user_id === userId);
}

export function selectTelebizRoles(global: GlobalState): Role[] {
  return selectTelebizOrganizations(global).roles;
}

export function selectTelebizRolesIsLoading(global: GlobalState): boolean {
  return selectTelebizOrganizations(global).isLoadingRoles;
}
