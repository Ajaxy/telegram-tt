import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { PaymentStep } from '../../../types/index';
import { callApi } from '../../../api/gramjs';
import {
  selectPaymentMessageId,
  selectPaymentRequestId,
  selectProviderPublishableKey,
  selectStripeCredentials,
  selectChatMessage,
} from '../../selectors';

import { getStripeError } from '../../helpers/payments';
import { buildQueryString } from '../../../util/requestQuery';

import {
  updateShippingOptions,
  setPaymentStep,
  setRequestInfoId,
  setPaymentForm,
  setStripeCardInfo,
  setInvoiceMessageInfo,
  setReceipt,
  clearPayment,
  closeInvoice,
} from '../../reducers';

addReducer('validateRequestedInfo', (global, actions, payload) => {
  const { requestInfo, saveInfo } = payload;
  const messageId = selectPaymentMessageId(global);
  if (!messageId) {
    return;
  }
  validateRequestedInfo(messageId, requestInfo, saveInfo);
});

async function validateRequestedInfo(messageId: number, requestInfo: any, shouldSave?: true) {
  const result = await callApi('validateRequestedInfo', { messageId, requestInfo, shouldSave });
  if (!result) {
    return;
  }
  const { id, shippingOptions } = result;
  if (!id) {
    return;
  }
  let global = setRequestInfoId(getGlobal(), id);
  if (shippingOptions) {
    global = updateShippingOptions(global, shippingOptions);
    global = setPaymentStep(global, PaymentStep.Shipping);
  } else {
    global = setPaymentStep(global, PaymentStep.PaymentInfo);
  }
  setGlobal(global);
}

addReducer('getPaymentForm', (global, actions, payload) => {
  const { messageId } = payload;
  if (!messageId) {
    return;
  }
  getPaymentForm(messageId);
});


async function getPaymentForm(messageId: number) {
  const result = await callApi('getPaymentForm', { messageId });
  if (!result) {
    return;
  }
  let global = setPaymentForm(getGlobal(), result);
  let step = PaymentStep.PaymentInfo;
  if (global.payment.invoice
    && (global.payment.invoice.shippingAddressRequested
    || global.payment.invoice.nameRequested
    || global.payment.invoice.phoneRequested
    || global.payment.invoice.emailRequested)) {
    step = PaymentStep.ShippingInfo;
  }
  global = setPaymentStep(global, step);
  setGlobal(global);
}

addReducer('getReceipt', (global, actions, payload) => {
  const { receiptMessageId, chatId, messageId } = payload;
  if (!messageId || !receiptMessageId || !chatId) {
    return;
  }
  getReceipt(messageId, receiptMessageId, chatId);
});

async function getReceipt(messageId: number, receiptMessageId: number, chatId: number) {
  const result = await callApi('getReceipt', receiptMessageId);
  if (!result) {
    return;
  }
  let global = getGlobal();
  const message = selectChatMessage(global, chatId, messageId);
  global = setReceipt(global, result, message);
  setGlobal(global);
}

addReducer('clearPaymentError', (global) => {
  setGlobal({
    ...global,
    payment: {
      ...global.payment,
      error: undefined,
    },
  });
});

addReducer('clearReceipt', (global) => {
  setGlobal({
    ...global,
    payment: {
      ...global.payment,
      receipt: undefined,
    },
  });
});

addReducer('sendCredentialsInfo', (global, actions, payload) => {
  const publishableKey = selectProviderPublishableKey(global);
  if (!publishableKey) {
    return;
  }
  const { credentials } = payload;
  const { data } = credentials;
  sendStipeCredentials(data, publishableKey);
});

addReducer('sendPaymentForm', (global, actions, payload) => {
  const { shippingOptionId, saveCredentials } = payload;
  const messageId = selectPaymentMessageId(global);
  const requestInfoId = selectPaymentRequestId(global);
  const publishableKey = selectProviderPublishableKey(global);
  const stripeCredentials = selectStripeCredentials(global);
  if (!messageId || !publishableKey) {
    return;
  }
  sendPaymentForm(messageId, {
    save: saveCredentials,
    data: stripeCredentials,
  }, requestInfoId, shippingOptionId);
});

async function sendStipeCredentials(data: {
  cardNumber: string;
  cardholder?: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  country: string;
  zip: string;
},
publishableKey: string) {
  const query = buildQueryString({
    'card[number]': data.cardNumber,
    'card[exp_month]': data.expiryMonth,
    'card[exp_year]': data.expiryYear,
    'card[cvc]': data.cvv,
    'card[address_zip]': data.zip,
    'card[address_country]': data.country,
  });

  const response = await fetch(`https://api.stripe.com/v1/tokens${query}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${publishableKey}`,
    },
  });
  const result = await response.json();
  if (result.error) {
    const error = getStripeError(result.error);
    const global = getGlobal();
    setGlobal({
      ...global,
      payment: {
        ...global.payment,
        error: {
          ...error,
        },
      },
    });
    return;
  }
  let global = setStripeCardInfo(getGlobal(), {
    type: result.type,
    id: result.id,
  });
  global = setPaymentStep(global, PaymentStep.Checkout);
  setGlobal(global);
}

async function sendPaymentForm(
  messageId: number,
  credentials: any,
  requestedInfoId?: string,
  shippingOptionId?: string,
) {
  const result = await callApi('sendPaymentForm', {
    messageId, credentials, requestedInfoId, shippingOptionId,
  });
  if (result) {
    const global = clearPayment(getGlobal());
    setGlobal(closeInvoice(global));
  }
}

addReducer('setPaymentStep', (global, actions, payload = {}) => {
  return setPaymentStep(global, payload.step || PaymentStep.ShippingInfo);
});

addReducer('setInvoiceMessageInfo', (global, actions, payload) => {
  return setInvoiceMessageInfo(global, payload);
});
