import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { callApi } from '../../../api/gramjs';

import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import type { ApiInvoice, ApiRequestInputInvoice } from '../../../api/types';
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
  selectPaymentInputInvoice, selectTabState,
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
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import type { ApiCredentials } from '../../../components/payment/PaymentModal';

addActionHandler('validateRequestedInfo', (global, actions, payload): ActionReturnType => {
  const { requestInfo, saveInfo, tabId = getCurrentTabId() } = payload;

  const inputInvoice = selectPaymentInputInvoice(global, tabId);
  if (!inputInvoice) {
    return;
  }

  if ('slug' in inputInvoice) {
    void validateRequestedInfo(global, inputInvoice, requestInfo, saveInfo, tabId);
  } else {
    const chat = selectChat(global, inputInvoice.chatId);
    if (!chat) {
      return;
    }

    void validateRequestedInfo(global, {
      chat,
      messageId: inputInvoice.messageId,
    }, requestInfo, saveInfo, tabId);
  }
});

addActionHandler('openInvoice', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload;
  let invoice: ApiInvoice | undefined;
  if ('slug' in payload) {
    invoice = await getPaymentForm(global, { slug: payload.slug }, tabId);
  } else {
    const chat = selectChat(global, payload.chatId);
    if (!chat) {
      return;
    }

    invoice = await getPaymentForm(global, {
      chat,
      messageId: payload.messageId,
    }, tabId);
  }

  if (!invoice) {
    return;
  }

  global = getGlobal();
  global = setInvoiceInfo(global, invoice, tabId);
  global = updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      inputInvoice: payload,
      isPaymentModalOpen: true,
      status: 'cancelled',
      isExtendedMedia: (payload as any).isExtendedMedia,
    },
  }, tabId);
  setGlobal(global);
});

async function getPaymentForm<T extends GlobalState>(
  global: T, inputInvoice: ApiRequestInputInvoice,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): Promise<ApiInvoice | undefined> {
  const result = await callApi('getPaymentForm', inputInvoice);
  if (!result) {
    return undefined;
  }

  const { form, invoice, users } = result;

  global = getGlobal();
  global = setPaymentForm(global, form, tabId);
  global = setPaymentStep(global, PaymentStep.Checkout, tabId);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  setGlobal(global);

  return invoice;
}

addActionHandler('getReceipt', async (global, actions, payload): Promise<void> => {
  const {
    receiptMessageId, chatId, messageId, tabId = getCurrentTabId(),
  } = payload;
  const chat = chatId && selectChat(global, chatId);
  if (!messageId || !receiptMessageId || !chat) {
    return;
  }

  const result = await callApi('getReceipt', chat, receiptMessageId);
  if (!result) {
    return;
  }

  global = getGlobal();
  const message = selectChatMessage(global, chat.id, messageId);
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = setReceipt(global, result.receipt, message, tabId);
  setGlobal(global);
});

addActionHandler('clearPaymentError', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  global = updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      error: undefined,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('clearReceipt', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    payment: {
      ...selectTabState(global, tabId).payment,
      receipt: undefined,
    },
  }, tabId);
});

addActionHandler('sendCredentialsInfo', (global, actions, payload): ActionReturnType => {
  const { credentials, tabId = getCurrentTabId() } = payload;

  const { nativeProvider } = selectTabState(global, tabId).payment;
  const { data } = credentials;

  if (nativeProvider === 'stripe') {
    const publishableKey = selectProviderPublishableKey(global, tabId);
    if (!publishableKey) {
      return;
    }
    void sendStripeCredentials(global, data, publishableKey, tabId);
  } else if (nativeProvider === 'smartglocal') {
    const publicToken = selectProviderPublicToken(global, tabId);
    if (!publicToken) {
      return;
    }
    void sendSmartGlocalCredentials(global, data, publicToken, tabId);
  }
});

