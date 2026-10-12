import { getGlobal, getPromiseActions } from '../../../../global';

// The lookup is forced: a cached address may belong to a wallet the user has replaced since.
// An empty string means the user has no wallet, and `undefined` means the server gave no answer.
export async function loadCurrentUserAddress(userId: string) {
  await getPromiseActions().loadWalletUserAddresses({ userIds: [userId], isForced: true });

  return getGlobal().wallet?.userAddresses?.[userId];
}
