import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiPremiumSection } from '../../../global/types';
import type {
  ApiBoost,
  ApiBoostsStatus,
  ApiCheckedGiftCode,
  ApiGiveawayInfo,
  ApiInvoice, ApiLabeledPrice, ApiMyBoost, ApiPaymentCredentials,
  ApiPaymentForm, ApiPaymentSavedInfo, ApiPremiumGiftCodeOption, ApiPremiumPromo, ApiPremiumSubscriptionOption,
  ApiReceipt,
  ApiStarsTransaction,
  ApiStarsTransactionPeer,
  ApiStarTopupOption,
  BoughtPaidMedia,
} from '../../types';

import { addWebDocumentToLocalDb } from '../helpers';
import { buildApiMessageEntity } from './common';
import { omitVirtualClassFields } from './helpers';
import { buildApiDocument, buildApiWebDocument, buildMessageMediaContent } from './messageContent';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildPrepaidGiveaway, buildStatisticsPercentage } from './statistics';

export function buildShippingOptions(shippingOptions: GramJs.ShippingOption[] | undefined) {
  if (!shippingOptions) {
    return undefined;
  }

  return Object.values(shippingOptions).map((option) => {
    return {
      id: option.id,
      title: option.title,
      amount: option.prices.reduce((ac, cur) => ac + cur.amount.toJSNumber(), 0),
      prices: option.prices.map(({ label, amount }) => {
        return {
          label,
          amount: amount.toJSNumber(),
        };
      }),
    };
  });
}

export function buildApiReceipt(receipt: GramJs.payments.TypePaymentReceipt): ApiReceipt {
  const { photo } = receipt;

  if (photo) {
    addWebDocumentToLocalDb(photo);
  }

  if (receipt instanceof GramJs.payments.PaymentReceiptStars) {
    const {
      botId, currency, date, description: text, title, totalAmount, transactionId,
    } = receipt;

    if (photo) {
      addWebDocumentToLocalDb(photo);
    }

    return {
      type: 'stars',
      currency,
      botId: buildApiPeerId(botId, 'user'),
      date,
      text,
      title,
      totalAmount: -totalAmount.toJSNumber(),
      transactionId,
      photo: photo && buildApiWebDocument(photo),
    };
  }

  const {
    invoice,
    info,
    shipping,
    currency,
    totalAmount,
    credentialsTitle,
    tipAmount,
    title,
    description: text,
  } = receipt;

  const { shippingAddress, phone, name } = (info || {});

  const { prices } = invoice;
  const mappedPrices: ApiLabeledPrice[] = prices.map(({ label, amount }) => ({
    label,
    amount: amount.toJSNumber(),
  }));

  let shippingPrices: ApiLabeledPrice[] | undefined;
  let shippingMethod: string | undefined;

  if (shipping) {
    shippingPrices = shipping.prices.map(({ label, amount }) => {
      return {
        label,
        amount: amount.toJSNumber(),
      };
    });
    shippingMethod = shipping.title;
  }

  return {
    type: 'regular',
    currency,
    prices: mappedPrices,
    info: { shippingAddress, phone, name },
    totalAmount: totalAmount.toJSNumber(),
    credentialsTitle,
    shippingPrices,
    shippingMethod,
    tipAmount: tipAmount ? tipAmount.toJSNumber() : 0,
    title,
    text,
    photo: photo && buildApiWebDocument(photo),
  };
}