addActionHandler('sendPaymentForm', async (global, actions, payload): Promise<void> => {
  const {
    shippingOptionId, saveCredentials, savedCredentialId, tipAmount,
    tabId = getCurrentTabId(),
  } = payload;
  const inputInvoice = selectPaymentInputInvoice(global, tabId);
  const formId = selectPaymentFormId(global, tabId);
  const requestInfoId = selectPaymentRequestId(global, tabId);
  const { nativeProvider, temporaryPassword } = selectTabState(global, tabId).payment;
  const publishableKey = nativeProvider === 'stripe'
    ? selectProviderPublishableKey(global, tabId) : selectProviderPublicToken(global, tabId);

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

  global = updatePayment(global, { status: 'pending' }, tabId);
  setGlobal(global);

  const credentials = {
    save: saveCredentials,
    data: nativeProvider === 'stripe'
      ? selectStripeCredentials(global, tabId) : selectSmartGlocalCredentials(global, tabId),
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
  global = updatePayment(global, { status: 'paid' }, tabId);
  global = closeInvoice(global, tabId);
  setGlobal(global);
});

async function sendStripeCredentials<T extends GlobalState>(
  global: T,
  data: ApiCredentials['data'],
  publishableKey: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
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
    global = getGlobal();
    global = updateTabState(global, {
      payment: {
        ...selectTabState(global, tabId).payment,
        status: 'failed',
        error: {
          ...error,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }
  global = getGlobal();
  global = setStripeCardInfo(global, {
    type: result.type,
    id: result.id,
  }, tabId);
  global = setPaymentStep(global, PaymentStep.Checkout, tabId);
  setGlobal(global);
}

async function sendSmartGlocalCredentials<T extends GlobalState>(
  global: T,
  data: ApiCredentials['data'],
  publicToken: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
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
    global = getGlobal();
    global = updateTabState(global, {
      payment: {
        ...selectTabState(global, tabId).payment,
        status: 'failed',
        error: {
          ...error,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = getGlobal();
  global = setSmartGlocalCardInfo(global, {
    type: 'card',
    token: result.data.token,
  }, tabId);
  global = setPaymentStep(global, PaymentStep.Checkout, tabId);
  setGlobal(global);
}

addActionHandler('setPaymentStep', (global, actions, payload): ActionReturnType => {
  const { step, tabId = getCurrentTabId() } = payload;
  return setPaymentStep(global, step ?? PaymentStep.Checkout, tabId);
});

addActionHandler('closePremiumModal', (global, actions, payload): ActionReturnType => {
  const { isClosed, tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  if (!tabState.premiumModal) return undefined;
  return updateTabState(global, {
    premiumModal: {
      ...tabState.premiumModal,
      ...(isClosed && { isOpen: false }),
      isClosing: !isClosed,
    },
  }, tabId);
});

addActionHandler('openPremiumModal', async (global, actions, payload): Promise<void> => {
  const {
    initialSection, fromUserId, isSuccess, isGift, monthsAmount, toUserId,
    tabId = getCurrentTabId(),
  } = payload || {};

  actions.loadPremiumStickers();

  const result = await callApi('fetchPremiumPromo');
  if (!result) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  global = updateTabState(global, {
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
  }, tabId);
  setGlobal(global);
});

addActionHandler('openGiftPremiumModal', async (global, actions, payload): Promise<void> => {
  const { forUserId, tabId = getCurrentTabId() } = payload || {};
  const result = await callApi('fetchPremiumPromo');
  if (!result) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));

  // TODO Support all subscription options
  const month = result.promo.options.find((option) => option.months === 1)!;

  global = updateTabState(global, {
    giftPremiumModal: {
      isOpen: true,
      forUserId,
      monthlyCurrency: month.currency,
      monthlyAmount: month.amount,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeGiftPremiumModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  global = updateTabState(global, {
    giftPremiumModal: { isOpen: false },
  }, tabId);
  setGlobal(global);
});

addActionHandler('validatePaymentPassword', async (global, actions, payload): Promise<void> => {
  const { password, tabId = getCurrentTabId() } = payload;
  const result = await callApi('fetchTemporaryPaymentPassword', password);

  global = getGlobal();

  if (!result) {
    global = updatePayment(global, { error: { message: 'Unknown Error', field: 'password' } }, tabId);
  } else if ('error' in result) {
    global = updatePayment(global, { error: { message: result.error, field: 'password' } }, tabId);
  } else {
    global = updatePayment(global, { temporaryPassword: result, step: PaymentStep.Checkout }, tabId);
  }

  setGlobal(global);
});

async function validateRequestedInfo<T extends GlobalState>(
  global: T, inputInvoice: ApiRequestInputInvoice, requestInfo: any, shouldSave?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const result = await callApi('validateRequestedInfo', {
    inputInvoice, requestInfo, shouldSave,
  });
  if (!result) {
    return;
  }

  const { id, shippingOptions } = result;
  global = getGlobal();

  global = setRequestInfoId(global, id, tabId);
  if (shippingOptions) {
    global = updateShippingOptions(global, shippingOptions, tabId);
    global = setPaymentStep(global, PaymentStep.Shipping, tabId);
  } else {
    global = setPaymentStep(global, PaymentStep.Checkout, tabId);
  }
  setGlobal(global);
}
