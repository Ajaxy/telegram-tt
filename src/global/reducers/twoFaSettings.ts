import type { GlobalState } from '../types';

export function updateTwoFaSettings<T extends GlobalState>(
  global: T,
  update: GlobalState['twoFaSettings'],
): T {
  return {
    ...global,
    twoFaSettings: {
      ...global.twoFaSettings,
      ...update,
    },
  };
}
