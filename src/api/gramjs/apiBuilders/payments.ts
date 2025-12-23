import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiBoost,
  ApiBoostsStatus,
  ApiCheckedGiftCode,
  ApiGiveawayInfo,
  ApiInvoice,
  ApiLabeledPrice,
  ApiMyBoost,
  ApiPaymentCredentials,
  ApiPaymentForm,
  ApiPaymentSavedInfo,
  ApiPremiumGiftCodeOption,
  ApiPremiumPromo,
  ApiPremiumSection,
  ApiPremiumSubscriptionOption,
  ApiPrepaidGiveaway,
  ApiPrepaidStarsGiveaway,
  ApiReceipt,
  ApiStarGiveawayOption,
  ApiStarsGiveawayWinnerOption,
  ApiStarsSubscription,
  ApiStarsTransaction,
  ApiStarsTransactionPeer,
  ApiStarTopupOption,
  ApiTypeCurrencyAmount,
  ApiUniqueStarGiftValueInfo,
  BoughtPaidMedia,
} from '../../types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../config';
import { toJSNumber } from '../../../util/numbers';
import { addWebDocumentToLocalDb } from '../helpers/localDb';
import { buildApiStarsSubscriptionPricing } from './chats';
import { buildApiMessageEntity } from './common';
import { buildApiStarGift } from './gifts';
import { omitVirtualClassFields } from './helpers';
import { buildApiDocument, buildApiWebDocument, buildMessageMediaContent } from './messageContent';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildStatisticsPercentage } from './statistics';

