import type { ApiLimitType, GlobalState } from '../types';
import { selectIsCurrentUserPremium } from './users';
import { DEFAULT_LIMITS } from '../../config';

export function selectCurrentLimit(global: GlobalState, limit: ApiLimitType) {
  const { appConfig } = global;
  if (!appConfig) {
    return DEFAULT_LIMITS[limit][0];
  }

  const isPremium = selectIsCurrentUserPremium(global);
  const { limits } = appConfig;

  const value = limits[limit][isPremium ? 1 : 0] ?? DEFAULT_LIMITS[limit][isPremium ? 1 : 0];
  if (limit === 'dialogFilters') return value + 1; // Server does not count "All" as folder, but we need to
  return value;
}

export function selectPremiumLimit(global: GlobalState, limit: ApiLimitType) {
  const { appConfig } = global;
  if (!appConfig) return DEFAULT_LIMITS[limit][1];

  const { limits } = appConfig;

  return limits[limit][1];
}
