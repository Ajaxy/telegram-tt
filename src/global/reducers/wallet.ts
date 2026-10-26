import type { ApiTonConnectSession, ApiWalletState, ApiWalletStatus, ApiWalletTransaction } from '../../api/types';
import type { GlobalState, TabState } from '../types';

import { getServerTime } from '../../util/serverTime';
import { keepRecipientUser, runForAllTabs } from '../helpers';
import { selectTabState } from '../selectors/tabs';
import { selectWalletTransactions } from '../selectors/wallet';
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
// A card of a replaced wallet, or one left after the wallet went away, is dropped until the profile loads again.
function syncOwnWalletCard<T extends GlobalState>(global: T, state?: ApiWalletState): T {
  const userId = global.currentUserId!;
  const card = global.users.fullInfoById[userId]?.walletCard;
  if (!card) return global;

  const isSameWallet = state?.address === card.address;
  if (isSameWallet && card.balance === state.balance) return global;

  return updateUserFullInfo(global, userId, {
    walletCard: isSameWallet ? { ...card, balance: state.balance } : undefined,
  });
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
  const pending = current.find(({ id }) => id === pendingId);
  const localId = transaction.localId ?? pending?.localId;
  const isListed = transaction.id !== pendingId && current.some(({ id }) => id === transaction.id);
  const transactions = current.flatMap((item) => {
    if (item.id === pendingId) {
      return isListed ? [] : [{ ...transaction, peer: keepRecipientUser(transaction.peer, pending?.peer), localId }];
    }

    if (item.id === transaction.id) {
      return [{ ...item, peer: keepRecipientUser(item.peer, pending?.peer), localId: localId ?? item.localId }];
    }

    return [item];
  });

  if (!pending && !isListed) {
    transactions.unshift(transaction);
  }

  return updateWallet(global, { transactions });
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
