import type { GlobalState } from '../../../global/types';
import type { TelebizIntegrationsState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizIntegrations<T extends GlobalState>(
  global: T,
  update: Partial<TelebizIntegrationsState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      integrations: {
        ...(global.telebiz?.integrations || INITIAL_TELEBIZ_STATE.integrations),
        ...update,
      },
    },
  };
}
