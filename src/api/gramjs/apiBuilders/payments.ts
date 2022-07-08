import type { Api as GramJs } from '../../../lib/gramjs';

import type { ApiInvoice, ApiPaymentSavedInfo, ApiPremiumPromo } from '../../types';

import { buildApiDocument, buildApiMessageEntity, buildApiWebDocument } from './messages';
import { omitVirtualClassFields } from './helpers';

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

export function buildReceipt(receipt: GramJs.payments.PaymentReceipt) {
  const {
    invoice,
    info,
    shipping,
    currency,
    totalAmount,
    credentialsTitle,
  } = receipt;

  const { shippingAddress, phone, name } = (info || {});

  const { prices } = invoice;
  const mapedPrices = prices.map(({ label, amount }) => ({
    label,
    amount: amount.toJSNumber(),
  }));

  let shippingPrices;
  let shippingMethod;

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
    currency,
    prices: mapedPrices,
    info: { shippingAddress, phone, name },
    totalAmount: totalAmount.toJSNumber(),
    credentialsTitle,
    shippingPrices,
    shippingMethod,
  };
}

export function buildPaymentForm(form: GramJs.payments.PaymentForm) {
  const {
    formId,
    canSaveCredentials,
    passwordMissing,
    providerId,
    nativeProvider,
    nativeParams,
    savedInfo,
    invoice,
  } = form;

  const {
    test,
    nameRequested,
    phoneRequested,
    emailRequested,
    shippingAddressRequested,
    flexible,
    phoneToProvider,
    emailToProvider,
    currency,
    prices,
  } = invoice;

  const mappedPrices = prices.map(({ label, amount }) => ({
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
    canSaveCredentials,
    passwordMissing,
    formId: String(formId),
    providerId: String(providerId),
    nativeProvider,
    savedInfo: cleanedInfo,
    invoice: {
      test,
      nameRequested,
      phoneRequested,
      emailRequested,
      shippingAddressRequested,
      flexible,
      phoneToProvider,
      emailToProvider,
      currency,
      prices: mappedPrices,
    },
    nativeParams: {
      needCardholderName: nativeData.need_cardholder_name,
      needCountry: nativeData.need_country,
      needZip: nativeData.need_zip,
      publishableKey: nativeData.publishable_key,
      publicToken: nativeData?.public_token,
    },
  };
}

export function buildApiInvoiceFromForm(form: GramJs.payments.PaymentForm): ApiInvoice {
  const {
    invoice, description: text, title, photo,
  } = form;
  const {
    test, currency, prices, recurring, recurringTermsUrl,
  } = invoice;

  const totalAmount = prices.reduce((ac, cur) => ac + cur.amount.toJSNumber(), 0);

  return {
    text,
    title,
    photo: buildApiWebDocument(photo),
    amount: totalAmount,
    currency,
    isTest: test,
    isRecurring: recurring,
    recurringTermsUrl,
  };
}

export function buildApiPremiumPromo(promo: GramJs.help.PremiumPromo): ApiPremiumPromo {
  const {
    statusText, statusEntities, videos, videoSections, currency, monthlyAmount,
  } = promo;

  return {
    statusText,
    statusEntities: statusEntities.map((l) => buildApiMessageEntity(l)),
    videoSections,
    currency,
    videos: videos.map(buildApiDocument).filter(Boolean),
    monthlyAmount: monthlyAmount.toString(),
  };
}
