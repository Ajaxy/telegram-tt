import { GlobalState } from '../../global/types';
import { ShippingOption, PaymentStep } from '../../types';
import { ApiMessage, ApiPaymentForm, ApiReceipt } from '../../api/types';

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

export function setInvoiceMessageInfo(global: GlobalState, message: ApiMessage): GlobalState {
  if (!message.content || !message.content.invoice) {
    return global;
  }
  const {
    title,
    text,
    amount,
    currency,
    isTest,
    photoUrl,
  } = message.content.invoice;
  return {
    ...global,
    payment: {
      ...global.payment,
      invoiceContent: {
        title,
        text,
        photoUrl,
        amount,
        currency,
        isTest,
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
  const { photoUrl, text, title } = (messageInvoice || {});

  return {
    ...global,
    payment: {
      ...global.payment,
      receipt: {
        ...receipt,
        photoUrl,
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
