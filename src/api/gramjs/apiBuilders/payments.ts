import { Api as GramJs } from '../../../lib/gramjs';

export function buildShippingOptions(shippingOptions: GramJs.ShippingOption[] | undefined) {
  if (!shippingOptions) {
    return undefined;
  }
  return Object.values(shippingOptions).map((option) => {
    return {
      id: option.id,
      title: option.title,
      amount: option.prices.reduce((ac, cur) => ac + Number((cur.amount as any).value), 0),
      prices: option.prices.map(({ label, amount }) => {
        return {
          label,
          amount: Number((amount as any).value),
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
    amount: Number((amount as any).value),
  }));

  let shippingPrices;
  let shippingMethod;

  if (shipping) {
    shippingPrices = shipping.prices.map(({ label, amount }) => {
      return {
        label,
        amount: Number((amount as any).value),
      };
    });
    shippingMethod = shipping.title;
  }

  return {
    currency,
    prices: mapedPrices,
    info: { shippingAddress, phone, name },
    totalAmount: Number((totalAmount as any).value),
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

  const mapedPrices = prices.map(({ label, amount }) => ({
    label,
    amount: Number((amount as any).value),
  }));

  const nativeData = nativeParams ? JSON.parse(nativeParams.data) : {};
  return {
    canSaveCredentials,
    passwordMissing,
    formId: String(formId),
    providerId,
    nativeProvider,
    savedInfo,
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
      prices: mapedPrices,
    },
    nativeParams: {
      needCardholderName: nativeData.need_cardholder_name,
      needCountry: nativeData.need_country,
      needZip: nativeData.need_zip,
      publishableKey: nativeData.publishable_key,
    },
  };
}
