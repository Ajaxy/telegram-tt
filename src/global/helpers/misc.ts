import type {
  ApiInputPrivacyRules,
  BotsPrivacyType,
  PrivacyVisibility,
} from '../../api/types';
import type { GlobalState } from '../types';

import { isUserId } from '../../util/entities/ids';
import { partition } from '../../util/iteratees';
import { clamp } from '../../util/math';
import { getAccountsInfo } from '../../util/multiaccount';
import { DEFAULT_LIMITS } from '../../limits';
import { getGlobal } from '..';

export function buildApiInputPrivacyRules(global: GlobalState, {
  visibility,
  isUnspecified,
  allowedIds,
  blockedIds,
  shouldAllowPremium,
  botsPrivacy,
}: {
  visibility: PrivacyVisibility;
  isUnspecified?: boolean;
  allowedIds: string[];
  blockedIds: string[];
  shouldAllowPremium?: true;
  botsPrivacy: BotsPrivacyType;
}): ApiInputPrivacyRules {
  const {
    users: { byId: usersById },
    chats: { byId: chatsById },
  } = global;

  const [allowedUserIds, allowedChatIds] = partition(allowedIds, isUserId);
  const [blockedUserIds, blockedChatIds] = partition(blockedIds, isUserId);

  const rules: ApiInputPrivacyRules = {
    visibility,
    isUnspecified,
    allowedUsers: allowedUserIds.map((userId) => usersById[userId]).filter(Boolean),
    allowedChats: allowedChatIds.map((chatId) => chatsById[chatId]).filter(Boolean),
    blockedUsers: blockedUserIds.map((userId) => usersById[userId]).filter(Boolean),
    blockedChats: blockedChatIds.map((chatId) => chatsById[chatId]).filter(Boolean),
    shouldAllowPremium,
    botsPrivacy,
  };

  return rules;
}

export function getCurrentMaxAccountCount() {
  const global = getGlobal();
  const limit = global.appConfig.limits?.moreAccounts || DEFAULT_LIMITS.moreAccounts;
  const accounts = getAccountsInfo();
  const premiumCount = Object.values(accounts).filter((account) => account.isPremium).length;
  // Each premium account increases the base limit by 1, up to the maximum limit.
  const currentMaxCount = limit[0] + premiumCount;
  return clamp(currentMaxCount, limit[0], limit[1]);
}

export function getCurrentProdAccountCount() {
  return Object.values(getAccountsInfo()).filter((account) => !account.isTest).length;
}
