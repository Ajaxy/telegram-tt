import type {
  ApiOnrampProvider,
  ApiWalletCollectible,
  ApiWalletTransaction,
  DecryptWalletCommentError,
  DecryptWalletCommentResult,
  ExportSecretPhraseError,
  ExportSecretPhraseResult,
  ReplaceWalletError,
  ReplaceWalletResult,
  RotateWalletKeyResult,
  SendTonTransferError,
  SendTonTransferResult,
  WalletBackupResult,
} from '../../../api/types';
import type { ActionReturnType, GlobalState } from '../../types';

import { DEBUG, NFT_TRANSFER_FORWARD_NANOS, WALLET_FIRST_TRANSFER_SUGGESTION } from '../../../config';
import { toNonBounceableAddress } from '../../../lib/ton/address';
import { isDeepLink } from '../../../util/deepLinkParser';
import { isUserId } from '../../../util/entities/ids';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { ACCOUNT_SLOT } from '../../../util/multiaccount';
import {
  hasWalletVaultSecret,
  listWalletVaultSecrets,
  readWalletVaultSecret,
  removeWalletVaultSecret,
  writeWalletVaultSecret,
} from '../../../util/passcode';
import { pause } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { parseTonTransferAddress } from '../../../util/tonAddress';
import { callApi } from '../../../api/gramjs';
import { buildWalletTransferFeeKey, WALLET_ERROR_LANG_KEYS } from '../../helpers/wallet';
import {
  addActionHandler, getGlobal, getPromiseActions, setGlobal,
} from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { addUsers } from '../../reducers/users';
import {
  addPendingWalletTransaction,
  clearWalletRecords,
  replacePendingWalletTransaction,
  updateWallet,
  updateWalletServerState,
} from '../../reducers/wallet';
import { selectChat, selectChatLastMessageId } from '../../selectors/chats';
import { selectTabState } from '../../selectors/tabs';
import { selectTheme } from '../../selectors/ui';
import { selectUser } from '../../selectors/users';
import {
  selectOnrampProvider, selectWalletAddress, selectWalletCurrency, selectWalletPublicKey,
  selectWalletTransferInFlight,
} from '../../selectors/wallet';
import { fetchChatByUsername } from './chats';
import { verifyPasscodeWithLimit } from './passcode';

const NOT_FOUND_NOTIFICATION_DURATION = 6000;

const PENDING_TTL_SECONDS = 300;
const WALLET_BACKUP_LOCK_PREFIX = 'wallet-backup:';
// The server indexes a confirmed transfer with a lag, so the lookup backs off for about a minute
const SENT_LOOKUP_ATTEMPTS = 8;
const SENT_LOOKUP_MIN_DELAY_MS = 1500;
const SENT_LOOKUP_MAX_DELAY_MS = 15000;

addActionHandler('replaceWallet', async (global, actions, payload): Promise<void> => {
  const {
    fromAddress, words, savedAddress, shouldSaveCurrent, password, tabId = getCurrentTabId(),
  } = payload;

  const ownAddress = selectWalletAddress(global);
  if (!ownAddress) return;

  if (ownAddress !== fromAddress) {
    global = updateTabState(global, { walletReplace: { status: 'error', error: 'WALLET_CHANGED' } }, tabId);
    setGlobal(global);
    actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS.WALLET_CHANGED }, tabId });
    return;
  }

  global = updateTabState(global, { walletReplace: { status: 'pending' } }, tabId);
  setGlobal(global);

  // Shares the lock with the backup flows, so a backup started in another tab waits and then sees the wallet gone
  let result: (ReplaceWalletResult & { isPhraseLost?: boolean }) | undefined;
  let isCancelled = false;

  await navigator.locks.request(`${WALLET_BACKUP_LOCK_PREFIX}${ownAddress}`, async () => {
    try {
      // Checked again under the lock: a swap in another tab may have just finished
      global = getGlobal();

      if (selectWalletAddress(global) !== ownAddress) {
        result = { error: 'WALLET_CHANGED' };
        return;
      }

      result = await replaceWalletWithSecrets({
        ownAddress, words, savedAddress, shouldSaveCurrent, password,
      });
    } catch {
      result = undefined;
    }

    global = getGlobal();
    isCancelled = selectTabState(global, tabId).walletReplace?.status !== 'pending';

    if (!result || 'error' in result) return;

    // The swap is done on the server even for a cancelled flow
    global = updateWalletServerState(global, result.state.status, result.state.state);
    global = clearWalletRecords(global);

    if (!isCancelled) {
      global = updateTabState(global, { walletReplace: { status: 'done' } }, tabId);
    }

    setGlobal(global);
  });

  if (!result || 'error' in result) {
    if (isCancelled) return;

    const error = result ? result.error : 'REPLACE_FAILED';
    global = getGlobal();
    global = updateTabState(global, { walletReplace: { status: 'error', error } }, tabId);
    setGlobal(global);

    // Without a credential screen the error has nowhere to go but a toast
    if (!words && !password && error !== 'PASSWORD_MISSING') {
      actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS[error] }, tabId });
    }
    return;
  }

  actions.showNotification(result.isPhraseLost
    ? { message: { key: 'WalletPhraseNotKept' }, tabId }
    : words || savedAddress
      ? { message: { key: 'WalletRestored' }, tabId }
      : { title: { key: 'WalletCreatedTitle' }, message: { key: 'WalletReplaced' }, tabId });

  actions.loadWalletState();
  actions.loadWalletTransactions({ shouldRefresh: true });
  actions.loadSavedWallets();
});

addActionHandler('keepWalletPhrase', async (global, actions, payload): Promise<void> => {
  const { words, tabId = getCurrentTabId() } = payload;

  const ownAddress = selectWalletAddress(global);
  if (!ownAddress || selectTabState(global, tabId).walletReplace?.status === 'pending') return;

  global = updateTabState(global, { walletReplace: { status: 'pending' } }, tabId);
  setGlobal(global);

  // Shares the lock with the swap and backup flows
  let error: ReplaceWalletError | undefined;

  await navigator.locks.request(`${WALLET_BACKUP_LOCK_PREFIX}${ownAddress}`, async () => {
    global = getGlobal();

    if (selectWalletAddress(global) !== ownAddress) {
      error = 'WALLET_CHANGED';
      return;
    }

    try {
      // Another tab's rotation can finish before its global state reaches this tab
      const result = await callApi('fetchWalletState');

      if (!result?.state?.publicKey) {
        error = 'KEEP_FAILED';
        return;
      }

      if (result.state.address !== ownAddress) {
        error = 'WALLET_CHANGED';
        return;
      }

      // An unfinished rotation keeps its new phrase locally while the backup still holds the old one
      const local = result.state.isBackupEnabled ? await readWalletVaultSecret(ACCOUNT_SLOT, ownAddress) : undefined;

      if (local && decodeWords(local).join(' ') !== words.join(' ')) {
        error = 'KEEP_FAILED';
        return;
      }

      const isValid = await callApi('validateWalletPhrase', {
        words, ownAddress, ownPublicKey: result.state.publicKey,
      });

      if (!isValid) {
        error = 'WRONG_PHRASE';
        return;
      }

      await encryptWordsIntoVault(words, ownAddress);
    } catch (err: unknown) {
      error = 'KEEP_FAILED';

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[wallet] The phrase could not be kept', err);
      }
      return;
    }

    global = getGlobal();
    global = updateWallet(global, { hasLocalSecret: true });
    setGlobal(global);
  });

  global = getGlobal();

  if (selectTabState(global, tabId).walletReplace?.status !== 'pending') return;

  if (error) {
    global = updateTabState(global, { walletReplace: { status: 'error', error } }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, { walletReplace: { status: 'done' } }, tabId);
  setGlobal(global);
  actions.showNotification({ message: { key: 'WalletPhraseKept' }, tabId });
});

