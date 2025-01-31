import type { ApiLimitType } from '../../api/types';
import type { GlobalState } from '../types';

import { DEFAULT_LIMITS } from '../../config';
import { selectIsCurrentUserPremium } from './users';

export function selectCurrentLimit<T extends GlobalState>(global: T, limit: ApiLimitType) {
  const { appConfig } = global;
  if (!appConfig) {
    return DEFAULT_LIMITS[limit][0];
  }

  const isPremium = selectIsCurrentUserPremium(global);
  const { limits } = appConfig;

  // When there are new limits when updating a layer, until we get a new configuration, we must use the default values
  const value = limits[limit]?.[isPremium ? 1 : 0] ?? DEFAULT_LIMITS[limit][isPremium ? 1 : 0];
  if (limit === 'dialogFilters') return value + 1; // Server does not count "All" as folder, but we need to
  return value;
}

export function selectPremiumLimit<T extends GlobalState>(global: T, limit: ApiLimitType) {
  const { appConfig } = global;
  if (!appConfig) return DEFAULT_LIMITS[limit][1];

  const { limits } = appConfig;

  return limits[limit][1];
}
