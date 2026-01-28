import type { GlobalState } from '../../../global/types';
import type { Organization } from '../../services/types';
import type { TelebizOrganizationsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizOrganizations<T extends GlobalState>(
  global: T,
  update: Partial<TelebizOrganizationsState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      organizations: {
        ...(global.telebiz?.organizations || INITIAL_TELEBIZ_STATE.organizations),
        ...update,
      },
    },
  };
}

export function addTelebizOrganization<T extends GlobalState>(
  global: T,
  organization: Organization,
): T {
  const current = global.telebiz?.organizations || INITIAL_TELEBIZ_STATE.organizations;
  const updatedOrganizations = [...current.organizations, organization];

  return updateTelebizOrganizations(global, {
    organizations: updatedOrganizations,
  });
}

export function updateTelebizOrganization<T extends GlobalState>(
  global: T,
  organizationId: number,
  organization: Organization,
): T {
  const current = global.telebiz?.organizations || INITIAL_TELEBIZ_STATE.organizations;
  const updatedOrganizations = current.organizations.map((o) =>
    o.id === organizationId ? organization : o);

  return updateTelebizOrganizations(global, {
    organizations: updatedOrganizations,
  });
}

export function removeTelebizOrganization<T extends GlobalState>(
  global: T,
  organizationId: number,
): T {
  const current = global.telebiz?.organizations || INITIAL_TELEBIZ_STATE.organizations;
  const updatedOrganizations = current.organizations.filter((o) => o.id !== organizationId);
  return updateTelebizOrganizations(global, {
    organizations: updatedOrganizations,
  });
}
