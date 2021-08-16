import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { PaymentStep } from '../../../types';
import { ApiChat } from '../../../api/types';

import {
  selectPaymentMessageId,
  selectPaymentRequestId,
  selectProviderPublishableKey,
  selectStripeCredentials,
  selectChatMessage,
  selectPaymentChatId,
  selectChat,
  selectPaymentFormId,
} from '../../selectors';
import { callApi } from '../../../api/gramjs';
import { getStripeError } from '../../helpers';
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
  const chatId = selectPaymentChatId(global);
  const chat = chatId && selectChat(global, chatId);
  const messageId = selectPaymentMessageId(global);
  if (!chat || !messageId) {
    return;
  }
  void validateRequestedInfo(chat, messageId, requestInfo, saveInfo);
});

async function validateRequestedInfo(chat: ApiChat, messageId: number, requestInfo: any, shouldSave?: true) {
  const result = await callApi('validateRequestedInfo', {
    chat, messageId, requestInfo, shouldSave,
  });
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
  const { chat, messageId } = payload;
  if (!chat || !messageId) {
    return;
  }
  void getPaymentForm(chat, messageId);
});

async function getPaymentForm(chat: ApiChat, messageId: number) {
  const result = await callApi('getPaymentForm', { chat, messageId });
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
  const chat = chatId && selectChat(global, chatId);
  if (!messageId || !receiptMessageId || !chat) {
    return;
  }

  void getReceipt(chat, messageId, receiptMessageId);
});

async function getReceipt(chat: ApiChat, messageId: number, receiptMessageId: number) {
  const result = await callApi('getReceipt', chat, receiptMessageId);
  if (!result) {
    return;
  }

  let global = getGlobal();
  const message = selectChatMessage(global, chat.id, messageId);
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
  void sendStripeCredentials(data, publishableKey);
});

addReducer('sendPaymentForm', (global, actions, payload) => {
  const { shippingOptionId, saveCredentials } = payload;
  const chatId = selectPaymentChatId(global);
  const chat = chatId && selectChat(global, chatId);
  const messageId = selectPaymentMessageId(global);
  const formId = selectPaymentFormId(global);
  const requestInfoId = selectPaymentRequestId(global);
  const publishableKey = selectProviderPublishableKey(global);
  const stripeCredentials = selectStripeCredentials(global);
  if (!chat || !messageId || !publishableKey || !formId) {
    return;
  }

  void sendPaymentForm(chat, messageId, formId, {
    save: saveCredentials,
    data: stripeCredentials,
  }, requestInfoId, shippingOptionId);
});

async function sendStripeCredentials(
  data: {
    cardNumber: string;
    cardholder?: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    country: string;
    zip: string;
  },
  publishableKey: string,
) {
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
  chat: ApiChat,
  messageId: number,
  formId: string,
  credentials: any,
  requestedInfoId?: string,
  shippingOptionId?: string,
) {
  const result = await callApi('sendPaymentForm', {
    chat, messageId, formId, credentials, requestedInfoId, shippingOptionId,
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