// A phrase goes stale once the key is rotated on another device; the check derives keys, so it is kept per key
const savedWalletKeyChecks = new Map<string, { publicKey: string; isValid: boolean }>();

addActionHandler('loadSavedWallets', async (global): Promise<void> => {
  // The current wallet's phrase is stored like the saved ones
  const ownAddress = selectWalletAddress(global);
  const addresses = (await listWalletVaultSecrets(ACCOUNT_SLOT)).filter((address) => (
    address !== ownAddress && savedWalletKeyChecks.get(address)?.isValid !== false
  ));

  // Overlapping loads must not blank each other's balances
  global = getGlobal();

  const known = global.wallet?.savedWallets;

  global = updateWallet(global, {
    savedWallets: addresses.map((address) => ({
      address,
      balance: known?.find((wallet) => wallet.address === address)?.balance,
    })),
  });

  setGlobal(global);

  if (!addresses.length) return;

  const [balances, staleAddresses] = await Promise.all([
    callApi('fetchWalletBalances', { addresses }),
    findStaleSavedWallets(addresses),
  ]);
  if (!balances && !staleAddresses.length) return;

  global = getGlobal();

  // A wallet removed meanwhile must not come back with its balance
  global = updateWallet(global, {
    savedWallets: global.wallet?.savedWallets
      ?.filter((wallet) => !staleAddresses.includes(wallet.address))
      .map((wallet) => ({ ...wallet, balance: balances?.[wallet.address] ?? wallet.balance })),
  });

  setGlobal(global);
});

async function findStaleSavedWallets(addresses: string[]) {
  const publicKeys = await callApi('fetchWalletPublicKeys', { addresses });
  if (!publicKeys) return [];

  const staleAddresses = await Promise.all(Object.entries(publicKeys).map(async ([address, publicKey]) => {
    const known = savedWalletKeyChecks.get(address);

    if (known?.publicKey === publicKey) {
      return known.isValid ? undefined : address;
    }

    const secret = await readWalletVaultSecret(ACCOUNT_SLOT, address);
    if (!secret) return undefined;

    const isValid = await callApi('validateWalletPhrase', {
      words: decodeWords(secret), ownAddress: address, ownPublicKey: publicKey,
    });
    if (isValid === undefined) return undefined;

    savedWalletKeyChecks.set(address, { publicKey, isValid });

    return isValid ? undefined : address;
  }));

  return staleAddresses.filter(Boolean);
}

addActionHandler('removeSavedWallet', async (global, actions, payload): Promise<void> => {
  const { address } = payload;

  // A switch in another tab holds the lock of the wallet it replaces
  const ownAddress = selectWalletAddress(global);

  await navigator.locks.request(`${WALLET_BACKUP_LOCK_PREFIX}${ownAddress || address}`, async () => {
    global = getGlobal();

    if (selectWalletAddress(global) === address) return;

    await removeWalletVaultSecret(ACCOUNT_SLOT, address);
  });

  actions.loadSavedWallets();
});

// A phrase left behind by a rotation on another device no longer signs; the check derives keys, so it is kept per key
let validLocalSecretKey: string | undefined;

async function checkLocalSecret(address: string, publicKey: string | undefined): Promise<boolean> {
  if (!await hasWalletVaultSecret(ACCOUNT_SLOT, address)) return false;

  if (!publicKey) return true;

  const cacheKey = `${address}:${publicKey}`;
  if (validLocalSecretKey === cacheKey) return true;

  const secret = await readWalletVaultSecret(ACCOUNT_SLOT, address);
  if (!secret) return false;

  const isValid = await callApi('validateWalletPhrase', {
    words: decodeWords(secret), ownAddress: address, ownPublicKey: publicKey,
  });

  // A check the worker could not run is no proof of a stale phrase, so the phrase stays counted and nothing is
  // cached: a logout would otherwise delete it without the warning
  if (isValid === undefined) return true;

  if (isValid) validLocalSecretKey = cacheKey;

  return isValid;
}

let lastWalletStateRequestId = 0;

addActionHandler('loadWalletState', async (global): Promise<void> => {
  const requestId = ++lastWalletStateRequestId;
  const result = await callApi('fetchWalletState');

  if (!result) {
    // The phrase is checked against the cached wallet, so the logout warning can count its last known balance offline
    const cachedState = global.wallet?.state;
    const hasLocalSecret = cachedState?.address
      ? await checkLocalSecret(cachedState.address, cachedState.publicKey) : undefined;
    if (requestId !== lastWalletStateRequestId) return;

    global = getGlobal();
    global = updateWallet(global, { hasStateError: true, hasLocalSecret });
    setGlobal(global);
    return;
  }

  const hasLocalSecret = result.state?.address
    ? await checkLocalSecret(result.state.address, result.state.publicKey) : false;
  if (requestId !== lastWalletStateRequestId) return;

  global = getGlobal();

  // The wallet may have been replaced on another device; its records must not pass to the new one
  const previousAddress = global.wallet?.state?.address;

  if (previousAddress && result.state?.address !== previousAddress) {
    global = clearWalletRecords(global);
  }

  // `state` is passed even when absent, so a wallet that went away does not keep its last balance
  global = updateWalletServerState(global, result.status, result.state);
  global = updateWallet(global, { hasLocalSecret, hasStateError: false });
  setGlobal(global);
});

addActionHandler('openWalletTransaction', async (global, actions, payload): Promise<void> => {
  const { transactionId, tabId = getCurrentTabId() } = payload;

  if (!global.appConfig.isWalletAvailable) {
    actions.showNotification({ message: { key: 'WalletUnavailable' }, tabId });
    return;
  }

  if (selectTabState(global, tabId).loadingWalletTransactionId === transactionId) return;

  // The suggestion arrives with the first transfer's service message, so an unknown one is refreshed first
  const isIntroKnown = Boolean(global.promoData?.pendingSuggestions.includes(WALLET_FIRST_TRANSFER_SUGGESTION)
    || global.promoData?.dismissedSuggestions.includes(WALLET_FIRST_TRANSFER_SUGGESTION));

  if (!isIntroKnown) {
    await getPromiseActions().loadPromoData();
    global = getGlobal();
  }

  const shouldShowIntro = global.promoData?.pendingSuggestions.includes(WALLET_FIRST_TRANSFER_SUGGESTION);
  const ownAddress = selectWalletAddress(global);

  const isKnown = Boolean(global.wallet?.loadedTransactions?.[transactionId])
    || Boolean(global.wallet?.transactions?.some(({ id }) => id === transactionId));

  if (isKnown) {
    // Otherwise a transaction still being fetched would open the modal again, over this one
    global = updateTabState(global, { loadingWalletTransactionId: undefined }, tabId);
    setGlobal(global);
    actions.openWalletModal({ initialTransactionId: transactionId, shouldShowIntro, tabId });
    return;
  }

  global = updateTabState(global, { loadingWalletTransactionId: transactionId }, tabId);
  setGlobal(global);

  const result = await callApi('fetchWalletTransactionsByIds', { ids: [transactionId] });
  const transaction = result?.transactions[0];

  global = getGlobal();

  if (result) global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  if (selectTabState(global, tabId).loadingWalletTransactionId !== transactionId) {
    setGlobal(global);
    return;
  }

  global = updateTabState(global, { loadingWalletTransactionId: undefined }, tabId);

  if (selectWalletAddress(global) !== ownAddress) {
    setGlobal(global);
    return;
  }

  // The server knows only the current wallet's transfers
  if (!transaction) {
    setGlobal(global);

    actions.showNotification({
      message: { key: 'WalletTransactionNotFound' }, duration: NOT_FOUND_NOTIFICATION_DURATION, tabId,
    });
    return;
  }

  global = updateWallet(global, {
    loadedTransactions: { ...global.wallet?.loadedTransactions, [transactionId]: transaction },
  });

  setGlobal(global);

  actions.openWalletModal({ initialTransactionId: transactionId, shouldShowIntro, tabId });
});

