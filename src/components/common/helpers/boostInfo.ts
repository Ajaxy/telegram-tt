import type { ApiBoostsStatus } from '../../../api/types';

export function getBoostProgressInfo(boostInfo: ApiBoostsStatus) {
  const {
    level, boosts, currentLevelBoosts, nextLevelBoosts, hasMyBoost,
  } = boostInfo;

  const currentLevel = level;
  const hasNextLevel = Boolean(nextLevelBoosts);

  const isJustUpgraded = boosts === currentLevelBoosts && hasMyBoost;

  const levelProgress = (!nextLevelBoosts || isJustUpgraded) ? 1
    : (boosts - currentLevelBoosts) / (nextLevelBoosts - currentLevelBoosts);
  const remainingBoosts = nextLevelBoosts ? nextLevelBoosts - boosts : 0;

  return {
    currentLevel,
    hasNextLevel,
    boosts,
    levelProgress,
    remainingBoosts,
  };
}
