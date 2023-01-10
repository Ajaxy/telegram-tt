import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { callApi } from '../../../api/gramjs';

import type { ApiChat, ApiInvoice, ApiRequestInputInvoice } from '../../../api/types';
import { PaymentStep } from '../../../types';

import { DEBUG_PAYMENT_SMART_GLOCAL } from '../../../config';
import {
  selectPaymentRequestId,
  selectProviderPublishableKey,
  selectStripeCredentials,
  selectChatMessage,
  selectChat,
  selectPaymentFormId,
  selectProviderPublicToken,
  selectSmartGlocalCredentials,
  selectPaymentInputInvoice,
} from '../../selectors';
import { getStripeError } from '../../helpers';
import { buildQueryString } from '../../../util/requestQuery';
import {
  updateShippingOptions,
  setPaymentStep,
  setRequestInfoId,
  setPaymentForm,
  setStripeCardInfo,
  setReceipt,
  closeInvoice,
  setSmartGlocalCardInfo, addUsers, setInvoiceInfo, updatePayment,
} from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';

addActionHandler('validateRequestedInfo', (global, actions, payload) => {
  const inputInvoice = selectPaymentInputInvoice(global);
  if (!inputInvoice) {
    return;
  }

  const { requestInfo, saveInfo } = payload;
  if ('slug' in inputInvoice) {
    void validateRequestedInfo(inputInvoice, requestInfo, saveInfo);
  } else {
    const chat = selectChat(global, inputInvoice.chatId);
    if (!chat) {
      return;
    }

    void validateRequestedInfo({
      chat,
      messageId: inputInvoice.messageId,
    }, requestInfo, saveInfo);
  }
});

addActionHandler('openInvoice', async (global, actions, payload) => {
  let invoice: ApiInvoice | undefined;
  if ('slug' in payload) {
    invoice = await getPaymentForm({ slug: payload.slug });
  } else {
    const chat = selectChat(global, payload.chatId);
    if (!chat) {
      return;
    }

    invoice = await getPaymentForm({
      chat,
      messageId: payload.messageId,
    });
  }

  if (!invoice) {
    return;
  }

  global = getGlobal();
  global = setInvoiceInfo(global, invoice);
  setGlobal({
    ...global,
    payment: {
      ...global.payment,
      inputInvoice: payload,
      isPaymentModalOpen: true,
      status: 'cancelled',
      isExtendedMedia: (payload as any).isExtendedMedia,
    },
  });
});

async function getPaymentForm(inputInvoice: ApiRequestInputInvoice): Promise<ApiInvoice | undefined> {
  const result = await callApi('getPaymentForm', inputInvoice);
  if (!result) {
    return undefined;
  }

  const { form, invoice, users } = result;

  let global = setPaymentForm(getGlobal(), form);
  global = setPaymentStep(global, PaymentStep.Checkout);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  setGlobal(global);

  return invoice;
}

