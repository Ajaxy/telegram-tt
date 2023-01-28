import type { GlobalState, TabState, TabArgs } from '../types';
import type { ShippingOption, PaymentStep } from '../../types';
import type {
  ApiInvoice, ApiMessage, ApiPaymentForm, ApiReceipt,
} from '../../api/types';
import { updateTabState } from './tabs';
import { selectTabState } from '../selectors';
import { getCurrentTabId } from '../../util/establishMultitabRole';

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
    recurringTermsUrl,
    maxTipAmount,
    suggestedTipAmounts,
  } = invoice;

  return updatePayment(global, {
    invoice: {
      title,
      text,
      photo,
      amount,
      currency,
      isTest,
      isRecurring,
      recurringTermsUrl,
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
  message?: ApiMessage,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  if (!receipt || !message) {
    return updatePayment(global, { receipt: undefined }, tabId);
  }

  const { invoice: messageInvoice } = message.content;
  const {
    photo, text, title,
  } = (messageInvoice || {});

  return updatePayment(global, {
    receipt: {
      ...receipt,
      photo,
      text,
      title,
    },
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

export function closeInvoice<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updatePayment(global, { isPaymentModalOpen: undefined, isExtendedMedia: undefined }, tabId);
}
