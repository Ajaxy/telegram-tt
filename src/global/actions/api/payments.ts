import type {
  ApiInputInvoice, ApiInputInvoiceStarGift, ApiRequestInputInvoice,
} from '../../../api/types';
import type { ApiCredentials } from '../../../components/payment/PaymentModal';
import type { RegularLangFnParameters } from '../../../util/localization';
import type {
  ActionReturnType, GlobalState, TabArgs,
} from '../../types';
import { PaymentStep } from '../../../types';

import { DEBUG_PAYMENT_SMART_GLOCAL } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import * as langProvider from '../../../util/oldLangProvider';
import { getStripeError } from '../../../util/payments/stripe';
import { buildQueryString } from '../../../util/requestQuery';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import { callApi } from '../../../api/gramjs';
import { isChatChannel, isChatSuperGroup } from '../../helpers';
import {
  getRequestInputInvoice,
  getRequestInputSavedStarGift,
} from '../../helpers/payments';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import {
  closeInvoice,
  openStarsTransactionFromReceipt,
  setPaymentStep,
  setReceipt,
  setRequestInfoId,
  setSmartGlocalCardInfo,
  setStripeCardInfo,
  updateChatFullInfo,
  updatePayment,
  updateShippingOptions,
  updateStarsPayment,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatFullInfo,
  selectPaymentInputInvoice,
  selectPaymentRequestId,
  selectProviderPublicToken,
  selectProviderPublishableKey,
  selectSmartGlocalCredentials,
  selectStarsPayment,
  selectStripeCredentials,
  selectTabState,
} from '../../selectors';

const LOCAL_BOOST_COOLDOWN = 86400; // 24 hours

addActionHandler('validateRequestedInfo', (global, actions, payload): ActionReturnType => {
  const { requestInfo, saveInfo, tabId = getCurrentTabId() } = payload;

  const inputInvoice = selectPaymentInputInvoice(global, tabId);
  if (!inputInvoice) {
    return;
  }

  const requestInputInvoice = getRequestInputInvoice(global, inputInvoice);
  if (!requestInputInvoice) {
    return;
  }

  validateRequestedInfo(global, requestInputInvoice, requestInfo, saveInfo, tabId);
});

addActionHandler('openInvoice', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId(), ...inputInvoice } = payload;

  const requestInputInvoice = getRequestInputInvoice(global, inputInvoice);
  if (!requestInputInvoice) {
    return;
  }

  global = updateTabState(global, {
    isPaymentFormLoading: true,
  }, tabId);
  setGlobal(global);

  const theme = extractCurrentThemeParams();
  const form = await callApi('getPaymentForm', requestInputInvoice, theme);

  if (!form) {
    return;
  }

  global = getGlobal();

  global = updateTabState(global, {
    isPaymentFormLoading: false,
  }, tabId);

  if ('error' in form) {
    setGlobal(global);
    return;
  }

  if (form.type === 'regular') {
    global = updatePayment(global, {
      inputInvoice: payload,
      form,
      isPaymentModalOpen: true,
      isExtendedMedia: (payload as any).isExtendedMedia,
      status: undefined,
    }, tabId);
    global = setPaymentStep(global, PaymentStep.Checkout, tabId);
  }

  if (form.type === 'stars') {
    global = updateTabState(global, {
      starsPayment: {
        inputInvoice,
        form,
        status: 'pending',
      },
    }, tabId);
  }

  setGlobal(global);
});

addActionHandler('sendStarGift', (global, actions, payload): ActionReturnType => {
  const {
    gift, peerId, message, shouldHideName, shouldUpgrade, tabId = getCurrentTabId(),
  } = payload;

  const inputInvoice: ApiInputInvoiceStarGift = {
    type: 'stargift',
    peerId,
    giftId: gift.id,
    message,
    shouldHideName,
    shouldUpgrade: shouldUpgrade || undefined,
  };

  payInputStarInvoice(global, inputInvoice, gift.stars, tabId);
});