addActionHandler('loadExistingWaltBalance', async (global): Promise<void> => {
  const result = await callApi('fetchExistingWaltBalance');
  if (!result) return;

  global = getGlobal();
  global = updateWallet(global, { existingWaltBalanceUrl: result.hasBalance ? result.url : undefined });
  setGlobal(global);
});

addActionHandler('watchWalletActivity', async (global): Promise<void> => {
  const address = selectWalletAddress(global);
  if (!address) return;

  await callApi('watchWalletActivity', { address });
});

addActionHandler('unwatchWalletActivity', async (global): Promise<void> => {
  // Every tab shares the one socket, so it only closes once the wallet is open in none of them
  if (Object.values(global.byTabId).some((tab) => tab.walletModal)) return;

  await callApi('unwatchWalletActivity');
});

// The answer lands as `updateWalletGaslessInfo`
addActionHandler('loadWalletGaslessInfo', async (): Promise<void> => {
  await callApi('fetchWalletGaslessInfo');
});

let lastTransactionsRefreshId = 0;

addActionHandler('loadWalletTransactions', async (global, actions, payload): Promise<void> => {
  const { shouldRefresh } = payload || {};

  const ownAddress = selectWalletAddress(global);
  const offset = shouldRefresh ? '' : global.wallet?.nextOffset;

  // No cursor means the history is fully loaded; an empty one is the stale marker from the cache
  if (!offset && !shouldRefresh) return;

  const refreshId = shouldRefresh ? ++lastTransactionsRefreshId : undefined;

  const result = await callApi('fetchWalletTransactions', { offset });
  if (!result) return;

  if (refreshId !== undefined && refreshId !== lastTransactionsRefreshId) return;

  global = getGlobal();

  if (selectWalletAddress(global) !== ownAddress) return;

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  if (!shouldRefresh && global.wallet?.nextOffset !== offset) return;

  const current = global.wallet?.transactions || [];
  const page = filterDustTransactions(result.transactions, global.appConfig.walletTransferMinNanos);
  const freshIds = new Set(page.map(({ id }) => id));
  let transactions: ApiWalletTransaction[];
  let { nextOffset } = result;

  if (shouldRefresh) {
    // Loaded pages are kept while the fresh page still overlaps them, so a refresh does not reset the scroll
    const isTailKept = global.wallet?.nextOffset !== ''
      && current.some(({ id, msgHash }) => !msgHash && freshIds.has(id));
    const tail = isTailKept ? current.filter(({ id, msgHash }) => !msgHash && !freshIds.has(id)) : [];
    transactions = mergeLocalTransactions(current, page).concat(tail);

    if (isTailKept) nextOffset = global.wallet!.nextOffset;
  } else {
    transactions = current.concat(page);
  }

  global = updateWallet(global, { transactions, nextOffset });
  setGlobal(global);

  // A page filtered out entirely as dust would stall the paging
  if (!page.length && nextOffset) {
    actions.loadWalletTransactions();
  }

  if (!shouldRefresh) return;

  // A local record the fresh page does not list is resolved by its message hash
  const unresolved = transactions.filter(({ id, isPending, msgHash }) => isPending && msgHash && !freshIds.has(id));

  for (const { id, msgHash } of unresolved) {
    const confirmed = await lookupSentTransaction(msgHash!);
    if (!confirmed) continue;

    global = getGlobal();

    if (selectWalletAddress(global) !== ownAddress) return;

    global = replacePendingWalletTransaction(global, id, { ...confirmed, msgHash });
    setGlobal(global);
  }
});

// Only incoming transfers under the server's threshold count as dust
function filterDustTransactions(transactions: ApiWalletTransaction[], minAmount?: bigint) {
  if (!minAmount) return transactions;

  return transactions.filter(({ amount, isIncoming, isKeyChange, collectible }) => (
    !isIncoming || isKeyChange || collectible || amount >= minAmount
  ));
}

// An item already listed is updated in place; new ones keep the server's order
function mergeCollectibles(list: ApiWalletCollectible[], page: ApiWalletCollectible[]) {
  const merged = list.slice();
  const indexByAddress = new Map(merged.map(({ address }, index) => [address, index]));

  page.forEach((item) => {
    const index = indexByAddress.get(item.address);

    if (index === undefined) {
      indexByAddress.set(item.address, merged.length);
      merged.push(item);
    } else {
      merged[index] = item;
    }
  });

  return merged;
}

let lastCollectiblesRefreshId = 0;

addActionHandler('loadWalletCollectibles', async (global, actions, payload): Promise<void> => {
  const { shouldRefresh } = payload || {};

  const ownerAddress = selectWalletAddress(global);
  if (!ownerAddress) return;

  const offset = shouldRefresh ? undefined : global.wallet?.collectiblesNextOffset;
  if (!shouldRefresh && offset === undefined) return;

  const previousCollectibles = global.wallet?.collectibles;
  const refreshId = shouldRefresh ? ++lastCollectiblesRefreshId : undefined;
  // While this request is executing, another one might complete earlier; since this result
  // was generated based on the previous state of the list, data loss will occur.
  const isOutdated = (current: GlobalState) => (
    current.wallet?.collectibles !== previousCollectibles || (shouldRefresh && refreshId !== lastCollectiblesRefreshId)
  );

  const result = await callApi('fetchWalletCollectibles', { offset });
  if (!result) return;

  let collectibles = mergeCollectibles(shouldRefresh ? [] : previousCollectibles || [], result.collectibles);
  let { nextOffset } = result;

  // Every loaded page is refreshed, so ownership changes remove items without discarding the tail
  while (shouldRefresh && nextOffset !== undefined && collectibles.length < (previousCollectibles?.length || 0)) {
    global = getGlobal();

    if (selectWalletAddress(global) !== ownerAddress || isOutdated(global)) return;

    const nextPage = await callApi('fetchWalletCollectibles', { offset: nextOffset });
    if (!nextPage) return;

    collectibles = mergeCollectibles(collectibles, nextPage.collectibles);
    nextOffset = nextPage.nextOffset;
  }

  global = getGlobal();

  if (selectWalletAddress(global) !== ownerAddress || isOutdated(global)) return;

  if (!shouldRefresh && global.wallet?.collectiblesNextOffset !== offset) return;

  global = updateWallet(global, { collectibles, collectiblesNextOffset: nextOffset });
  setGlobal(global);
});

let lastUserLookupId = 0;
const latestUserLookupIds = new Map<string, number>();

addActionHandler('loadWalletUserAddresses', async (global, actions, payload): Promise<void> => {
  const { userIds, addresses, isForced } = payload;
  const unknownAddresses = addresses?.map(toNonBounceableAddress)
    .filter((address) => global.wallet?.resolvedAddresses?.[address] === undefined);
  if (!userIds?.length && !unknownAddresses?.length) return;

  const lookupId = ++lastUserLookupId;
  userIds?.forEach((userId) => latestUserLookupIds.set(userId, lookupId));

  // A forced lookup starts from nothing: an answer that never comes must not leave the address of a wallet the user
  // may have replaced
  if (isForced && userIds?.length) {
    global = updateWallet(global, { userAddresses: omit(global.wallet?.userAddresses || {}, userIds) });
    setGlobal(global);
  }

  const result = await callApi('fetchWalletUserAddresses', { userIds, addresses: unknownAddresses, isForced });
  if (!result || 'error' in result) return;

  // An older answer landing after a newer one would bring a replaced wallet back, so the newest lookup of a user
  // stays on record
  const byUserId = Object.fromEntries(Object.entries(result.byUserId)
    .filter(([userId]) => (latestUserLookupIds.get(userId) ?? 0) <= lookupId));

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  global = updateWallet(global, {
    userAddresses: { ...global.wallet?.userAddresses, ...byUserId },
    resolvedAddresses: { ...global.wallet?.resolvedAddresses, ...result.byAddress },
  });

  setGlobal(global);
});

