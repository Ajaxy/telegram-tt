import type { GlobalState } from '../types';

export function updateMonetizationInfo<T extends GlobalState>(
  global: T,
  update: GlobalState['monetizationInfo'],
): T {
  return {
    ...global,
    monetizationInfo: {
      ...global.monetizationInfo,
      ...update,
    },
  };
}
