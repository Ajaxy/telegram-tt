import type {
  ApiStarGiftUnique,
  ApiTonConnectSession,
  ApiWalletCard,
  ApiWalletState,
  ApiWalletStatus,
  ApiWalletTransaction,
  RotateWalletKeyResult,
} from '../../api/types';
import type { GlobalState, TabState } from '../types';

import { getServerTime } from '../../util/serverTime';
import { keepRecipientUser, runForAllTabs } from '../helpers';
import { selectTabState } from '../selectors/tabs';
import { selectOwnWalletCardDecoration, selectWalletAddress, selectWalletTransactions } from '../selectors/wallet';
import { updateTabState } from './tabs';
import { updateUserFullInfo } from './users';

type TonConnectFlow = NonNullable<TabState['walletTonConnect']>;

export function updateWallet<T extends GlobalState>(global: T, update: NonNullable<GlobalState['wallet']>): T {
  global = {
    ...global,
    wallet: {
      ...global.wallet,
      ...update,
    },
  };

  // An omitted `state` leaves it as is, while an empty one comes from the server when there is no ready wallet
  return 'state' in update ? syncOwnWalletCard(global, update.state) : global;
}

// The own card comes with the profile and is not refreshed after transfers, so it takes each newer wallet balance.
// The card or draft of a replaced wallet, or of one that went away, is dropped until the profile loads again.
function syncOwnWalletCard<T extends GlobalState>(global: T, state?: ApiWalletState): T {
  const draft = global.wallet?.cardDraft;
  if (draft && draft.address !== state?.address) {
    global = updateWallet(global, { cardDraft: undefined });
  }

  const userId = global.currentUserId!;
  const card = global.users.fullInfoById[userId]?.walletCard;
  if (!card) return global;

  const isSameWallet = state?.address === card.address;
  if (isSameWallet && card.balance === state.balance) return global;

  return updateUserFullInfo(global, userId, {
    walletCard: isSameWallet ? { ...card, balance: state.balance } : undefined,
  });
}

// Puts the card without the dropped stickers into the draft, which is then saved to the server
export function filterWalletCardStickers<T extends GlobalState>(
  global: T, getIsKept: (nftAddress: string) => boolean,
): T {
  const address = selectWalletAddress(global);
  const decoration = selectOwnWalletCardDecoration(global);
  const layout = address && decoration && filterCardLayout(decoration, getIsKept);
  if (!layout) return global;

  return updateWallet(global, { cardDraft: { address, ...layout } });
}

// The server drops a gift that left the wallet from the saved card itself, so only the cached one needs it
export function filterSavedWalletCardStickers<T extends GlobalState>(
  global: T, getIsKept: (nftAddress: string) => boolean,
): T {
  const userId = global.currentUserId!;
  const card = global.users.fullInfoById[userId]?.walletCard;
  const layout = card && filterCardLayout(card, getIsKept);
  if (!layout) return global;

  return updateUserFullInfo(global, userId, { walletCard: { ...card, ...layout } });
}

function filterCardLayout(
  { stickers, backgroundAddress }: Pick<ApiWalletCard, 'stickers' | 'backgroundAddress'>,
  getIsKept: (nftAddress: string) => boolean,
) {
  if (!stickers) return undefined;

  const keptStickers = stickers.filter((sticker) => getIsKept(sticker.address));
  if (keptStickers.length === stickers.length) return undefined;

  return {
    stickers: keptStickers,
    backgroundAddress: backgroundAddress && getIsKept(backgroundAddress) ? backgroundAddress : undefined,
  };
}

export function updateWalletServerState<T extends GlobalState>(
  global: T, status: ApiWalletStatus | undefined, state: ApiWalletState | undefined,
): T {
  const { staleBalance, state: currentState } = global.wallet || {};

  // While the marker lives, a server balance between the one before the sent transfers and the one with
  // all of them deducted means the server is still catching up, and the optimistic figure stays
  const isServerStale = staleBalance !== undefined
    && getServerTime() < staleBalance.expiresAt
    && state !== undefined && currentState !== undefined
    && state.balance <= staleBalance.amount && state.balance > currentState.balance;

  return updateWallet(global, {
    status,
    state: isServerStale ? { ...state, balance: currentState.balance } : state,
    staleBalance: isServerStale ? staleBalance : undefined,
  });
}

// The server changes the backup state even when the flow is cancelled. A phrase that was sent to the blockchain stays
// on the device even when the flow fails after that.
export function updateWalletAfterBackupDisable<T extends GlobalState>(
  global: T, ownAddress: string, result: RotateWalletKeyResult | undefined,
): T {
  if (!result || selectWalletAddress(global) !== ownAddress) return global;

  if (!('error' in result)) {
    global = updateWalletServerState(global, result.state.status, result.state.state);
  }

  if (!('error' in result) || result.isSent) {
    global = updateWallet(global, { hasLocalSecret: true });
  }

  return global;
}

export function updateWalletCollectibleGift<T extends GlobalState>(
  global: T, collectibleAddress: string, gift: ApiStarGiftUnique,
): T {
  const collectibles = global.wallet?.collectibles;
  if (!collectibles) return global;

  return updateWallet(global, {
    collectibles: collectibles.map((collectible) => (
      collectible.address === collectibleAddress && collectible.type === 'gift'
        ? { ...collectible, gift }
        : collectible
    )),
  });
}

