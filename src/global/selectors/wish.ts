import type { GlobalState } from '../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { isDeletedUser, isUserBot } from '../helpers';
import { selectUser } from './users';

export function selectWish<T extends GlobalState>(global: T, ownerId: string) {
  return global.wishes?.byOwnerId[ownerId];
}

export function selectWishDemoBalance<T extends GlobalState>(global: T) {
  return global.wishes?.demoBalanceGram;
}

export function selectCanHaveWish<T extends GlobalState>(global: T, userId: string) {
  const user = selectUser(global, userId);

  return Boolean(user && !user.isSupport && !isUserBot(user) && !isDeletedUser(user)
    && userId !== SERVICE_NOTIFICATIONS_USER_ID);
}
