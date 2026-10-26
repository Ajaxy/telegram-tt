import type { ApiPeer, ApiWalletTransactionPeer } from '../../api/types';
import type { GlobalState } from '../types';

import {
  DEFAULT_OLD_WALLET_BOT_USERNAME, DEFAULT_TON_EXPLORER_URL, SERVICE_NOTIFICATIONS_USER_ID, USD_CURRENCY_CODE,
} from '../../config';
import { toNonBounceableAddress } from '../../lib/ton/address';
import memoized from '../../util/memoized';
import { getWalletPeerId, isDeletedUser, isUserBot } from '../helpers';
import { selectPeer } from './peers';
import { selectUser } from './users';

export function selectWalletAddress<T extends GlobalState>(global: T) {
  return global.wallet?.state?.address;
}

export function selectWalletPublicKey<T extends GlobalState>(global: T) {
  return global.wallet?.state?.publicKey;
}

export function selectWalletTonConnectSessions<T extends GlobalState>(global: T) {
  return global.wallet?.tonConnectSessions;
}

export function selectWalletTransactions<T extends GlobalState>(global: T) {
  return global.wallet?.transactions;
}

// Its seqno keeps a second transfer from going out on the same one
export function selectWalletTransferInFlight<T extends GlobalState>(global: T) {
  return selectWalletTransactions(global)?.find(({ isPending, seqno }) => isPending && seqno !== undefined);
}

// The address is looked up once the item is picked: the server may create the wallet for the user then
export function selectCanSendMoneyToUser<T extends GlobalState>(global: T, userId: string) {
  const user = selectUser(global, userId);

  return Boolean(global.appConfig.isWalletAvailable && user && !user.isSelf && !user.isSupport
    && !isUserBot(user) && !isDeletedUser(user) && userId !== SERVICE_NOTIFICATIONS_USER_ID);
}

export function selectWalletResolvedUser<T extends GlobalState>(global: T, address: string) {
  return selectWalletAddressOwner(global, toNonBounceableAddress(address)) || undefined;
}

// A gift moved between the wallet and the user's profile shows the current user, as the iOS app does
export function selectWalletCounterparty<T extends GlobalState>(
  global: T, peer: ApiWalletTransactionPeer,
): ApiPeer | undefined {
  const peerId = getWalletPeerId(peer);
  if (peerId) return selectPeer(global, peerId);

  if (peer.type === 'address') return selectWalletResolvedUser(global, peer.address);

  return peer.type === 'telegramGift' && peer.isOwnProfile ? selectUser(global, global.currentUserId!) : undefined;
}

// `false` means the server names no owner; `undefined` means no answer yet or the owner is not loaded
export function selectWalletAddressOwner<T extends GlobalState>(global: T, nonBounceableAddress: string) {
  const resolved = global.wallet?.resolvedAddresses?.[nonBounceableAddress];
  if (resolved === undefined) return undefined;

  return resolved && resolved.userId ? selectUser(global, resolved.userId) : false;
}

export function selectHasLocalOnlyWalletPhrase<T extends GlobalState>(global: T) {
  return Boolean(global.wallet?.hasLocalSecret && !global.wallet.state?.isBackupEnabled);
}

// A wallet without a working phrase on the device counts as zero
export function selectWalletLocalOnlyNanos<T extends GlobalState>(global: T) {
  return selectHasLocalOnlyWalletPhrase(global) ? global.wallet!.state?.balance ?? 0n : 0n;
}

export function selectWalletSavedWallets<T extends GlobalState>(global: T) {
  return global.wallet?.savedWallets;
}

export function selectIsWalletKeyRotationPending<T extends GlobalState>(global: T) {
  return Boolean(global.wallet?.isKeyRotationPending);
}

// False until both the wallet state and the device storage have answered
export function selectIsWalletKeyMissing<T extends GlobalState>(global: T) {
  const state = global.wallet?.state;

  return Boolean(state?.address) && !state?.isBackupEnabled && global.wallet?.hasLocalSecret === false;
}

export function selectCanExportWalletPhrase<T extends GlobalState>(global: T) {
  return Boolean(global.wallet?.state?.canExportPhrase) || selectHasLocalOnlyWalletPhrase(global);
}

export function selectIsWalletAvailable<T extends GlobalState>(global: T) {
  return Boolean(global.appConfig.isWalletAvailable);
}

export function selectTonExplorerUrl<T extends GlobalState>(global: T) {
  return global.appConfig.tonExplorerUrl || DEFAULT_TON_EXPLORER_URL;
}

// Memoized on the bot list and the users, so the menu render does not walk them every time
const findAttachBotId = memoized((
  bots: GlobalState['attachMenu']['bots'], users: GlobalState['users']['byId'], username: string,
) => Object.keys(bots).find((id) => (
  users[id]?.usernames?.some((item) => item.isActive && item.username.toLowerCase() === username)
)));

// The built-in wallet replaces this bot in the menus; an empty name in the config keeps it
export function selectOldWalletBotId<T extends GlobalState>(global: T) {
  const { isWalletAvailable, oldWalletBotUsername = DEFAULT_OLD_WALLET_BOT_USERNAME } = global.appConfig;
  if (!isWalletAvailable || !oldWalletBotUsername) return undefined;

  return findAttachBotId(global.attachMenu.bots, global.users.byId, oldWalletBotUsername.toLowerCase());
}

export function selectOnrampProvider<T extends GlobalState>(global: T, providerId: string) {
  return global.wallet?.onrampProviders?.find(({ id }) => id === providerId);
}

export function selectWalletCurrency<T extends GlobalState>(global: T) {
  return global.walletCurrency || USD_CURRENCY_CODE;
}

export function selectWalletCurrencyRate<T extends GlobalState>(global: T) {
  const currency = selectWalletCurrency(global);
  if (currency === USD_CURRENCY_CODE) return 1;

  return global.currencyRates?.[currency];
}

const sortCurrencies = memoized((rates: Record<string, number>) => Object.keys(rates).sort());

export function selectAvailableCurrencies<T extends GlobalState>(global: T) {
  const rates = global.currencyRates;

  return rates && sortCurrencies(rates);
}