addActionHandler('getReceipt', async (global, actions, payload): Promise<void> => {
  const {
    chatId, messageId, tabId = getCurrentTabId(),
  } = payload;
  const chat = chatId && selectChat(global, chatId);
  if (!messageId || !chat) {
    return;
  }

  const result = await callApi('getReceipt', chat, messageId);
  if (!result) {
    return;
  }

  global = getGlobal();
  if (result.receipt.type === 'stars') {
    global = openStarsTransactionFromReceipt(global, result.receipt, tabId);
  } else {
    global = setReceipt(global, result.receipt, tabId);
  }
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

  const { nativeProvider } = selectTabState(global, tabId).payment.form!;
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
  const requestInfoId = selectPaymentRequestId(global, tabId);
  const paymentState = selectTabState(global, tabId).payment;
  const { form, temporaryPassword, inputInvoice } = paymentState;

  if (!inputInvoice || !form) {
    return;
  }

  const { nativeProvider, formId } = form;

  const requestInputInvoice = getRequestInputInvoice(global, inputInvoice);
  if (!requestInputInvoice) {
    return;
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

  actions.apiUpdate({
    '@type': 'updatePaymentStateCompleted',
    paymentState,
    tabId,
  });
});

addActionHandler('sendStarPaymentForm', async (global, actions, payload): Promise<void> => {
  const { directInfo, tabId = getCurrentTabId() } = payload;
  const starPayment = selectStarsPayment(global, tabId);
  const inputInvoice = starPayment?.inputInvoice || directInfo?.inputInvoice;
  if (!inputInvoice) return;

  const requestInputInvoice = getRequestInputInvoice(global, inputInvoice);
  if (!requestInputInvoice) {
    return;
  }

  const formId = (starPayment.form?.formId || starPayment.subscriptionInfo?.subscriptionFormId || directInfo?.formId)!;

  global = updateStarsPayment(global, { status: 'pending' }, tabId);
  setGlobal(global);

  const result = await callApi('sendStarPaymentForm', {
    inputInvoice: requestInputInvoice,
    formId,
  });

  if (!result) {
    global = getGlobal();
    global = updateStarsPayment(global, { status: 'failed' }, tabId);
    setGlobal(global);
    actions.closeStarsPaymentModal({ tabId });
    actions.closeGiftModal({ tabId });
    return;
  }

  global = getGlobal();
  global = updateStarsPayment(global, { status: 'paid' }, tabId);
  setGlobal(global);
  actions.closeStarsPaymentModal({ tabId });

  if ('channelId' in result) {
    actions.openChat({ id: result.channelId, tabId });
  }

  actions.apiUpdate({
    '@type': 'updateStarPaymentStateCompleted',
    paymentState: directInfo ? { inputInvoice } : starPayment,
    tabId,
  });
  actions.loadStarStatus();
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

  const tokenizeUrl = selectTabState(global, tabId).payment.form?.nativeParams.tokenizeUrl;

  let url;
  if (DEBUG_PAYMENT_SMART_GLOCAL) {
    url = 'https://tgb-playground.smart-glocal.com/cds/v1/tokenize/card';
  } else {
    url = 'https://tgb.smart-glocal.com/cds/v1/tokenize/card';
  }

  if (tokenizeUrl?.startsWith('https://')
      && tokenizeUrl.endsWith('.smart-glocal.com/cds/v1/tokenize/card')) {
    url = tokenizeUrl;
  }

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
    const error = { descriptionKey: { key: 'ErrorUnexpected' } satisfies RegularLangFnParameters };
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

addActionHandler('setSmartGlocalCardInfo', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), type, token } = payload;
  return setSmartGlocalCardInfo(global, {
    type,
    token,
  }, tabId);
});

addActionHandler('setPaymentStep', (global, actions, payload): ActionReturnType => {
  const { step, tabId = getCurrentTabId() } = payload;
  return setPaymentStep(global, step ?? PaymentStep.Checkout, tabId);
});

