import type { ApiTonConnectSession, ApiWalletState, ApiWalletStatus, ApiWalletTransaction } from '../../api/types';
import type { GlobalState, TabState } from '../types';

import { getServerTime } from '../../util/serverTime';
import { selectTabState } from '../selectors/tabs';
import { updateTabState } from './tabs';

type TonConnectFlow = NonNullable<TabState['walletTonConnect']>;

export function updateWallet<T extends GlobalState>(global: T, update: NonNullable<GlobalState['wallet']>): T {
  return {
    ...global,
    wallet: {
      ...global.wallet,
      ...update,
    },
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
  const current = global.wallet?.transactions || [];

  if (current.some(({ id }) => id === transaction.id)) {
    return global;
  }

  return updateWallet(global, { transactions: [transaction, ...current] });
}

export function replacePendingWalletTransaction<T extends GlobalState>(
  global: T, pendingId: string, transaction: ApiWalletTransaction,
): T {
  const current = global.wallet?.transactions || [];
  const transactions = current.filter(({ id }) => id !== pendingId);

  if (!current.some(({ id }) => id === transaction.id)) {
    transactions.unshift(transaction);
  }

  return updateWallet(global, { transactions });
}

export function updateWalletTonConnectSession<T extends GlobalState>(global: T, session: ApiTonConnectSession): T {
  const sessions = global.wallet?.tonConnectSessions || [];
  const previous = sessions.find(({ id }) => id === session.id);

  global = updateWallet(global, {
    tonConnectSessions: previous
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [...sessions, session],
  });

  for (const [tabId, tab] of Object.entries(global.byTabId)) {
    const flow = tab.walletTonConnect;
    if (flow?.session?.id !== session.id || flow.status === 'pending') continue;

    global = updateTabState(global, { walletTonConnect: { ...flow, session } }, Number(tabId));
  }

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
