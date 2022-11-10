import type { GlobalState } from '../types';
import type { ShippingOption, PaymentStep } from '../../types';
import type {
  ApiInvoice, ApiMessage, ApiPaymentForm, ApiReceipt,
} from '../../api/types';

export function updatePayment(global: GlobalState, update: Partial<GlobalState['payment']>): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      ...update,
    },
  };
}

export function updateShippingOptions(
  global: GlobalState,
  shippingOptions: ShippingOption[],
): GlobalState {
  return updatePayment(global, { shippingOptions });
}

export function setRequestInfoId(global: GlobalState, id: string): GlobalState {
  return updatePayment(global, { requestId: id });
}

export function setPaymentStep(global: GlobalState, step: PaymentStep): GlobalState {
  return updatePayment(global, { step });
}

export function setInvoiceInfo(global: GlobalState, invoice: ApiInvoice): GlobalState {
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
  });
}

export function setStripeCardInfo(global: GlobalState, cardInfo: { type: string; id: string }): GlobalState {
  return updatePayment(global, { stripeCredentials: { ...cardInfo } });
}

export function setSmartGlocalCardInfo(
  global: GlobalState,
  cardInfo: { type: string; token: string },
): GlobalState {
  return updatePayment(global, { smartGlocalCredentials: { ...cardInfo } });
}

export function setPaymentForm(global: GlobalState, form: ApiPaymentForm): GlobalState {
  return updatePayment(global, { ...form });
}

export function setConfirmPaymentUrl(global: GlobalState, url?: string): GlobalState {
  return updatePayment(global, { confirmPaymentUrl: url });
}

export function setReceipt(
  global: GlobalState,
  receipt?: ApiReceipt,
  message?: ApiMessage,
): GlobalState {
  if (!receipt || !message) {
    return updatePayment(global, { receipt: undefined });
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
  });
}

export function clearPayment(global: GlobalState): GlobalState {
  return {
    ...global,
    payment: {},
  };
}

export function closeInvoice(global: GlobalState): GlobalState {
  return updatePayment(global, { isPaymentModalOpen: undefined, isExtendedMedia: undefined });
}
