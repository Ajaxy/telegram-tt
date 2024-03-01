import type { ApiBoostsStatus } from '../../../api/types';

export function getBoostProgressInfo(boostInfo: ApiBoostsStatus, freezeOnLevelUp?: boolean) {
  const {
    level, boosts, currentLevelBoosts, nextLevelBoosts, hasMyBoost,
  } = boostInfo;

  const isJustUpgraded = freezeOnLevelUp && boosts === currentLevelBoosts && hasMyBoost;

  const currentLevel = isJustUpgraded ? level - 1 : level;
  const hasNextLevel = Boolean(nextLevelBoosts);

  const levelProgress = (!nextLevelBoosts || isJustUpgraded) ? 1
    : (boosts - currentLevelBoosts) / (nextLevelBoosts - currentLevelBoosts);
  const remainingBoosts = nextLevelBoosts ? nextLevelBoosts - boosts : 0;

  const isMaxLevel = nextLevelBoosts === undefined;

  return {
    currentLevel,
    hasNextLevel,
    boosts,
    levelProgress,
    remainingBoosts,
    isMaxLevel,
  };
}
