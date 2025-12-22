import type {
  GlobalState,
} from '../types';

export function updateAuth<T extends GlobalState>(
  global: T, update: Partial<T['auth']>,
): T {
  return {
    ...global,
    auth: {
      ...global.auth,
      ...update,
    },
  };
}