addActionHandler('closePremiumModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const tabState = selectTabState(global, tabId);
  if (!tabState.premiumModal) return undefined;
  return updateTabState(global, {
    premiumModal: {
      promo: tabState.premiumModal.promo, // Cache promo
      isOpen: false,
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

  actions.closeReactionPicker({ tabId });
});

addActionHandler('openGiveawayModal', async (global, actions, payload): Promise<void> => {
  const {
    chatId, prepaidGiveaway,
    tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('getPremiumGiftCodeOptions', {
    chat,
  });

  const starOptions = await callApi('fetchStarsGiveawayOptions');

  if (!result || !starOptions) {
    return;
  }

  global = getGlobal();

  global = updateTabState(global, {
    giveawayModal: {
      chatId,
      gifts: result,
      isOpen: true,
      prepaidGiveaway,
      starOptions,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openGiftModal', async (global, actions, payload): Promise<void> => {
  const {
    forUserId, tabId = getCurrentTabId(),
  } = payload;

  const gifts = await callApi('getPremiumGiftCodeOptions', {});
  if (!gifts) return;

  global = getGlobal();
  global = updateTabState(global, {
    giftModal: {
      forPeerId: forUserId,
      gifts,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openStarsGiftModal', async (global, actions, payload): Promise<void> => {
  const {
    forUserId,
    tabId = getCurrentTabId(),
  } = payload || {};

  const starsGiftOptions = await callApi('getStarsGiftOptions', {});

  global = getGlobal();
  global = updateTabState(global, {
    starsGiftModal: {
      isOpen: true,
      forUserId,
      starsGiftOptions,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('validatePaymentPassword', async (global, actions, payload): Promise<void> => {
  const { password, tabId = getCurrentTabId() } = payload;
  const result = await callApi('fetchTemporaryPaymentPassword', password);

  global = getGlobal();

  if (!result) {
    global = updatePayment(global, { error: { messageKey: { key: 'ErrorUnexpected' }, field: 'password' } }, tabId);
  } else if ('error' in result) {
    global = updatePayment(global, { error: { messageKey: result.messageKey, field: 'password' } }, tabId);
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
  if (shippingOptions?.length) {
    global = updateShippingOptions(global, shippingOptions, tabId);
    global = setPaymentStep(global, PaymentStep.Shipping, tabId);
  } else {
    global = setPaymentStep(global, PaymentStep.Checkout, tabId);
  }
  setGlobal(global);
}

addActionHandler('openBoostModal', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat || !(isChatChannel(chat) || isChatSuperGroup(chat))) return;

  global = updateTabState(global, {
    boostModal: {
      chatId,
    },
  }, tabId);
  setGlobal(global);

  const result = await callApi('fetchBoostStatus', {
    chat,
  });

  if (!result) {
    actions.closeBoostModal({ tabId });
    return;
  }

  global = getGlobal();
  global = updateTabState(global, {
    boostModal: {
      chatId,
      boostStatus: result,
    },
  }, tabId);
  setGlobal(global);

  const myBoosts = await callApi('fetchMyBoosts');

  if (!myBoosts) return;

  global = getGlobal();
  const tabState = selectTabState(global, tabId);
  if (!tabState.boostModal) return;

  global = updateTabState(global, {
    boostModal: {
      ...tabState.boostModal,
      myBoosts: myBoosts.boosts,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openBoostStatistics', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  global = updateTabState(global, {
    boostStatistics: {
      chatId,
    },
  }, tabId);
  setGlobal(global);

  const [boostListResult, boostListGiftResult,
    boostStatusResult] = await Promise.all([
    callApi('fetchBoostList', { chat }),
    callApi('fetchBoostList', { chat, isGifts: true }),
    callApi('fetchBoostStatus', { chat }),
  ]);

  global = getGlobal();
  if (!boostListResult || !boostListGiftResult || !boostStatusResult) {
    global = updateTabState(global, {
      boostStatistics: undefined,
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    boostStatistics: {
      chatId,
      boostStatus: boostStatusResult,
      nextOffset: boostListResult.nextOffset,
      boosts: {
        count: boostListResult.count,
        list: boostListResult.boostList,
      },
      giftedBoosts: {
        count: boostListGiftResult?.count,
        list: boostListGiftResult?.boostList,
      },
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openMonetizationStatistics', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  global = updateTabState(global, {
    monetizationStatistics: {
      chatId,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadMoreBoosters', async (global, actions, payload): Promise<void> => {
  const { isGifts, tabId = getCurrentTabId() } = payload || {};
  let tabState = selectTabState(global, tabId);
  if (!tabState.boostStatistics) return;

  const chat = selectChat(global, tabState.boostStatistics.chatId);
  if (!chat) return;

  global = updateTabState(global, {
    boostStatistics: {
      ...tabState.boostStatistics,
      isLoadingBoosters: true,
    },
  }, tabId);
  setGlobal(global);

  const result = await callApi('fetchBoostList', {
    chat,
    offset: tabState.boostStatistics.nextOffset,
    isGifts,
  });
  if (!result) return;

  global = getGlobal();

  tabState = selectTabState(global, tabId);
  if (!tabState.boostStatistics) return;

  const updatedBoostList = (isGifts
    ? tabState.boostStatistics.giftedBoosts?.list || []
    : tabState.boostStatistics.boosts?.list || []).concat(result.boostList);

  global = updateTabState(global, {
    boostStatistics: {
      ...tabState.boostStatistics,
      nextOffset: result.nextOffset,
      isLoadingBoosters: false,
      [isGifts ? 'giftedBoosts' : 'boosts']: {
        count: result.count,
        list: updatedBoostList,
      },
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('applyBoost', async (global, actions, payload): Promise<void> => {
  const { chatId, slots, tabId = getCurrentTabId() } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const oldChatFullInfo = selectChatFullInfo(global, chatId);
  const oldBoostsApplied = oldChatFullInfo?.boostsApplied || 0;

  const appliedBoostsCount = slots.length;

  let tabState = selectTabState(global, tabId);
  const oldStatus = tabState.boostModal?.boostStatus;

  if (oldStatus) {
    const boostsPerLevel = oldStatus.nextLevelBoosts ? oldStatus.nextLevelBoosts - oldStatus.currentLevelBoosts : 1;
    const newBoosts = oldStatus.boosts + appliedBoostsCount;
    const isLevelUp = oldStatus.nextLevelBoosts && newBoosts >= oldStatus.nextLevelBoosts;
    const newCurrentLevelBoosts = isLevelUp ? oldStatus.nextLevelBoosts! : oldStatus.currentLevelBoosts;
    const newNextLevelBoosts = isLevelUp ? oldStatus.nextLevelBoosts! + boostsPerLevel : oldStatus.nextLevelBoosts;

    global = updateTabState(global, {
      boostModal: {
        ...tabState.boostModal!,
        boostStatus: {
          ...oldStatus,
          level: isLevelUp ? oldStatus.level + 1 : oldStatus.level,
          currentLevelBoosts: newCurrentLevelBoosts,
          nextLevelBoosts: newNextLevelBoosts,
          hasMyBoost: true,
          boosts: newBoosts,
        },
      },
    }, tabId);
    setGlobal(global);
  }

  global = getGlobal();
  tabState = selectTabState(global, tabId);
  const oldMyBoosts = tabState.boostModal?.myBoosts;

  if (oldMyBoosts) {
    const unixNow = Math.floor(Date.now() / 1000);
    const newMyBoosts = oldMyBoosts.map((boost) => {
      if (slots.includes(boost.slot)) {
        return {
          ...boost,
          chatId,
          date: unixNow,
          cooldownUntil: unixNow + LOCAL_BOOST_COOLDOWN, // Will be refetched below
        };
      }
      return boost;
    });

    global = updateTabState(global, {
      boostModal: {
        ...tabState.boostModal!,
        myBoosts: newMyBoosts,
      },
    }, tabId);
    setGlobal(global);
  }

  const result = await callApi('applyBoost', {
    slots,
    chat,
  });

  global = getGlobal();

  if (!result) {
    // Rollback local changes
    const boostModal = selectTabState(global, tabId).boostModal;
    if (boostModal) {
      global = updateTabState(global, {
        boostModal: {
          ...boostModal,
          boostStatus: oldStatus,
          myBoosts: oldMyBoosts,
        },
      }, tabId);
      setGlobal(global);
    }
    return;
  }

  tabState = selectTabState(global, tabId);
  if (oldChatFullInfo) {
    global = updateChatFullInfo(global, chatId, {
      boostsApplied: oldBoostsApplied + slots.length,
    });
  }

  if (tabState.boostModal) {
    global = updateTabState(global, {
      boostModal: {
        ...tabState.boostModal,
        myBoosts: result.boosts,
      },
    }, tabId);
  }
  setGlobal(global);
});

addActionHandler('checkGiftCode', async (global, actions, payload): Promise<void> => {
  const { slug, message, tabId = getCurrentTabId() } = payload;

  const result = await callApi('checkGiftCode', {
    slug,
  });

  if (!result) {
    actions.showNotification({
      message: langProvider.oldTranslate('lng_gift_link_expired'),
      tabId,
    });
    return;
  }

  global = getGlobal();
  global = updateTabState(global, {
    giftCodeModal: {
      slug,
      info: result.code,
      message,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('applyGiftCode', async (global, actions, payload): Promise<void> => {
  const { slug, tabId = getCurrentTabId() } = payload;

  const result = await callApi('applyGiftCode', {
    slug,
  });

  if (!result) {
    return;
  }
  actions.requestConfetti({ withStars: true, tabId });
  actions.closeGiftCodeModal({ tabId });
});

addActionHandler('launchPrepaidGiveaway', async (global, actions, payload): Promise<void> => {
  const {
    chatId, giveawayId, paymentPurpose, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const additionalChannels = paymentPurpose?.additionalChannelIds?.map((id) => selectChat(global, id)).filter(Boolean);

  const result = await callApi('launchPrepaidGiveaway', {
    chat,
    giveawayId,
    paymentPurpose: {
      type: 'giveaway',
      chat,
      areWinnersVisible: paymentPurpose?.areWinnersVisible,
      additionalChannels,
      countries: paymentPurpose?.countries,
      prizeDescription: paymentPurpose.prizeDescription,
      untilDate: paymentPurpose.untilDate,
      currency: paymentPurpose.currency,
      amount: paymentPurpose.amount,
    },
  });

  if (!result) {
    return;
  }

  actions.openBoostStatistics({ chatId, tabId });
});

addActionHandler('launchPrepaidStarsGiveaway', async (global, actions, payload): Promise<void> => {
  const {
    chatId, giveawayId, paymentPurpose, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const additionalChannels = paymentPurpose?.additionalChannelIds?.map((id) => selectChat(global, id)).filter(Boolean);

  const result = await callApi('launchPrepaidGiveaway', {
    chat,
    giveawayId,
    paymentPurpose: {
      type: 'starsgiveaway',
      chat,
      areWinnersVisible: paymentPurpose?.areWinnersVisible,
      additionalChannels,
      countries: paymentPurpose?.countries,
      prizeDescription: paymentPurpose.prizeDescription,
      untilDate: paymentPurpose.untilDate,
      currency: paymentPurpose.currency,
      amount: paymentPurpose.amount,
      stars: paymentPurpose.stars,
      users: paymentPurpose.users,
    },
  });

  if (!result) {
    return;
  }

  actions.openBoostStatistics({ chatId, tabId });
});

addActionHandler('upgradeGift', (global, actions, payload): ActionReturnType => {
  const {
    gift, shouldKeepOriginalDetails, upgradeStars, tabId = getCurrentTabId(),
  } = payload;

  const requestSavedGift = getRequestInputSavedStarGift(global, gift);
  if (!requestSavedGift) {
    return;
  }

  global = updateTabState(global, {
    isWaitingForStarGiftUpgrade: true,
  }, tabId);

  setGlobal(global);
  global = getGlobal();

  actions.closeGiftUpgradeModal({ tabId });
  actions.closeGiftInfoModal({ tabId });

  if (!upgradeStars) {
    callApi('upgradeStarGift', {
      inputSavedGift: requestSavedGift,
      shouldKeepOriginalDetails: shouldKeepOriginalDetails || undefined,
    });

    return;
  }

  const invoice: ApiInputInvoice = {
    type: 'stargiftUpgrade',
    inputSavedGift: gift,
    shouldKeepOriginalDetails: shouldKeepOriginalDetails || undefined,
  };

  payInputStarInvoice(global, invoice, upgradeStars, tabId);
});

addActionHandler('transferGift', (global, actions, payload): ActionReturnType => {
  const {
    gift, recipientId, transferStars, tabId = getCurrentTabId(),
  } = payload;

  const peer = selectChat(global, recipientId);

  const requestSavedGift = getRequestInputSavedStarGift(global, gift);
  if (!peer || !requestSavedGift) {
    return;
  }

  global = updateTabState(global, {
    isWaitingForStarGiftTransfer: true,
  }, tabId);

  setGlobal(global);
  global = getGlobal();

  actions.closeGiftTransferModal({ tabId });
  actions.closeGiftInfoModal({ tabId });

  if (!transferStars) {
    callApi('transferStarGift', {
      inputSavedGift: requestSavedGift,
      toPeer: peer,
    });

    return;
  }

  const invoice: ApiInputInvoice = {
    type: 'stargiftTransfer',
    inputSavedGift: gift,
    recipientId,
  };

  payInputStarInvoice(global, invoice, transferStars, tabId);
});

async function payInputStarInvoice<T extends GlobalState>(
  global: T, inputInvoice: ApiInputInvoice, price: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const actions = getActions();
  const balance = global.stars?.balance;

  if (balance === undefined) return;

  if (balance.amount < price) {
    actions.openStarsBalanceModal({ tabId });
    return;
  }

  const requestInputInvoice = getRequestInputInvoice(global, inputInvoice);
  if (!requestInputInvoice) {
    return;
  }

  global = updateTabState(global, {
    isPaymentFormLoading: true,
  }, tabId);
  setGlobal(global);

  const theme = extractCurrentThemeParams();
  const form = await callApi('getPaymentForm', requestInputInvoice, theme);

  if (!form) {
    return;
  }

  global = getGlobal();

  global = updateTabState(global, {
    isPaymentFormLoading: false,
  }, tabId);
  setGlobal(global);

  if ('error' in form) {
    return;
  }

  actions.sendStarPaymentForm({
    directInfo: {
      inputInvoice,
      formId: form.formId,
    },
    tabId,
  });
}

addActionHandler('openUniqueGiftBySlug', async (global, actions, payload): Promise<void> => {
  const {
    slug, tabId = getCurrentTabId(),
  } = payload;

  const gift = await callApi('fetchUniqueStarGift', { slug });

  if (!gift) {
    actions.showNotification({
      message: {
        key: 'GiftWasNotFound',
      },
      tabId,
    });
    return;
  }

  actions.openGiftInfoModal({ gift, tabId });
});

addActionHandler('processStarGiftWithdrawal', async (global, actions, payload): Promise<void> => {
  const {
    gift, password, tabId = getCurrentTabId(),
  } = payload;

  let giftWithdrawModal = selectTabState(global, tabId).giftWithdrawModal;
  if (!giftWithdrawModal) return;

  global = updateTabState(global, {
    giftWithdrawModal: {
      ...giftWithdrawModal,
      isLoading: true,
      errorKey: undefined,
    },
  }, tabId);
  setGlobal(global);

  const inputGift = getRequestInputSavedStarGift(global, gift);
  if (!inputGift) {
    return;
  }

  const result = await callApi('fetchStarGiftWithdrawalUrl', { inputGift, password });

  if (!result) {
    return;
  }

  global = getGlobal();
  giftWithdrawModal = selectTabState(global, tabId).giftWithdrawModal;
  if (!giftWithdrawModal) return;

  if ('error' in result) {
    global = updateTabState(global, {
      giftWithdrawModal: {
        ...giftWithdrawModal,
        isLoading: false,
        errorKey: result.messageKey,
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  actions.openUrl({ url: result.url, shouldSkipModal: true, tabId });
  actions.closeGiftWithdrawModal({ tabId });
});
