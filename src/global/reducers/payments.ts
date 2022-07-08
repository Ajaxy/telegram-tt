import type { GlobalState } from '../types';
import type { ShippingOption, PaymentStep } from '../../types';
import type {
  ApiInvoice, ApiMessage, ApiPaymentForm, ApiReceipt,
} from '../../api/types';

export function updateShippingOptions(
  global: GlobalState,
  shippingOptions: ShippingOption[],
): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      shippingOptions,
    },
  };
}

export function setRequestInfoId(global: GlobalState, id: string): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      requestId: id,
    },
  };
}

export function setPaymentStep(global: GlobalState, step: PaymentStep): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      step,
    },
  };
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
  } = invoice;

  return {
    ...global,
    payment: {
      ...global.payment,
      invoiceContent: {
        title,
        text,
        photo,
        amount,
        currency,
        isTest,
        isRecurring,
        recurringTermsUrl,
      },
    },
  };
}

export function setStripeCardInfo(global: GlobalState, cardInfo: { type: string; id: string }): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      stripeCredentials: {
        ...cardInfo,
      },
    },
  };
}

export function setSmartGlocalCardInfo(
  global: GlobalState,
  cardInfo: { type: string; token: string },
): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      smartGlocalCredentials: {
        ...cardInfo,
      },
    },
  };
}

export function setPaymentForm(global: GlobalState, form: ApiPaymentForm): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      ...form,
    },
  };
}

export function setConfirmPaymentUrl(global: GlobalState, url?: string): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      confirmPaymentUrl: url,
    },
  };
}

export function setReceipt(
  global: GlobalState,
  receipt?: ApiReceipt,
  message?: ApiMessage,
): GlobalState {
  if (!receipt || !message) {
    return {
      ...global,
      payment: {
        ...global.payment,
        receipt: undefined,
      },
    };
  }

  const { invoice: messageInvoice } = message.content;
  const {
    photo, text, title,
  } = (messageInvoice || {});

  return {
    ...global,
    payment: {
      ...global.payment,
      receipt: {
        ...receipt,
        photo,
        text,
        title,
      },
    },
  };
}

export function clearPayment(global: GlobalState): GlobalState {
  return {
    ...global,
    payment: {},
  };
}

export function closeInvoice(global: GlobalState): GlobalState {
  return {
    ...global,
    payment: {
      ...global.payment,
      isPaymentModalOpen: false,
    },
  };
}