export function buildApiPaymentForm(form: GramJs.payments.TypePaymentForm): ApiPaymentForm {
  if (form instanceof GramJs.payments.PaymentFormStars) {
    const { botId, formId } = form;

    return {
      type: 'stars',
      botId: buildApiPeerId(botId, 'user'),
      formId: String(formId),
    };
  }

  const {
    formId,
    canSaveCredentials,
    passwordMissing: isPasswordMissing,
    providerId,
    nativeProvider,
    nativeParams,
    savedInfo,
    invoice,
    savedCredentials,
    url,
    botId,
  } = form;

  const {
    test: isTest,
    nameRequested: isNameRequested,
    phoneRequested: isPhoneRequested,
    emailRequested: isEmailRequested,
    shippingAddressRequested: isShippingAddressRequested,
    flexible: isFlexible,
    phoneToProvider: shouldSendPhoneToProvider,
    emailToProvider: shouldSendEmailToProvider,
    currency,
    prices,
  } = invoice;

  const mappedPrices: ApiLabeledPrice[] = prices.map(({ label, amount }) => ({
    label,
    amount: amount.toJSNumber(),
  }));
  const { shippingAddress } = savedInfo || {};
  const cleanedInfo: ApiPaymentSavedInfo | undefined = savedInfo ? omitVirtualClassFields(savedInfo) : undefined;
  if (cleanedInfo && shippingAddress) {
    cleanedInfo.shippingAddress = omitVirtualClassFields(shippingAddress);
  }

  const nativeData = nativeParams ? JSON.parse(nativeParams.data) : {};

  return {
    type: 'regular',
    url,
    botId: buildApiPeerId(botId, 'user'),
    canSaveCredentials,
    isPasswordMissing,
    formId: String(formId),
    providerId: String(providerId),
    nativeProvider,
    savedInfo: cleanedInfo,
    invoiceContainer: {
      isTest,
      isNameRequested,
      isPhoneRequested,
      isEmailRequested,
      isShippingAddressRequested,
      isFlexible,
      shouldSendPhoneToProvider,
      shouldSendEmailToProvider,
      currency,
      prices: mappedPrices,
    },
    nativeParams: {
      needCardholderName: Boolean(nativeData?.need_cardholder_name),
      needCountry: Boolean(nativeData?.need_country),
      needZip: Boolean(nativeData?.need_zip),
      publishableKey: nativeData?.publishable_key,
      publicToken: nativeData?.public_token,
      tokenizeUrl: nativeData?.tokenize_url,
    },
    savedCredentials: savedCredentials && buildApiPaymentCredentials(savedCredentials),
  };
}

export function buildApiInvoiceFromForm(form: GramJs.payments.TypePaymentForm): ApiInvoice {
  const {
    invoice, description: text, title, photo,
  } = form;
  const {
    test, currency, prices, recurring, termsUrl, maxTipAmount, suggestedTipAmounts,
  } = invoice;

  const totalAmount = prices.reduce((ac, cur) => ac + cur.amount.toJSNumber(), 0);

  return {
    mediaType: 'invoice',
    text,
    title,
    photo: buildApiWebDocument(photo),
    amount: totalAmount,
    currency,
    isTest: test,
    isRecurring: recurring,
    termsUrl,
    maxTipAmount: maxTipAmount?.toJSNumber(),
    ...(suggestedTipAmounts && { suggestedTipAmounts: suggestedTipAmounts.map((tip) => tip.toJSNumber()) }),
  };
}

export function buildApiPremiumPromo(promo: GramJs.help.PremiumPromo): ApiPremiumPromo {
  const {
    statusText, statusEntities, videos, videoSections, periodOptions,
  } = promo;

  return {
    statusText,
    statusEntities: statusEntities.map(buildApiMessageEntity),
    videoSections: videoSections as ApiPremiumSection[],
    videos: videos.map(buildApiDocument).filter(Boolean),
    options: periodOptions.map(buildApiPremiumSubscriptionOption),
  };
}

function buildApiPremiumSubscriptionOption(option: GramJs.PremiumSubscriptionOption): ApiPremiumSubscriptionOption {
  const {
    current, canPurchaseUpgrade, currency, amount, botUrl, months,
  } = option;

  return {
    isCurrent: current,
    canPurchaseUpgrade,
    currency,
    amount: amount.toJSNumber(),
    botUrl,
    months,
  };
}

export function buildApiPaymentCredentials(credentials: GramJs.PaymentSavedCredentialsCard[]): ApiPaymentCredentials[] {
  return credentials.map(({ id, title }) => ({ id, title }));
}

export function buildApiBoostsStatus(boostStatus: GramJs.premium.BoostsStatus): ApiBoostsStatus {
  const {
    level, boostUrl, boosts, myBoost, currentLevelBoosts, nextLevelBoosts, premiumAudience, prepaidGiveaways,
  } = boostStatus;
  return {
    level,
    currentLevelBoosts,
    boosts,
    hasMyBoost: Boolean(myBoost),
    boostUrl,
    nextLevelBoosts,
    ...(premiumAudience && { premiumSubscribers: buildStatisticsPercentage(premiumAudience) }),
    ...(prepaidGiveaways && { prepaidGiveaways: prepaidGiveaways.map(buildPrepaidGiveaway) }),
  };
}

export function buildApiBoost(boost: GramJs.Boost): ApiBoost {
  const {
    userId,
    multiplier,
    expires,
    giveaway,
    gift,
  } = boost;

  return {
    userId: userId && buildApiPeerId(userId, 'user'),
    multiplier,
    expires,
    isFromGiveaway: giveaway,
    isGift: gift,
  };
}