const lastRecipientSearchIdByTab: Record<number, number> = {};

// The chat search also finds users by username outside the contacts and the chat list
addActionHandler('searchWalletRecipients', async (global, actions, payload): Promise<void> => {
  const { query, tabId = getCurrentTabId() } = payload;
  const searchId = (lastRecipientSearchIdByTab[tabId] || 0) + 1;
  lastRecipientSearchIdByTab[tabId] = searchId;

  const result = await callApi('searchChats', { query });
  if (!result || searchId !== lastRecipientSearchIdByTab[tabId]) return;

  global = getGlobal();
  global = updateTabState(global, {
    walletRecipientSearch: {
      query,
      localUserIds: result.accountResultIds.filter(isUserId),
      globalUserIds: result.globalResultIds.filter(isUserId),
    },
  }, tabId);
  setGlobal(global);
});

const lastDomainLookupIdByTab: Record<number, number> = {};

// The record can change hands, so every lookup asks the server. The stored answer is dropped meanwhile: shown
// during the wait, it could be picked and sent to before the fresh one corrects it.
addActionHandler('loadWalletDomainAddress', async (global, actions, payload): Promise<void> => {
  const { domain, tabId = getCurrentTabId() } = payload;
  const lookupId = (lastDomainLookupIdByTab[tabId] || 0) + 1;
  lastDomainLookupIdByTab[tabId] = lookupId;

  global = updateTabState(global, { walletDomainLookup: { domain } }, tabId);
  setGlobal(global);

  const address = await callApi('fetchWalletDomainAddress', { domain });

  // An older answer landing after a newer one would bring the former owner back
  if (lookupId !== lastDomainLookupIdByTab[tabId]) return;

  global = getGlobal();
  global = updateTabState(global, {
    walletDomainLookup: { domain, address, isFailed: address === undefined ? true : undefined },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openWalletTransferLink', async (global, actions, payload): Promise<void> => {
  const {
    to, userId: linkUserId, amount, comment, isCommentEncrypted, shouldCloseAfterSend,
    tabId = getCurrentTabId(),
  } = payload;

  if (!to && !linkUserId) {
    actions.openWalletModal({ tabId });
    return;
  }

  let recipient = to || '';

  if (linkUserId || to!.startsWith('@')) {
    const chat = linkUserId ? undefined : await fetchChatByUsername(global, to!.slice(1));
    const userId = linkUserId || (chat && isUserId(chat.id) ? chat.id : undefined);
    const result = userId
      ? await callApi('fetchWalletUserAddresses', { userIds: [userId], isForced: true })
      : undefined;

    // The server shows its own popup about a user without access to the wallet
    if (result && 'error' in result) return;

    recipient = result?.byUserId[userId!] || '';

    if (!recipient) {
      actions.showNotification({ message: { key: 'WalletLinkNoWallet' }, tabId });
      return;
    }
  } else if (!parseTonTransferAddress(to!)) {
    actions.showNotification({ message: { key: 'WalletSendInvalidAddress' }, tabId });
    return;
  }

  actions.openWalletModal({
    initialRecipient: recipient,
    initialAmount: amount,
    initialComment: comment,
    isInitialCommentEncrypted: isCommentEncrypted,
    shouldCloseAfterSend,
    tabId,
  });
});

addActionHandler('loadOnrampProviders', async (global): Promise<void> => {
  const result = await callApi('fetchOnrampProviders');
  if (!result) return;

  global = getGlobal();
  global = updateWallet(global, { onrampProviders: result });
  setGlobal(global);
});

// The API takes fiat codes in lowercase ISO 4217
function resolveBuyBaseCurrency(
  providerInfo: ApiOnrampProvider | undefined, baseCurrencies: string[] | undefined, walletCurrency: string,
): string {
  const preferred = walletCurrency.toLowerCase();

  if (!providerInfo?.hasBaseCurrencies || !baseCurrencies?.length) {
    return preferred;
  }

  return baseCurrencies.includes(preferred) ? preferred : baseCurrencies[0];
}

addActionHandler('loadWalletBuyContext', async (global, actions, payload): Promise<void> => {
  const { provider, tabId = getCurrentTabId() } = payload;

  const providerInfo = selectOnrampProvider(global, provider);

  global = updateTabState(global, { walletBuy: { provider, status: 'loading', baseCurrency: '' } }, tabId);
  setGlobal(global);

  const baseCurrencies = providerInfo?.hasBaseCurrencies
    ? await callApi('fetchOnrampBaseCurrencies', { provider })
    : undefined;

  global = getGlobal();

  if (selectTabState(global, tabId).walletBuy?.provider !== provider) return;

  const baseCurrency = resolveBuyBaseCurrency(providerInfo, baseCurrencies || undefined, selectWalletCurrency(global));

  // The server rejects a method under another currency with `ONRAMP_PAYMENT_METHOD_INVALID`
  const availability = await callApi('fetchOnrampAvailability', { provider, baseCurrency });

  global = getGlobal();

  if (selectTabState(global, tabId).walletBuy?.provider !== provider) return;

  if (!availability?.isBuyAllowed) {
    global = updateTabState(global, {
      walletBuy: {
        provider, status: 'unavailable', baseCurrency, availability: availability || undefined,
      },
    }, tabId);

    setGlobal(global);
    return;
  }

  const limits = providerInfo?.hasLimits
    ? await callApi('fetchOnrampLimits', { provider, baseCurrency })
    : undefined;

  global = getGlobal();

  if (selectTabState(global, tabId).walletBuy?.provider !== provider) return;

  global = updateTabState(global, {
    walletBuy: {
      provider,
      status: 'ready',
      baseCurrency,
      availability,
      baseCurrencies: baseCurrencies || undefined,
      limits: limits || undefined,
    },
  }, tabId);

  setGlobal(global);
});

addActionHandler('setWalletBuyCurrency', async (global, actions, payload): Promise<void> => {
  const { baseCurrency, tabId = getCurrentTabId() } = payload;

  const walletBuy = selectTabState(global, tabId).walletBuy;
  if (!walletBuy || walletBuy.status === 'loading' || walletBuy.baseCurrency === baseCurrency) return;

  const { provider } = walletBuy;
  const providerInfo = selectOnrampProvider(global, provider);

  global = updateTabState(global, {
    walletBuy: {
      ...walletBuy, status: 'loading', baseCurrency, availability: undefined, limits: undefined, quote: undefined,
    },
  }, tabId);

  setGlobal(global);

  const availability = await callApi('fetchOnrampAvailability', { provider, baseCurrency });
  const limits = providerInfo?.hasLimits
    ? await callApi('fetchOnrampLimits', { provider, baseCurrency })
    : undefined;

  global = getGlobal();

  const current = selectTabState(global, tabId).walletBuy;
  if (!current || current.provider !== provider || current.baseCurrency !== baseCurrency) return;

  if (!availability?.isBuyAllowed) {
    global = updateTabState(global, {
      walletBuy: {
        provider, status: 'unavailable', baseCurrency, availability,
      },
    }, tabId);

    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    walletBuy: {
      ...current, status: 'ready', availability, limits: limits || undefined,
    },
  }, tabId);

  setGlobal(global);
});

const lastLimitsRequestIdByTab: Record<number, number> = {};

// A provider may set different limits for a card and a bank transfer
addActionHandler('loadOnrampLimits', async (global, actions, payload): Promise<void> => {
  const { paymentMethod, tabId = getCurrentTabId() } = payload;

  const walletBuy = selectTabState(global, tabId).walletBuy;
  if (!walletBuy || walletBuy.status !== 'ready') return;

  const { provider, baseCurrency } = walletBuy;

  global = updateTabState(global, { walletBuy: { ...walletBuy, limits: undefined, quote: undefined } }, tabId);
  setGlobal(global);

  if (!selectOnrampProvider(global, provider)?.hasLimits) return;

  const requestId = (lastLimitsRequestIdByTab[tabId] || 0) + 1;
  lastLimitsRequestIdByTab[tabId] = requestId;

  const limits = await callApi('fetchOnrampLimits', { provider, baseCurrency, paymentMethod });

  global = getGlobal();

  const current = selectTabState(global, tabId).walletBuy;

  if (requestId !== lastLimitsRequestIdByTab[tabId] || !current || current.provider !== provider
    || current.baseCurrency !== baseCurrency) return;

  global = updateTabState(global, { walletBuy: { ...current, limits: limits || undefined } }, tabId);
  setGlobal(global);
});

const lastQuoteRequestIdByTab: Record<number, number> = {};

addActionHandler('loadOnrampQuote', async (global, actions, payload): Promise<void> => {
  const {
    baseCurrency, baseAmount, cryptoAmount, paymentMethod, tabId = getCurrentTabId(),
  } = payload;

  const walletBuy = selectTabState(global, tabId).walletBuy;
  if (!walletBuy) return;

  const { provider } = walletBuy;

  const requestId = (lastQuoteRequestIdByTab[tabId] || 0) + 1;
  lastQuoteRequestIdByTab[tabId] = requestId;

  global = updateTabState(global, {
    walletBuy: { ...walletBuy, isQuoteLoading: true, hasQuoteError: false },
  }, tabId);

  setGlobal(global);

  const quote = await callApi('fetchOnrampQuote', {
    provider, baseCurrency, baseAmount, cryptoAmount, paymentMethod,
  });

  global = getGlobal();

  const current = selectTabState(global, tabId).walletBuy;

  if (requestId !== lastQuoteRequestIdByTab[tabId] || !current || current.provider !== provider
    || current.baseCurrency !== baseCurrency) return;

  global = updateTabState(global, {
    walletBuy: {
      ...current,
      quote,
      quoteBaseAmount: baseAmount,
      quotePaymentMethod: paymentMethod,
      isQuoteLoading: false,
      hasQuoteError: !quote,
    },
  }, tabId);

  setGlobal(global);
});

addActionHandler('openOnrampSession', async (global, actions, payload): Promise<void> => {
  const {
    provider, baseCurrency, baseAmount, paymentMethod, tabId = getCurrentTabId(),
  } = payload;

  const ownAddress = selectWalletAddress(global);
  if (!ownAddress) return;

  const session = await callApi('createOnrampSession', {
    provider, ownAddress, baseCurrency, baseAmount, paymentMethod, theme: selectTheme(global),
  });

  if (!session) {
    actions.showNotification({ message: { key: 'WalletBuyError' }, tabId });
    return;
  }

  global = getGlobal();

  if (selectWalletAddress(global) !== ownAddress) return;

  // A Telegram link opens a mini app, and the wallet dialog would cover it
  if (isDeepLink(session.url)) {
    actions.closeWalletModal({ tabId });
  }

  actions.openUrl({ url: session.url, shouldSkipModal: true, tabId });
});

const lastFeeRequestIdByTab: Record<number, number> = {};

addActionHandler('loadWalletTransferFee', async (global, actions, payload): Promise<void> => {
  const {
    toAddress, amount, comment, shouldEncryptComment, shouldSendAll, collectibleAddress, tabId = getCurrentTabId(),
  } = payload;

  const state = global.wallet?.state;
  if (!state) return;

  const requestId = (lastFeeRequestIdByTab[tabId] || 0) + 1;
  lastFeeRequestIdByTab[tabId] = requestId;

  global = updateTabState(global, { walletTransferFee: { isLoading: true } }, tabId);
  setGlobal(global);

  const estimate = await callApi('estimateWalletTransferFee', {
    ownAddress: state.address,
    publicKey: state.publicKey,
    toAddress,
    amount,
    comment,
    shouldEncryptComment,
    shouldSendAll,
    collectibleAddress,
  });

  global = getGlobal();

  if (requestId !== lastFeeRequestIdByTab[tabId] || !selectTabState(global, tabId).walletTransferFee?.isLoading) return;

  global = updateTabState(global, {
    walletTransferFee: {
      key: buildWalletTransferFeeKey(payload),
      fee: estimate?.fee,
      canEncryptComment: estimate?.canEncryptComment,
      canUseRelayer: estimate?.canUseRelayer,
      isFailed: estimate ? undefined : true,
    },
  }, tabId);

  setGlobal(global);
});

const lastMnemonicRequestIdByTab: Record<number, number> = {};

addActionHandler('loadWalletMnemonic', async (global, actions, payload): Promise<void> => {
  const {
    password, passcode, savedAddress, tabId = getCurrentTabId(),
  } = payload || {};

  const ownAddress = savedAddress || selectWalletAddress(global);

  // A saved wallet has no server key to check the phrase against
  const ownPublicKey = savedAddress ? undefined : selectWalletPublicKey(global);
  if (!ownAddress || (savedAddress && !passcode)) return;

  const requestId = (lastMnemonicRequestIdByTab[tabId] || 0) + 1;
  lastMnemonicRequestIdByTab[tabId] = requestId;
  global = updateTabState(global, { walletMnemonic: { status: 'pending' } }, tabId);
  setGlobal(global);

  let result: ExportSecretPhraseResult | undefined;

  try {
    const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

    result = 'error' in secret
      ? secret
      : await callApi('exportWalletSecretPhrase', {
        ownAddress, ownPublicKey, words: secret.words, password,
      });
  } catch {
    result = undefined;
  }

  global = getGlobal();

  if (requestId !== lastMnemonicRequestIdByTab[tabId]
    || selectTabState(global, tabId).walletMnemonic?.status !== 'pending') return;

  const isSameWallet = savedAddress
    || (selectWalletAddress(global) === ownAddress && selectWalletPublicKey(global) === ownPublicKey);

  if (!isSameWallet) {
    result = { error: 'EXPORT_FAILED' };
  }

  if (!result || 'error' in result) {
    const error = result ? result.error : 'EXPORT_FAILED';
    global = updateTabState(global, { walletMnemonic: { status: 'error', error } }, tabId);
    setGlobal(global);

    // Without a credential screen the error has nowhere to go but a toast
    if (!passcode && !password && error !== 'PASSWORD_MISSING') {
      actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS[error] }, tabId });
    }
    return;
  }

  global = updateTabState(global, { walletMnemonic: { status: 'ready', words: result.words } }, tabId);
  setGlobal(global);
});

