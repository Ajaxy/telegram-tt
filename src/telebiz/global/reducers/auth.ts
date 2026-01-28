import type { GlobalState } from '../../../global/types';
import type { TelebizAuthState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizAuth<T extends GlobalState>(
  global: T,
  update: Partial<TelebizAuthState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      auth: {
        ...(global.telebiz?.auth || INITIAL_TELEBIZ_STATE.auth),
        ...update,
      },
    },
  };
}
