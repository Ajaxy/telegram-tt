import type {
  ApiReceiptRegular,
  ApiReceiptStars,
  ApiStarsAmount,
  ApiStarsSubscription,
  ApiStarsTransaction,
} from '../../api/types';
import type {
  PaymentStep,
  ShippingOption,
  StarsSubscriptions,
  StarsTransactionType,
} from '../../types';
import type {
  GlobalState, TabArgs, TabState,
} from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectStarsPayment, selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function updatePayment<T extends GlobalState>(
  global: T, update: Partial<TabState['payment']>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      ...update,
    },
  }, tabId);
}

export function updateStarsPayment<T extends GlobalState>(
  global: T, update: Partial<TabState['starsPayment']>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const starPayment = selectStarsPayment(global, tabId);
  if (!starPayment) {
    return global;
  }

  return updateTabState(global, {
    starsPayment: {
      ...starPayment,
      ...update,
    },
  }, tabId);
}

export function updateShippingOptions<T extends GlobalState>(
  global: T,
  shippingOptions: ShippingOption[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>

): T {
  return updatePayment(global, { shippingOptions }, tabId);
}

export function setRequestInfoId<T extends GlobalState>(
  global: T, id: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { requestId: id }, tabId);
}

export function setPaymentStep<T extends GlobalState>(
  global: T, step: PaymentStep,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { step }, tabId);
}

export function setStripeCardInfo<T extends GlobalState>(
  global: T, cardInfo: { type: string; id: string },
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { stripeCredentials: { ...cardInfo } }, tabId);
}

export function setSmartGlocalCardInfo<T extends GlobalState>(
  global: T,
  cardInfo: { type: string; token: string },
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { smartGlocalCredentials: { ...cardInfo } }, tabId);
}

export function setConfirmPaymentUrl<T extends GlobalState>(
  global: T, url?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { confirmPaymentUrl: url }, tabId);
}

export function setReceipt<T extends GlobalState>(
  global: T,
  receipt?: ApiReceiptRegular,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  if (!receipt) {
    return updatePayment(global, { receipt: undefined }, tabId);
  }

  return updatePayment(global, {
    receipt,
  }, tabId);
}

export function clearPayment<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    payment: {},
  }, tabId);
}

export function clearStarPayment<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    starsPayment: {},
  }, tabId);
}

export function closeInvoice<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  global = updatePayment(global, {
    isPaymentModalOpen: undefined,
    isExtendedMedia: undefined,
  }, tabId);
  return global;
}

export function updateStarsBalance<T extends GlobalState>(
  global: T, balance: ApiStarsAmount,
): T {
  return {
    ...global,
    stars: {
      ...global.stars,
      balance,
    },
  };
}

export function appendStarsTransactions<T extends GlobalState>(
  global: T,
  type: StarsTransactionType,
  transactions: ApiStarsTransaction[],
  nextOffset?: string,
): T {
  const history = global.stars?.history;
  if (!history) {
    return global;
  }

  const newTypeObject = {
    transactions: (history[type]?.transactions || []).concat(transactions),
    nextOffset,
  };

  return {
    ...global,
    stars: {
      ...global.stars,
      history: {
        ...history,
        [type]: newTypeObject,
      },
    },
  };
}

export function appendStarsSubscriptions<T extends GlobalState>(
  global: T,
  subscriptions: ApiStarsSubscription[],
  nextOffset?: string,
): T {
  if (!global.stars) {
    return global;
  }

  const newObject = {
    list: (global.stars.subscriptions?.list || []).concat(subscriptions),
    nextOffset,
  } satisfies StarsSubscriptions;

  return {
    ...global,
    stars: {
      ...global.stars,
      subscriptions: newObject,
    },
  };
}

export function updateStarsSubscriptionLoading<T extends GlobalState>(
  global: T, isLoading: boolean,
): T {
  const subscriptions = global.stars?.subscriptions;
  if (!subscriptions) {
    return global;
  }

  return {
    ...global,
    stars: {
      ...global.stars,
      subscriptions: {
        ...subscriptions,
        isLoading,
      },
    },
  };
}

export function openStarsTransactionModal<T extends GlobalState>(
  global: T, transaction: ApiStarsTransaction, ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    starsTransactionModal: {
      transaction,
    },
  }, tabId);
}

export function openStarsTransactionFromReceipt<T extends GlobalState>(
  global: T, receipt: ApiReceiptStars, ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const transaction: ApiStarsTransaction = {
    id: receipt.transactionId,
    peer: {
      type: 'peer',
      id: receipt.botId,
    },
    stars: {
      amount: receipt.totalAmount,
      nanos: 0,
    },
    date: receipt.date,
    title: receipt.title,
    description: receipt.description,
    photo: receipt.photo,
  };

  return openStarsTransactionModal(global, transaction, tabId);
}