addActionHandler('enableWalletBackup', async (global, actions, payload): Promise<void> => {
  const { words, passcode, tabId = getCurrentTabId() } = payload;

  const ownAddress = selectWalletAddress(global);
  if (!ownAddress) return;

  global = updateTabState(global, { walletBackup: { status: 'pending' } }, tabId);
  setGlobal(global);

  // `EnableBackup` backs up whichever wallet is current, so the lock keeps a swap out of the flow
  let result: WalletBackupResult | undefined;

  await navigator.locks.request(`${WALLET_BACKUP_LOCK_PREFIX}${ownAddress}`, async () => {
    try {
      global = getGlobal();

      const currentPublicKey = selectWalletPublicKey(global);

      if (selectWalletAddress(global) !== ownAddress || !currentPublicKey) {
        result = { error: 'BACKUP_FAILED' };
        return;
      }

      const secret = words
        ? { words }
        : passcode ? await readLocalSecret(passcode, ownAddress) : { error: 'NO_LOCAL_SECRET' as const };

      result = 'error' in secret
        ? secret
        : await callApi('enableWalletBackup', { words: secret.words, ownAddress });
    } catch {
      result = undefined;
    }
  });

  global = getGlobal();

  // The server has flipped the backup even for a cancelled flow
  if (result && !('error' in result) && selectWalletAddress(global) === ownAddress) {
    global = updateWalletServerState(global, result.state.status, result.state.state);
  }

  if (selectTabState(global, tabId).walletBackup?.status !== 'pending') {
    setGlobal(global);
    return;
  }

  if (!result || 'error' in result) {
    const error = result ? result.error : 'BACKUP_FAILED';
    global = updateTabState(global, { walletBackup: { status: 'error', error } }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, { walletBackup: { status: 'done' } }, tabId);
  setGlobal(global);

  actions.showNotification({
    title: { key: 'WalletBackupEnabledTitle' },
    message: { key: 'WalletBackupEnabledText' },
    tabId,
  });
});

addActionHandler('disableWalletBackup', async (global, actions, payload): Promise<void> => {
  const {
    fromAddress, shouldRotateKey, password, tabId = getCurrentTabId(),
  } = payload;

  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);

  // Without the phrase under the passcode the wallet would be left keyless
  if (!ownAddress || !ownPublicKey || !global.passcode.hasPasscode) return;

  if (ownAddress !== fromAddress) {
    global = updateTabState(global, { walletBackup: { status: 'error', error: 'WALLET_CHANGED' } }, tabId);
    setGlobal(global);
    actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS.WALLET_CHANGED }, tabId });
    return;
  }

  global = updateTabState(global, { walletBackup: { status: 'pending' } }, tabId);
  setGlobal(global);

  // Serialized across tabs: a rotation in another tab would roll back this tab's phrase on its own failure
  let result: RotateWalletKeyResult | undefined;
  let words: string[] | undefined;

  await navigator.locks.request(`${WALLET_BACKUP_LOCK_PREFIX}${ownAddress}`, async () => {
    try {
      // Read under the lock: another tab may have rotated the key meanwhile
      global = getGlobal();

      const currentPublicKey = selectWalletPublicKey(global);
      if (selectWalletAddress(global) !== ownAddress || !currentPublicKey) return;

      const local = await readWalletVaultSecret(ACCOUNT_SLOT, ownAddress);
      const exported = await callApi('exportWalletSecretPhrase', {
        ownAddress, ownPublicKey: currentPublicKey, password,
      });

      if (!exported || 'error' in exported) {
        result = exported;
        return;
      }

      // A local phrase other than the backed-up one is left by a rotation that did not finish; it is finished first
      const localWords = local ? decodeWords(local) : undefined;
      const candidateWords = localWords?.join(' ') !== exported.words.join(' ') ? localWords : undefined;

      // A phrase the chain does not know is a stale copy from a rotation made on another device
      const chainPublicKey = candidateWords ? await callApi('fetchWalletChainPublicKey', { ownAddress }) : undefined;
      const isCandidateCurrent = candidateWords && chainPublicKey ? await callApi('validateWalletPhrase', {
        words: candidateWords, ownAddress, ownPublicKey: chainPublicKey,
      }) : undefined;

      // Without the chain's answer, the stale and the current copy cannot be told apart. The branches below would
      // overwrite the local one, so the flow stops before touching the vault.
      if (candidateWords && isCandidateCurrent === undefined) {
        result = { error: 'BACKUP_FAILED' };
        return;
      }

      const resumedWords = isCandidateCurrent ? candidateWords : undefined;

      if (resumedWords) {
        words = resumedWords;

        const inFlight = selectWalletTransferInFlight(global);

        result = await callApi('rotateWalletKey', {
          ownAddress,
          words: exported.words,
          newWords: words,
          pendingSeqno: inFlight?.seqno,
          pendingValidUntil: inFlight?.validUntil,
        });
      } else if (shouldRotateKey) {
        const { generateBip39Mnemonic, PHRASE_WORD_COUNT } = await import('../../../lib/ton/bip39');
        words = [...exported.words.slice(0, PHRASE_WORD_COUNT), ...(await generateBip39Mnemonic())];
        result = await rotateWalletKey(ownAddress, exported.words, words, Boolean(local));
      } else {
        words = exported.words;
        await encryptWordsIntoVault(words, ownAddress);

        result = await callApi('disableWalletBackup', {
          ownAddress, ownPublicKey: currentPublicKey, words, password,
        });
      }
    } catch {
      result = undefined;
    }
  });

  global = getGlobal();

  // The server has flipped the backup even for a cancelled flow
  const isSameWallet = selectWalletAddress(global) === ownAddress;

  if (result && !('error' in result) && isSameWallet) {
    global = updateWalletServerState(global, result.state.status, result.state.state);
  }

  // A phrase that went out to the chain stays on the device even when the flow failed after that
  if (result && (!('error' in result) || result.isSent) && isSameWallet) {
    global = updateWallet(global, { hasLocalSecret: true });
  }

  if (selectTabState(global, tabId).walletBackup?.status !== 'pending') {
    setGlobal(global);
    return;
  }

  if (!result || 'error' in result) {
    const error = result ? result.error : 'BACKUP_FAILED';
    global = updateTabState(global, { walletBackup: { status: 'error', error } }, tabId);
    setGlobal(global);

    // Only the password errors have a screen of their own
    if (error !== 'PASSWORD_MISSING' && error !== 'PASSWORD_INVALID') {
      actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS[error] }, tabId });
    }
    return;
  }

  global = updateTabState(global, {
    walletBackup: { status: 'done' },
    walletMnemonic: { status: 'ready', words: words! },
  }, tabId);

  setGlobal(global);

  // The rotating device still has the fresh phrase, so it can close sessions without keeping their keys
  if (shouldRotateKey && result.state.state) {
    await callApi('finishTonConnectKeyRotation', {
      ownAddress, ownPublicKey: result.state.state.publicKey, words: words!,
    });
  }
});

