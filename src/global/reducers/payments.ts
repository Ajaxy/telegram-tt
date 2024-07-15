import type {
  ApiInvoice, ApiPaymentForm, ApiReceipt,
  ApiReceiptStars,
  ApiStarsTransaction,
} from '../../api/types';
import type { PaymentStep, ShippingOption } from '../../types';
import type {
  GlobalState, StarsTransactionType, TabArgs, TabState,
} from '../types';

import { STARS_CURRENCY_CODE } from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from '../selectors';
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

export function setInvoiceInfo<T extends GlobalState>(
  global: T, invoice: ApiInvoice,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const {
    title,
    text,
    amount,
    currency,
    isTest,
    photo,
    isRecurring,
    termsUrl,
    maxTipAmount,
    suggestedTipAmounts,
  } = invoice;

  return updatePayment(global, {
    invoice: {
      mediaType: 'invoice',
      title,
      text,
      photo,
      amount,
      currency,
      isTest,
      isRecurring,
      termsUrl,
      maxTipAmount,
      suggestedTipAmounts,
    },
  }, tabId);
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

export function setPaymentForm<T extends GlobalState>(
  global: T, form: ApiPaymentForm,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { ...form }, tabId);
}

export function setConfirmPaymentUrl<T extends GlobalState>(
  global: T, url?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { confirmPaymentUrl: url }, tabId);
}

export function setReceipt<T extends GlobalState>(
  global: T,
  receipt?: ApiReceipt,
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
    isStarPaymentModalOpen: undefined,
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
  global = updateTabState(global, { isStarPaymentModalOpen: undefined }, tabId);
  return global;
}

export function updateStarsBalance<T extends GlobalState>(
  global: T, balance: number,
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

export function updateReceiptFromStarsTransaction<T extends GlobalState>(
  global: T, transaction: ApiStarsTransaction, ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const receipt: ApiReceiptStars = {
    type: 'stars',
    totalAmount: transaction.stars,
    currency: STARS_CURRENCY_CODE,
    peer: transaction.peer,
    date: transaction.date,
    text: transaction.description,
    title: transaction.title,
    transactionId: transaction.id,
    photo: transaction.photo,
    media: transaction.extendedMedia,
    messageId: transaction.messageId,
  };

  return updatePayment(global, { receipt }, tabId);
}