export function clearWalletRecords<T extends GlobalState>(global: T): T {
  return updateWallet(global, {
    transactions: undefined,
    nextOffset: undefined,
    loadedTransactions: undefined,
    collectibles: undefined,
    collectiblesNextOffset: undefined,
    decryptedComments: undefined,
    staleBalance: undefined,
    tonConnectSessions: undefined,
    keyRotationFee: undefined,
  });
}

export function addPendingWalletTransaction<T extends GlobalState>(
  global: T, transaction: ApiWalletTransaction,
): T {
  const current = selectWalletTransactions(global) || [];

  if (current.some(({ id }) => id === transaction.id)) {
    return global;
  }

  return updateWallet(global, { transactions: [transaction, ...current] });
}

// The record takes the place of the pending one, so its row stays where it is
export function replacePendingWalletTransaction<T extends GlobalState>(
  global: T, pendingId: string, transaction: ApiWalletTransaction,
): T {
  const current = selectWalletTransactions(global) || [];
  // The server confirms a transfer under an id other than the one its history lists it under, so a record that took
  // that id is found by its message hash
  const pending = current.find(({ id }) => id === pendingId)
    ?? (transaction.msgHash ? current.find(({ msgHash }) => msgHash === transaction.msgHash) : undefined);
  const pendingRowId = pending?.id ?? pendingId;
  const localId = transaction.localId ?? pending?.localId;
  const balanceDeduction = transaction.balanceDeduction ?? pending?.balanceDeduction;
  const isListed = transaction.id !== pendingRowId && current.some(({ id }) => id === transaction.id);
  const transactions = current.flatMap((item) => {
    if (item.id === pendingRowId) {
      return isListed ? [] : [{
        ...transaction, peer: keepRecipientUser(transaction.peer, pending?.peer), localId, balanceDeduction,
      }];
    }

    if (item.id === transaction.id) {
      return [{
        ...item,
        peer: keepRecipientUser(item.peer, pending?.peer),
        localId: localId ?? item.localId,
        balanceDeduction: balanceDeduction ?? item.balanceDeduction,
      }];
    }

    return [item];
  });

  if (!pending && !isListed) {
    transactions.unshift(transaction);
  }

  global = updateWallet(global, { transactions });

  const isNewlyFailed = Boolean(pending && !pending.isFailed && transaction.isFailed);

  return isNewlyFailed && balanceDeduction
    ? returnFailedTransferAmount(global, transaction.id, balanceDeduction)
    : global;
}

// A history page can be the first to list a transfer as failed. Its row keeps what was taken off for it until that is
// added back, so this runs once for each transfer.
export function returnFailedTransferAmounts<T extends GlobalState>(global: T): T {
  selectWalletTransactions(global)?.forEach(({ id, isFailed, balanceDeduction }) => {
    if (isFailed && balanceDeduction) global = returnFailedTransferAmount(global, id, balanceDeduction);
  });

  return global;
}

// The app takes a sent amount off the balance before the server knows about the transfer, see `staleBalance`. A
// transfer can still fail after that, for example when the money bounces back. Then what was taken off for it is added
// back once, or the correct balance from the server would look like a server that is behind.
function returnFailedTransferAmount<T extends GlobalState>(global: T, transactionId: string, amount: bigint): T {
  const { state, staleBalance } = global.wallet || {};

  global = updateWallet(global, {
    transactions: selectWalletTransactions(global)?.map((item) => (
      item.id === transactionId ? { ...item, balanceDeduction: undefined } : item
    )),
  });

  if (!state || !staleBalance) return global;

  const balance = state.balance + amount;

  return updateWallet(global, {
    state: { ...state, balance: balance < staleBalance.amount ? balance : staleBalance.amount },
  });
}

export function markWalletTransactionFailed<T extends GlobalState>(global: T, transactionId: string): T {
  return updateWallet(global, {
    transactions: selectWalletTransactions(global)?.map((item) => (
      item.id === transactionId ? { ...item, isPending: false, isFailed: true } : item
    )),
  });
}

export function updateWalletTonConnectSession<T extends GlobalState>(global: T, session: ApiTonConnectSession): T {
  const sessions = global.wallet?.tonConnectSessions || [];
  const previous = sessions.find(({ id }) => id === session.id);

  global = updateWallet(global, {
    tonConnectSessions: previous
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [...sessions, session],
  });

  runForAllTabs(global, (tabId) => {
    const flow = selectTabState(global, tabId).walletTonConnect;
    if (flow?.session?.id !== session.id || flow.status === 'pending') return;

    global = updateTabState(global, { walletTonConnect: { ...flow, session } }, tabId);
  });

  return global;
}

export function markWalletTonConnectSessionsClosing<T extends GlobalState>(global: T, sessionIds: string[]): T {
  const closingIds = new Set(sessionIds);

  return updateWallet(global, {
    tonConnectSessions: global.wallet?.tonConnectSessions?.map((session) => (
      closingIds.has(session.id) ? { ...session, isClosing: true } : session
    )),
  });
}

export function finishWalletTonConnect<T extends GlobalState>(
  global: T, tabId: number, pending: TonConnectFlow, update: Partial<TonConnectFlow>,
): T {
  if (selectTabState(global, tabId).walletTonConnect !== pending) return global;

  const session = update.session || pending.session;
  const latestSession = global.wallet?.tonConnectSessions?.find(({ id }) => id === session?.id) || session;

  return updateTabState(global, {
    walletTonConnect: {
      ...pending,
      ...update,
      session: latestSession,
    },
  }, tabId);
}