addActionHandler('loadWalletKeyRotationFee', async (global): Promise<void> => {
  const ownAddress = selectWalletAddress(global);
  if (!ownAddress) return;

  const keyRotationFee = await callApi('estimateWalletKeyRotationFee', { ownAddress });
  if (keyRotationFee === undefined) return;

  global = getGlobal();

  if (selectWalletAddress(global) !== ownAddress) return;

  global = updateWallet(global, { keyRotationFee });
  setGlobal(global);
});

addActionHandler('sendWalletTransfer', async (global, actions, payload): Promise<void> => {
  const {
    fromAddress, toAddress, toUserId, amount, comment, shouldEncryptComment, shouldSendAll, collectibleAddress,
    isGasless, password, passcode, tabId = getCurrentTabId(),
  } = payload;

  const ownAddress = selectWalletAddress(global);
  if (!ownAddress) return;

  if (selectTabState(global, tabId).walletTransfer?.status === 'pending') return;

  if (ownAddress !== fromAddress) {
    global = updateTabState(global, { walletTransfer: { status: 'error', error: 'WALLET_CHANGED' } }, tabId);
    setGlobal(global);
    actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS.WALLET_CHANGED }, tabId });
    return;
  }

  const inFlight = selectWalletTransferInFlight(global);

  // The Android app adds no pending message for a collectible or for a transfer to the current user
  const chat = toUserId && toUserId !== global.currentUserId && !collectibleAddress
    ? selectChat(global, toUserId)
    : undefined;

  global = updateTabState(global, { walletTransfer: { status: 'pending' } }, tabId);
  setGlobal(global);

  let result: SendTonTransferResult | undefined;
  let isShownInChat = false;

  try {
    const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

    result = 'error' in secret
      ? secret
      : await callApi('sendTonTransfer', {
        toAddress,
        toUser: toUserId ? selectUser(global, toUserId) : undefined,
        chat,
        lastMessageId: chat && selectChatLastMessageId(global, chat.id),
        amount,
        comment,
        shouldEncryptComment,
        shouldSendAll,
        collectibleAddress,
        isGasless,
        ownAddress,
        ownPublicKey: selectWalletPublicKey(global)!,
        pendingSeqno: inFlight?.seqno,
        pendingValidUntil: inFlight?.validUntil,
        words: secret.words,
        password,
      }, () => {
        isShownInChat = true;

        global = getGlobal();
        if (selectTabState(global, tabId).walletTransfer?.status !== 'pending') return;

        global = updateTabState(global, { walletTransfer: { status: 'pending', isShownInChat } }, tabId);
        setGlobal(global);
      });
  } catch (err: unknown) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[wallet] The transfer could not be sent', err);
    }

    result = undefined;
  }

  global = getGlobal();

  // A cancelled flow still sent the transfer, so its record and the fresh balance apply
  const isCancelled = selectTabState(global, tabId).walletTransfer?.status !== 'pending';

  // A wallet swapped meanwhile has a balance and history of its own
  const isSameWallet = selectWalletAddress(global) === ownAddress;

  if (!result || 'error' in result) {
    // The chat already shows the transfer, so the reason it failed is reported even after the wallet has closed
    if (isCancelled && !isShownInChat) return;

    const error: SendTonTransferError = result ? result.error : 'SEND_FAILED';

    if (!isCancelled) {
      global = updateTabState(global, { walletTransfer: { status: 'error', error } }, tabId);
      setGlobal(global);
    }

    if (error !== 'PASSWORD_INVALID' && error !== 'PASSWORD_MISSING' && error !== 'PASSCODE_INVALID') {
      actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS[error] }, tabId });
    }

    // The key was rotated on another device; the fresh state re-checks the stored phrase
    if (error === 'KEY_MISMATCH') {
      actions.loadWalletState();
    }
    return;
  }

  if (!isCancelled) {
    global = updateTabState(global, { walletTransfer: { status: 'sent' } }, tabId);
  }

  // The server learns about the transfer with a delay, so the amount is deducted now; `staleBalance` marks its view.
  // The item contract returns most of what a collectible transfer attaches, so only the forwarded part is deducted.
  // A self-transfer only costs the fees, so its balance is left for the server to update.
  const spentAmount = collectibleAddress ? NFT_TRANSFER_FORWARD_NANOS : amount;
  const isSelfTransfer = toNonBounceableAddress(toAddress) === toNonBounceableAddress(ownAddress);
  const walletState = isSameWallet && !isSelfTransfer ? global.wallet?.state : undefined;
  const collectible = collectibleAddress
    ? global.wallet?.collectibles?.find(({ address }) => address === collectibleAddress)
    : undefined;

  // The server lists the item until it indexes the transfer
  if (collectibleAddress && isSameWallet && !isSelfTransfer && global.wallet?.collectibles) {
    global = updateWallet(global, {
      collectibles: global.wallet.collectibles.filter(({ address }) => address !== collectibleAddress),
    });
  }

  if (walletState) {
    global = updateWallet(global, {
      state: {
        ...walletState,
        balance: walletState.balance > spentAmount ? walletState.balance - spentAmount : 0n,
      },
      staleBalance: {
        amount: global.wallet?.staleBalance?.amount ?? walletState.balance,
        expiresAt: getServerTime() + PENDING_TTL_SECONDS,
      },
    });
  }

  if (isSameWallet) {
    if (result.transaction) {
      global = replacePendingWalletTransaction(global, result.msgHash, {
        ...result.transaction, msgHash: result.msgHash,
      });
    } else {
      global = addPendingWalletTransaction(global, {
        id: result.msgHash,
        msgHash: result.msgHash,
        seqno: result.seqno,
        validUntil: result.validUntil,
        isIncoming: false,
        isPending: true,
        peer: { type: 'address', address: toAddress },
        // The server lists a collectible transfer with a zero amount as well
        amount: collectibleAddress ? 0n : amount,
        // The cache keeps pending records, so a private comment is held only encrypted, as the server lists it
        comment: result.encryptedComment ? undefined : comment,
        encryptedComment: result.encryptedComment,
        timestamp: getServerTime(),
        collectible,
      });
    }
  }

  setGlobal(global);

  actions.showNotification({
    message: {
      key: collectibleAddress ? 'WalletSendCollectibleSuccess'
        : result.isGasless ? 'WalletSendSuccessGasless' : 'WalletSendSuccess',
    },
    tabId,
  });

  actions.loadWalletState();

  if (result.transaction) return;

  // The hash stays on the record, so a refresh keeps it on top until the server lists it
  const confirmed = await fetchSentTransaction(result.msgHash);
  if (!confirmed) return;

  global = getGlobal();

  if (selectWalletAddress(global) !== ownAddress) return;

  global = replacePendingWalletTransaction(global, result.msgHash, { ...confirmed, msgHash: result.msgHash });
  setGlobal(global);
});

