import type { GlobalState } from '../types';

import {
  DEFAULT_TON_EXPLORER_URL, SERVICE_NOTIFICATIONS_USER_ID, USD_CURRENCY_CODE, WALLET_BOT_USERNAME,
} from '../../config';
import { toNonBounceableAddress } from '../../lib/ton/address';
import memoized from '../../util/memoized';
import { isDeletedUser, isUserBot } from '../helpers';
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

// Its seqno keeps a second transfer from going out on the same one
export function selectWalletTransferInFlight<T extends GlobalState>(global: T) {
  return global.wallet?.transactions?.find(({ isPending, seqno }) => isPending && seqno !== undefined);
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

// False until both the wallet state and the device storage have answered
export function selectIsWalletKeyMissing<T extends GlobalState>(global: T) {
  const state = global.wallet?.state;

  return Boolean(state?.address) && !state?.isBackupEnabled && global.wallet?.hasLocalSecret === false;
}

export function selectCanExportWalletPhrase<T extends GlobalState>(global: T) {
  return Boolean(global.wallet?.state?.canExportPhrase) || selectHasLocalOnlyWalletPhrase(global);
}

// The name may be one of the bot's secondary usernames
const findWalletBotId = memoized((bots: GlobalState['attachMenu']['bots'], users: GlobalState['users']['byId']) => (
  Object.values(bots).find((bot) => users[bot.id]?.usernames?.some(({ username, isActive }) => (
    isActive && username.toLowerCase() === WALLET_BOT_USERNAME
  )))?.id
));

// Memoized on the bot list and the users, so the menu render does not walk them every time
export function selectWalletBotId<T extends GlobalState>(global: T) {
  return findWalletBotId(global.attachMenu.bots, global.users.byId);
}

export function selectIsWalletAvailable<T extends GlobalState>(global: T) {
  return Boolean(global.appConfig.isWalletAvailable);
}

export function selectTonExplorerUrl<T extends GlobalState>(global: T) {
  return global.appConfig.tonExplorerUrl || DEFAULT_TON_EXPLORER_URL;
}

// The built-in wallet's "Send Money" replaces this bot in the attach menu
export function selectReplacedWalletBotId<T extends GlobalState>(global: T) {
  return global.appConfig.isWalletAvailable ? selectWalletBotId(global) : undefined;
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