export function buildShippingOptions(shippingOptions: GramJs.ShippingOption[] | undefined) {
  if (!shippingOptions) {
    return undefined;
  }

  return shippingOptions.map((option) => {
    return {
      id: option.id,
      title: option.title,

      amount: option.prices.reduce((ac, cur) => ac + toJSNumber(cur.amount), 0),
      prices: option.prices.map(({ label, amount }) => {
        return {
          label,
          amount: toJSNumber(amount),
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
      botId, currency, date, description, title, totalAmount, transactionId, invoice,
    } = receipt;

    return {
      type: 'stars',
      currency,
      date,
      botId: buildApiPeerId(botId, 'user'),
      description,
      title,
      totalAmount: -toJSNumber(totalAmount),
      transactionId,
      photo: buildApiWebDocument(photo),
      invoice: buildApiInvoice(invoice),
    };
  }

  const {
    invoice,
    info,
    shipping,
    totalAmount,
    credentialsTitle,
    tipAmount,
    title,
    description,
    botId,
    currency,
    date,
    providerId,
  } = receipt;

  const { shippingAddress, phone, name } = (info || {});

  let shippingPrices: ApiLabeledPrice[] | undefined;
  let shippingMethod: string | undefined;

  if (shipping) {
    shippingPrices = shipping.prices.map(({ label, amount }) => {
      return {
        label,
        amount: toJSNumber(amount),
      };
    });
    shippingMethod = shipping.title;
  }

  return {
    type: 'regular',
    info: { shippingAddress, phone, name },
    totalAmount: toJSNumber(totalAmount),
    currency,
    date,
    credentialsTitle,
    shippingPrices,
    shippingMethod,
    tipAmount: toJSNumber(tipAmount) || 0,
    title,
    description,
    botId: buildApiPeerId(botId, 'user'),
    providerId: providerId.toString(),
    photo: photo && buildApiWebDocument(photo),
    invoice: buildApiInvoice(invoice),
  };
}

export function buildApiPaymentForm(form: GramJs.payments.TypePaymentForm): ApiPaymentForm {
  if (form instanceof GramJs.payments.PaymentFormStarGift) {
    const { formId } = form;
    return {
      type: 'stargift',
      formId: String(formId),
      invoice: buildApiInvoice(form.invoice),
    };
  }

  if (form instanceof GramJs.payments.PaymentFormStars) {
    const {
      botId, formId, title, description, photo,
    } = form;

    if (photo) {
      addWebDocumentToLocalDb(photo);
    }

    return {
      type: 'stars',
      botId: buildApiPeerId(botId, 'user'),
      formId: String(formId),
      title,
      description,
      photo: buildApiWebDocument(photo),
      invoice: buildApiInvoice(form.invoice),
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
    description,
    title,
    photo,
  } = form;

  if (photo) {
    addWebDocumentToLocalDb(photo);
  }
  const { shippingAddress } = savedInfo || {};
  const cleanedInfo: ApiPaymentSavedInfo | undefined = savedInfo ? omitVirtualClassFields(savedInfo) : undefined;
  if (cleanedInfo && shippingAddress) {
    cleanedInfo.shippingAddress = omitVirtualClassFields(shippingAddress);
  }

  const nativeData = nativeParams ? JSON.parse(nativeParams.data) : {};

  return {
    type: 'regular',
    title,
    description,
    photo: buildApiWebDocument(photo),
    url,
    botId: buildApiPeerId(botId, 'user'),
    canSaveCredentials,
    isPasswordMissing,
    formId: String(formId),
    providerId: String(providerId),
    nativeProvider,
    savedInfo: cleanedInfo,
    invoice: buildApiInvoice(invoice),
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

export function buildApiInvoice(invoice: GramJs.Invoice): ApiInvoice {
  const {
    test,
    currency,
    prices,
    recurring,
    termsUrl,
    maxTipAmount,
    suggestedTipAmounts,
    emailRequested,
    emailToProvider,
    nameRequested,
    phoneRequested,
    phoneToProvider,
    shippingAddressRequested,
    flexible,
    subscriptionPeriod,
  } = invoice;

  const mappedPrices: ApiLabeledPrice[] = prices.map(({ label, amount }) => ({
    label,
    amount: toJSNumber(amount),
  }));

  const totalAmount = prices.reduce((acc, cur) => acc + toJSNumber(cur.amount), 0);

  return {
    totalAmount,
    currency,
    isTest: test,
    isRecurring: recurring,
    termsUrl,
    prices: mappedPrices,
    maxTipAmount: toJSNumber(maxTipAmount),
    suggestedTipAmounts: suggestedTipAmounts?.map((tip) => toJSNumber(tip)),
    isEmailRequested: emailRequested,
    isEmailSentToProvider: emailToProvider,
    isNameRequested: nameRequested,
    isPhoneRequested: phoneRequested,
    isPhoneSentToProvider: phoneToProvider,
    isShippingAddressRequested: shippingAddressRequested,
    isFlexible: flexible,
    subscriptionPeriod,
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
    amount: toJSNumber(amount),
    botUrl,
    months,
  };
}

export function buildApiPaymentCredentials(credentials: GramJs.PaymentSavedCredentialsCard[]): ApiPaymentCredentials[] {
  return credentials.map(({ id, title }) => ({ id, title }));
}

export function buildPrepaidGiveaway(
  interaction: GramJs.TypePrepaidGiveaway,
): ApiPrepaidGiveaway | ApiPrepaidStarsGiveaway {
  if (interaction instanceof GramJs.PrepaidGiveaway) {
    return {
      type: 'giveaway',
      id: interaction.id.toString(),
      date: interaction.date,
      months: interaction.months,
      quantity: interaction.quantity,
    };
  }

  return {
    type: 'starsGiveaway',
    id: interaction.id.toString(),
    stars: toJSNumber(interaction.stars),
    quantity: interaction.quantity,
    boosts: interaction.boosts,
    date: interaction.date,
  };
}

export function buildApiBoostsStatus(boostStatus: GramJs.premium.BoostsStatus): ApiBoostsStatus {
  const {
    level, boostUrl, boosts,
    giftBoosts, myBoost, currentLevelBoosts, nextLevelBoosts,
    premiumAudience, prepaidGiveaways,
  } = boostStatus;

  return {
    level,
    currentLevelBoosts,
    boosts,
    hasMyBoost: Boolean(myBoost),
    boostUrl,
    giftBoosts,
    nextLevelBoosts,
    premiumSubscribers: premiumAudience && buildStatisticsPercentage(premiumAudience),
    prepaidGiveaways: prepaidGiveaways?.map((m) => buildPrepaidGiveaway(m)),
  };
}

export function buildApiBoost(boost: GramJs.Boost): ApiBoost {
  const {
    userId,
    multiplier,
    expires,
    giveaway,
    gift,
    stars,
  } = boost;

  return {
    userId: userId !== undefined ? buildApiPeerId(userId, 'user') : undefined,
    multiplier,
    expires,
    isFromGiveaway: giveaway,
    isGift: gift,
    stars: toJSNumber(stars),
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
      adminDisallowedChatId: adminDisallowedChatId !== undefined
        ? buildApiPeerId(adminDisallowedChatId, 'channel') : undefined,
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
      starsPrize,
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
      starsPrize: toJSNumber(starsPrize),
    };
  }
}

export function buildApiCheckedGiftCode(giftcode: GramJs.payments.TypeCheckedGiftCode): ApiCheckedGiftCode {
  const {
    date, fromId, days, giveawayMsgId, toId, usedDate, viaGiveaway,
  } = giftcode;

  return {
    date,
    days,
    toId: toId !== undefined ? buildApiPeerId(toId, 'user') : undefined,
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
    amount: toJSNumber(amount),
    currency,
    months,
    users,
  };
}

export function buildApiStarsGiftOptions(option: GramJs.StarsGiftOption): ApiStarTopupOption {
  const {
    extended, stars, amount, currency,
  } = option;

  return {
    isExtended: extended,
    stars: toJSNumber(stars),
    amount: toJSNumber(amount),
    currency,
  };
}

export function buildApiCurrencyAmount(amount: GramJs.TypeStarsAmount): ApiTypeCurrencyAmount {
  if (amount instanceof GramJs.StarsAmount) {
    return {
      currency: STARS_CURRENCY_CODE,
      amount: toJSNumber(amount.amount),
      nanos: amount.nanos,
    };
  }

  if (amount instanceof GramJs.StarsTonAmount) {
    return {
      currency: TON_CURRENCY_CODE,
      amount: toJSNumber(amount.amount),
    };
  }

  const _exhaustive: never = amount;
  return _exhaustive;
}

export function buildApiStarsGiveawayWinnersOption(
  option: GramJs.StarsGiveawayWinnersOption,
): ApiStarsGiveawayWinnerOption {
  const {
    default: isDefault, users, perUserStars,
  } = option;

  return {
    isDefault,
    users,
    perUserStars: toJSNumber(perUserStars),
  };
}

export function buildApiStarsGiveawayOptions(option: GramJs.StarsGiveawayOption): ApiStarGiveawayOption {
  const {
    extended, default: isDefault, stars, yearlyBoosts, amount, winners, currency,
  } = option;

  const winnerList = winners?.map((m) => buildApiStarsGiveawayWinnersOption(m)).filter(Boolean);

  return {
    isExtended: extended,
    isDefault,
    yearlyBoosts,
    stars: toJSNumber(stars),
    amount: toJSNumber(amount),
    currency,
    winners: winnerList,
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

  if (peer instanceof GramJs.StarsTransactionPeerAPI) {
    return { type: 'api' };
  }

  if (peer instanceof GramJs.StarsTransactionPeer) {
    return { type: 'peer', id: getApiChatIdFromMtpPeer(peer.peer) };
  }

  return { type: 'unsupported' };
}

export function buildApiStarsTransaction(transaction: GramJs.StarsTransaction): ApiStarsTransaction | undefined {
  const {
    date, id, peer, amount, description, photo, title, refund, extendedMedia, failed, msgId, pending, gift, reaction,
    subscriptionPeriod, stargift, giveawayPostId, starrefCommissionPermille, stargiftUpgrade, paidMessages,
    stargiftResale, postsSearch, stargiftPrepaidUpgrade, stargiftDropOriginalDetails, stargiftAuctionBid,
  } = transaction;

  if (photo) {
    addWebDocumentToLocalDb(photo);
  }

  const boughtExtendedMedia = extendedMedia?.map((m) => buildMessageMediaContent(m))
    .filter(Boolean) as BoughtPaidMedia[];

  const starRefCommision = starrefCommissionPermille ? starrefCommissionPermille / 10 : undefined;

  const starsAmount = buildApiCurrencyAmount(amount);
  if (!starsAmount) {
    return undefined;
  }

  return {
    id,
    date,
    peer: buildApiStarsTransactionPeer(peer),
    amount: starsAmount,
    title,
    description,
    photo: photo && buildApiWebDocument(photo),
    isRefund: refund,
    hasFailed: failed,
    isPending: pending,
    messageId: msgId,
    isGift: gift,
    extendedMedia: boughtExtendedMedia,
    subscriptionPeriod,
    isReaction: reaction,
    starGift: stargift && buildApiStarGift(stargift),
    giveawayPostId,
    starRefCommision,
    isGiftUpgrade: stargiftUpgrade,
    isGiftResale: stargiftResale,
    paidMessages,
    isPostsSearch: postsSearch,
    isDropOriginalDetails: stargiftDropOriginalDetails,
    isPrepaidUpgrade: stargiftPrepaidUpgrade,
    isStarGiftAuctionBid: stargiftAuctionBid,
  };
}

export function buildApiStarsSubscription(subscription: GramJs.StarsSubscription): ApiStarsSubscription {
  const {
    id, peer, pricing, untilDate, canRefulfill, canceled, chatInviteHash, missingBalance, botCanceled, photo, title,
    invoiceSlug,
  } = subscription;

  if (photo) {
    addWebDocumentToLocalDb(photo);
  }

  return {
    id,
    peerId: getApiChatIdFromMtpPeer(peer),
    until: untilDate,
    pricing: buildApiStarsSubscriptionPricing(pricing),
    isCancelled: canceled,
    canRefulfill,
    hasMissingBalance: missingBalance,
    chatInviteHash,
    hasBotCancelled: botCanceled,
    title,
    photo: photo && buildApiWebDocument(photo),
    invoiceSlug,
  };
}

export function buildApiStarTopupOption(option: GramJs.TypeStarsTopupOption): ApiStarTopupOption {
  const {
    amount, currency, stars, extended,
  } = option;

  return {
    amount: toJSNumber(amount),
    currency,
    stars: toJSNumber(stars),
    isExtended: extended,
  };
}

export function buildApiUniqueStarGiftValueInfo(
  info: GramJs.payments.UniqueStarGiftValueInfo): ApiUniqueStarGiftValueInfo {
  const {
    lastSaleOnFragment, currency, value, initialSaleDate, initialSaleStars, initialSalePrice,
    lastSaleDate, lastSalePrice, floorPrice, averagePrice, listedCount, fragmentListedCount,
    fragmentListedUrl, valueIsAverage,
  } = info;

  return {
    isLastSaleOnFragment: lastSaleOnFragment,
    isValueAverage: valueIsAverage,
    currency,
    value: toJSNumber(value),
    initialSaleDate,
    initialSaleStars: toJSNumber(initialSaleStars),
    initialSalePrice: toJSNumber(initialSalePrice),
    lastSaleDate,
    lastSalePrice: toJSNumber(lastSalePrice),
    floorPrice: toJSNumber(floorPrice),
    averagePrice: toJSNumber(averagePrice),
    listedCount,
    fragmentListedCount,
    fragmentListedUrl,
  };
}