addActionHandler('decryptWalletComment', async (global, actions, payload): Promise<void> => {
  const {
    transactionId, password, passcode, tabId = getCurrentTabId(),
  } = payload;

  const ownAddress = selectWalletAddress(global);
  const transaction = global.wallet?.transactions?.find(({ id }) => id === transactionId)
    || Object.values(global.wallet?.loadedTransactions || {}).find(({ id }) => id === transactionId);
  if (!ownAddress || !transaction?.encryptedComment || transaction.peer.type === 'unsupported') return;

  // The comment is salted with the sender's address, which is ours for an outgoing transfer
  const saltAddress = transaction.isIncoming ? transaction.peer.address : ownAddress;

  global = updateTabState(global, { walletCommentDecryption: { transactionId, status: 'pending' } }, tabId);
  setGlobal(global);

  let result: DecryptWalletCommentResult | undefined;

  try {
    const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

    result = 'error' in secret
      ? secret
      : await callApi('decryptWalletComment', {
        encryptedComment: transaction.encryptedComment,
        saltAddress,
        ownAddress,
        ownPublicKey: selectWalletPublicKey(global)!,
        words: secret.words,
        password,
      });
  } catch {
    result = undefined;
  }

  global = getGlobal();

  const decryption = selectTabState(global, tabId).walletCommentDecryption;
  const isCancelled = decryption?.transactionId !== transactionId || decryption.status !== 'pending';

  if (!result || 'error' in result) {
    if (isCancelled) return;

    const error: DecryptWalletCommentError = result ? result.error : 'DECRYPT_FAILED';
    global = updateTabState(global, { walletCommentDecryption: { transactionId, status: 'error', error } }, tabId);
    setGlobal(global);

    if (error !== 'PASSWORD_INVALID' && error !== 'PASSWORD_MISSING' && error !== 'PASSCODE_INVALID') {
      actions.showNotification({ message: { key: WALLET_ERROR_LANG_KEYS[error] }, tabId });
    }
    return;
  }

  // The decrypted text is kept even for a cancelled flow: it belongs to the transaction, not the screen
  global = updateWallet(global, {
    decryptedComments: { ...global.wallet?.decryptedComments, [transactionId]: result.comment },
  });

  if (!isCancelled) {
    global = updateTabState(global, { walletCommentDecryption: undefined }, tabId);
  }

  setGlobal(global);
});

addActionHandler('dropWalletVaultSecrets', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  // Dropped in the same locked step as the passcode
  actions.closeWalletModal({ tabId });
  actions.clearPasscode({ shouldDropWalletKeys: true });
});

