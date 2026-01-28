import type { GlobalState } from '../../../global/types';
import type { TelebizUser } from '../../services/types';
import type { TelebizAuthState } from '../types';

import { ORGANIZATION_OWNER_ROLE } from '../../config/constants';
import { INITIAL_TELEBIZ_STATE } from '../initialState';
import { selectCurrentTelebizOrganization } from './organizations';

// Re-export for backwards compatibility
export { ORGANIZATION_OWNER_ROLE };

export function selectTelebizAuth(global: GlobalState): TelebizAuthState {
  return global.telebiz?.auth || INITIAL_TELEBIZ_STATE.auth;
}

export function selectIsTelebizAuthenticated(global: GlobalState): boolean {
  return selectTelebizAuth(global).isAuthenticated;
}

export function selectTelebizUser(global: GlobalState): TelebizUser | undefined {
  return selectTelebizAuth(global).user;
}

export function selectIsTelebizUserOrganizationOwner(global: GlobalState): boolean {
  const user = selectTelebizUser(global);
  const members = selectCurrentTelebizOrganization(global)?.members;
  const userMember = members?.find((member) => member.user_id === user?.id);
  return userMember?.role_name === ORGANIZATION_OWNER_ROLE;
}

export function selectTelebizAuthIsLoading(global: GlobalState): boolean {
  return selectTelebizAuth(global).isLoading;
}

export function selectTelebizAuthError(global: GlobalState): string | undefined {
  return selectTelebizAuth(global).error;
}

export function selectIsTelebizWelcomeModalOpen(global: GlobalState): boolean {
  return selectTelebizAuth(global).isWelcomeModalOpen || false;
}

export function selectTelebizAuthStep(global: GlobalState): TelebizAuthState['authStep'] {
  return selectTelebizAuth(global).authStep;
}