export function buildApiMyBoost(myBoost: GramJs.MyBoost): ApiMyBoost {
  const {
    date, expires, slot, cooldownUntilDate, peer,
  } = myBoost;

  return {
    date,
    expires,
    slot,
    cooldownUntil: cooldownUntilDate,
    chatId: peer && getApiChatIdFromMtpPeer(peer),
  };
}

export function buildApiGiveawayInfo(info: GramJs.payments.TypeGiveawayInfo): ApiGiveawayInfo | undefined {
  if (info instanceof GramJs.payments.GiveawayInfo) {
    const {
      startDate,
      adminDisallowedChatId,
      disallowedCountry,
      joinedTooEarlyDate,
      participating,
      preparingResults,
    } = info;

    return {
      type: 'active',
      startDate,
      isParticipating: participating,
      adminDisallowedChatId: adminDisallowedChatId && buildApiPeerId(adminDisallowedChatId, 'channel'),
      disallowedCountry,
      joinedTooEarlyDate,
      isPreparingResults: preparingResults,
    };
  } else {
    const {
      activatedCount,
      finishDate,
      giftCodeSlug,
      winner,
      refunded,
      startDate,
      winnersCount,
    } = info;

    return {
      type: 'results',
      startDate,
      activatedCount,
      finishDate,
      winnersCount,
      giftCodeSlug,
      isRefunded: refunded,
      isWinner: winner,
    };
  }
}

export function buildApiCheckedGiftCode(giftcode: GramJs.payments.TypeCheckedGiftCode): ApiCheckedGiftCode {
  const {
    date, fromId, months, giveawayMsgId, toId, usedDate, viaGiveaway,
  } = giftcode;

  return {
    date,
    months,
    toId: toId && buildApiPeerId(toId, 'user'),
    fromId: fromId && getApiChatIdFromMtpPeer(fromId),
    usedAt: usedDate,
    isFromGiveaway: viaGiveaway,
    giveawayMessageId: giveawayMsgId,
  };
}

export function buildApiPremiumGiftCodeOption(option: GramJs.PremiumGiftCodeOption): ApiPremiumGiftCodeOption {
  const {
    amount, currency, months, users,
  } = option;

  return {
    amount: amount.toJSNumber(),
    currency,
    months,
    users,
  };
}

export function buildApiStarsTransactionPeer(peer: GramJs.TypeStarsTransactionPeer): ApiStarsTransactionPeer {
  if (peer instanceof GramJs.StarsTransactionPeerAppStore) {
    return { type: 'appStore' };
  }

  if (peer instanceof GramJs.StarsTransactionPeerPlayMarket) {
    return { type: 'playMarket' };
  }

  if (peer instanceof GramJs.StarsTransactionPeerPremiumBot) {
    return { type: 'premiumBot' };
  }

  if (peer instanceof GramJs.StarsTransactionPeerFragment) {
    return { type: 'fragment' };
  }

  if (peer instanceof GramJs.StarsTransactionPeerAds) {
    return { type: 'ads' };
  }

  if (peer instanceof GramJs.StarsTransactionPeer) {
    return { type: 'peer', id: getApiChatIdFromMtpPeer(peer.peer) };
  }

  return { type: 'unsupported' };
}

export function buildApiStarsTransaction(transaction: GramJs.StarsTransaction): ApiStarsTransaction {
  const {
    date, id, peer, stars, description, photo, title, refund, extendedMedia, failed, msgId, pending,
  } = transaction;

  if (photo) {
    addWebDocumentToLocalDb(photo);
  }

  const boughtExtendedMedia = extendedMedia?.map((m) => buildMessageMediaContent(m))
    .filter(Boolean) as BoughtPaidMedia[];

  return {
    id,
    date,
    peer: buildApiStarsTransactionPeer(peer),
    stars: stars.toJSNumber(),
    title,
    description,
    photo: photo && buildApiWebDocument(photo),
    isRefund: refund,
    hasFailed: failed,
    isPending: pending,
    messageId: msgId,
    extendedMedia: boughtExtendedMedia,
  };
}

export function buildApiStarTopupOption(option: GramJs.TypeStarsTopupOption): ApiStarTopupOption {
  const {
    amount, currency, stars, extended,
  } = option;

  return {
    amount: amount.toJSNumber(),
    currency,
    stars: stars.toJSNumber(),
    isExtended: extended,
  };
}