// Local records with a message hash stay on top until the server lists them or they expire
function mergeLocalTransactions(
  current: ApiWalletTransaction[] | undefined, confirmed: ApiWalletTransaction[],
): ApiWalletTransaction[] {
  const now = getServerTime();
  const confirmedIds = new Set(confirmed.map(({ id }) => id));

  const stillLocal = (current || []).filter(({ id, msgHash, timestamp }) => (
    msgHash && timestamp > now - PENDING_TTL_SECONDS && !confirmedIds.has(id)
  ));

  return stillLocal.concat(confirmed);
}

async function fetchSentTransaction(msgHash: string): Promise<ApiWalletTransaction | undefined> {
  for (let attempt = 0; attempt < SENT_LOOKUP_ATTEMPTS; attempt++) {
    const transaction = await lookupSentTransaction(msgHash);

    if (transaction) {
      return transaction;
    }

    await pause(Math.min(SENT_LOOKUP_MIN_DELAY_MS * 2 ** attempt, SENT_LOOKUP_MAX_DELAY_MS));
  }

  return undefined;
}

async function lookupSentTransaction(msgHash: string): Promise<ApiWalletTransaction | undefined> {
  const result = await callApi('fetchWalletTransactionsByMsgHash', { msgHashes: [msgHash] });
  if (!result) return undefined;

  let global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);

  return result.transactions[0];
}

type LocalSecret = { words?: string[] } | { error: ExportSecretPhraseError };

// Decrypted here, where the passcode key lives, and handed to the worker for one operation
export async function readLocalSecret(
  passcode: string, address: string,
): Promise<{ words: string[] } | { error: ExportSecretPhraseError }> {
  const passcodeError = await verifyPasscodeWithLimit(passcode);

  if (passcodeError) {
    return { error: passcodeError };
  }

  const secret = await readWalletVaultSecret(ACCOUNT_SLOT, address);

  return secret ? { words: decodeWords(secret) } : { error: 'NO_LOCAL_SECRET' };
}

async function replaceWalletWithSecrets({
  ownAddress, words, savedAddress, shouldSaveCurrent, password,
}: {
  ownAddress: string;
  words?: string[];
  savedAddress?: string;
  shouldSaveCurrent?: boolean;
  password?: string;
}): Promise<ReplaceWalletResult & { isPhraseLost?: boolean }> {
  if (shouldSaveCurrent) {
    const error = await saveCurrentWallet(ownAddress, password);

    if (error) {
      return { error };
    }
  }

  let importedWords = words;

  if (savedAddress) {
    const secret = await readWalletVaultSecret(ACCOUNT_SLOT, savedAddress);

    if (!secret) {
      return { error: 'NO_LOCAL_SECRET' };
    }

    importedWords = decodeWords(secret);
  }

  // Closing the sessions needs the old wallet's phrase, which the server no longer holds after the swap,
  // so a list that could not be read stops the swap
  const sessionsToClose = await fetchTonConnectSessionsToClose();
  if (!sessionsToClose) return { error: 'REPLACE_FAILED' };

  const oldWallet = sessionsToClose.length ? await readCurrentWalletCredentials(ownAddress, password) : undefined;

  let global = getGlobal();
  global = updateWallet(global, { isReplacing: true });
  setGlobal(global);

  let result: ReplaceWalletResult | undefined;

  try {
    result = await callApi('replaceWallet', { words: importedWords, password });
  } finally {
    global = getGlobal();
    global = updateWallet(global, { isReplacing: undefined });
    setGlobal(global);
  }

  if (!result || 'error' in result) {
    return result || { error: 'REPLACE_FAILED' };
  }

  if (oldWallet) {
    for (const session of sessionsToClose) {
      await callApi('disconnectTonConnectSession', { session, ...oldWallet });
    }
  }

  // The swap is done on the server; the housekeeping below must not turn it into a failure
  const newAddress = result.state.state?.address;
  let isPhraseLost = false;

  try {
    if (words && newAddress) {
      await encryptWordsIntoVault(words, newAddress);
    }
  } catch (err: unknown) {
    isPhraseLost = true;

    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[wallet] The new phrase could not be kept', err);
    }
  }

  try {
    if (!shouldSaveCurrent && newAddress !== ownAddress) {
      await removeWalletVaultSecret(ACCOUNT_SLOT, ownAddress);
    }
  } catch (err: unknown) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[wallet] The old phrase could not be cleared', err);
    }
  }

  return { ...result, isPhraseLost };
}

// The session keys derive from the old phrase; a phrase kept only on the device stays connected
async function fetchTonConnectSessionsToClose() {
  const global = getGlobal();
  const result = await callApi('fetchTonConnectSessions', { currentUserId: global.currentUserId! });
  if (!result || 'error' in result) return undefined;

  return result.sessions.filter((session) => !session.isClosed && !session.isPending);
}

async function readCurrentWalletCredentials(ownAddress: string, password: string | undefined) {
  const global = getGlobal();
  const ownPublicKey = selectWalletPublicKey(global);
  if (!ownPublicKey) return undefined;

  const secret = await checkLocalSecret(ownAddress, ownPublicKey)
    ? await readWalletVaultSecret(ACCOUNT_SLOT, ownAddress) : undefined;
  const exported = secret
    ? { words: decodeWords(secret) }
    : await callApi('exportWalletSecretPhrase', { ownAddress, ownPublicKey, password });
  if (!exported || 'error' in exported) return undefined;

  return {
    ownAddress, ownPublicKey, words: exported.words, password,
  };
}

// A stored phrase that no longer signs would leave the saved wallet unopenable, so the exported one replaces it
async function saveCurrentWallet(
  ownAddress: string, password: string | undefined,
): Promise<ReplaceWalletError | undefined> {
  const global = getGlobal();
  const ownPublicKey = selectWalletPublicKey(global);

  if (await checkLocalSecret(ownAddress, ownPublicKey)) {
    return undefined;
  }

  const exported = await callApi('exportWalletSecretPhrase', { ownAddress, ownPublicKey, password });

  if (!exported || 'error' in exported) {
    return exported ? exported.error : 'EXPORT_FAILED';
  }

  await encryptWordsIntoVault(exported.words, ownAddress);

  return undefined;
}

// The new phrase is stored before the request goes out: once it lands, nothing else signs
async function rotateWalletKey(
  ownAddress: string, words: string[], newWords: string[], hadLocalSecret: boolean,
): Promise<RotateWalletKeyResult | undefined> {
  // A TON-native wallet has no anchor half, so a new phrase would land on another address
  if (!await callApi('validateWalletPhrase', { words: newWords, ownAddress })) {
    return { error: 'UNSUPPORTED_WALLET' };
  }

  await encryptWordsIntoVault(newWords, ownAddress);

  const global = getGlobal();
  const inFlight = selectWalletTransferInFlight(global);
  const result = await callApi('rotateWalletKey', {
    ownAddress, words, newWords, pendingSeqno: inFlight?.seqno, pendingValidUntil: inFlight?.validUntil,
  });

  const isSent = result && 'error' in result && result.isSent;

  if ((!result || 'error' in result) && !isSent) {
    if (hadLocalSecret) {
      await encryptWordsIntoVault(words, ownAddress);
    } else {
      await removeWalletVaultSecret(ACCOUNT_SLOT, ownAddress);
    }
  }

  return result;
}

function encryptWordsIntoVault(words: string[], address: string) {
  savedWalletKeyChecks.delete(address);

  return writeWalletVaultSecret(ACCOUNT_SLOT, new TextEncoder().encode(words.join(' ')).buffer, address);
}

function decodeWords(secret: ArrayBuffer) {
  return new TextDecoder().decode(secret).split(' ');
}