addActionHandler('getReceipt', (global, actions, payload) => {
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
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = setReceipt(global, result.receipt, message);
  setGlobal(global);
}

addActionHandler('clearPaymentError', (global) => {
  setGlobal({
    ...global,
    payment: {
      ...global.payment,
      error: undefined,
    },
  });
});

addActionHandler('clearReceipt', (global) => {
  setGlobal({
    ...global,
    payment: {
      ...global.payment,
      receipt: undefined,
    },
  });
});

addActionHandler('sendCredentialsInfo', (global, actions, payload) => {
  const { nativeProvider } = global.payment;
  const { credentials } = payload;
  const { data } = credentials;

  if (nativeProvider === 'stripe') {
    const publishableKey = selectProviderPublishableKey(global);
    if (!publishableKey) {
      return;
    }
    void sendStripeCredentials(data, publishableKey);
  } else if (nativeProvider === 'smartglocal') {
    const publicToken = selectProviderPublicToken(global);
    if (!publicToken) {
      return;
    }
    void sendSmartGlocalCredentials(data, publicToken);
  }
});

addActionHandler('sendPaymentForm', async (global, actions, payload) => {
  const {
    shippingOptionId, saveCredentials, savedCredentialId, tipAmount,
  } = payload;
  const inputInvoice = selectPaymentInputInvoice(global);
  const formId = selectPaymentFormId(global);
  const requestInfoId = selectPaymentRequestId(global);
  const { nativeProvider, temporaryPassword } = global.payment;
  const publishableKey = nativeProvider === 'stripe'
    ? selectProviderPublishableKey(global) : selectProviderPublicToken(global);

  if (!inputInvoice || !publishableKey || !formId || !nativeProvider) {
    return;
  }

  let requestInputInvoice;
  if ('slug' in inputInvoice) {
    requestInputInvoice = {
      slug: inputInvoice.slug,
    };
  } else {
    const chat = selectChat(global, inputInvoice.chatId);
    if (!chat) {
      return;
    }

    requestInputInvoice = {
      chat,
      messageId: inputInvoice.messageId,
    };
  }

  setGlobal(updatePayment(global, { status: 'pending' }));

  const credentials = {
    save: saveCredentials,
    data: nativeProvider === 'stripe' ? selectStripeCredentials(global) : selectSmartGlocalCredentials(global),
  };
  const result = await callApi('sendPaymentForm', {
    inputInvoice: requestInputInvoice,
    formId,
    credentials,
    requestedInfoId: requestInfoId,
    shippingOptionId,
    savedCredentialId,
    temporaryPassword: temporaryPassword?.value,
    tipAmount,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updatePayment(global, { status: 'paid' });
  global = closeInvoice(global);
  setGlobal(global);
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
        status: 'failed',
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

async function sendSmartGlocalCredentials(
  data: {
    cardNumber: string;
    cardholder?: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
  },
  publicToken: string,
) {
  const params = {
    card: {
      number: data.cardNumber.replace(/\D+/g, ''),
      expiration_month: data.expiryMonth,
      expiration_year: data.expiryYear,
      security_code: data.cvv.replace(/\D+/g, ''),
    },
  };
  const url = DEBUG_PAYMENT_SMART_GLOCAL
    ? 'https://tgb-playground.smart-glocal.com/cds/v1/tokenize/card'
    : 'https://tgb.smart-glocal.com/cds/v1/tokenize/card';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-PUBLIC-TOKEN': publicToken,
    },
    body: JSON.stringify(params),
  });
  const result = await response.json();

  if (result.status !== 'ok') {
    // TODO после получения документации сделать аналог getStripeError(result.error);
    const error = { description: 'payment error' };
    const global = getGlobal();
    setGlobal({
      ...global,
      payment: {
        ...global.payment,
        status: 'failed',
        error: {
          ...error,
        },
      },
    });
    return;
  }

  let global = setSmartGlocalCardInfo(getGlobal(), {
    type: 'card',
    token: result.data.token,
  });
  global = setPaymentStep(global, PaymentStep.Checkout);
  setGlobal(global);
}

addActionHandler('setPaymentStep', (global, actions, payload = {}) => {
  return setPaymentStep(global, payload.step ?? PaymentStep.Checkout);
});

addActionHandler('closePremiumModal', (global, actions, payload) => {
  if (!global.premiumModal) return undefined;
  const { isClosed } = payload || {};
  return {
    ...global,
    premiumModal: {
      ...global.premiumModal,
      ...(isClosed && { isOpen: false }),
      isClosing: !isClosed,
    },
  };
});

addActionHandler('openPremiumModal', async (global, actions, payload) => {
  const {
    initialSection, fromUserId, isSuccess, isGift, monthsAmount, toUserId,
  } = payload || {};

  actions.loadPremiumStickers();

  const result = await callApi('fetchPremiumPromo');
  if (!result) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  setGlobal({
    ...global,
    premiumModal: {
      promo: result.promo,
      initialSection,
      isOpen: true,
      fromUserId,
      toUserId,
      isGift,
      monthsAmount,
      isSuccess,
    },
  });
});

addActionHandler('openGiftPremiumModal', async (global, actions, payload) => {
  const { forUserId } = payload || {};
  const result = await callApi('fetchPremiumPromo');
  if (!result) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  // TODO Support all subscription options
  const month = result.promo.options.find((option) => option.months === 1)!;

  setGlobal({
    ...global,
    giftPremiumModal: {
      isOpen: true,
      forUserId,
      monthlyCurrency: month.currency,
      monthlyAmount: month.amount,
    },
  });
});

addActionHandler('closeGiftPremiumModal', (global) => {
  setGlobal({
    ...global,
    giftPremiumModal: { isOpen: false },
  });
});

addActionHandler('validatePaymentPassword', async (global, actions, { password }) => {
  const result = await callApi('fetchTemporaryPaymentPassword', password);

  global = getGlobal();

  if (!result) {
    global = updatePayment(global, { error: { message: 'Unknown Error', field: 'password' } });
  } else if ('error' in result) {
    global = updatePayment(global, { error: { message: result.error, field: 'password' } });
  } else {
    global = updatePayment(global, { temporaryPassword: result, step: PaymentStep.Checkout });
  }

  setGlobal(global);
});

async function validateRequestedInfo(inputInvoice: ApiRequestInputInvoice, requestInfo: any, shouldSave?: true) {
  const result = await callApi('validateRequestedInfo', {
    inputInvoice, requestInfo, shouldSave,
  });
  if (!result) {
    return;
  }

  const { id, shippingOptions } = result;

  let global = setRequestInfoId(getGlobal(), id);
  if (shippingOptions) {
    global = updateShippingOptions(global, shippingOptions);
    global = setPaymentStep(global, PaymentStep.Shipping);
  } else {
    global = setPaymentStep(global, PaymentStep.Checkout);
  }
  setGlobal(global);
}
