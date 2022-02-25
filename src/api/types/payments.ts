export interface ApiShippingAddress {
  streetLine1: string;
  streetLine2: string;
  city: string;
  state: string;
  countryIso2: string;
  postCode: string;
}

export interface ApiPaymentSavedInfo {
  name?: string;
  phone?: string;
  email?: string;
  shippingAddress?: ApiShippingAddress;
}

export interface ApiPaymentForm {
  canSaveCredentials?: boolean;
  passwordMissing?: boolean;
  providerId: string;
  nativeProvider?: string;
  savedInfo: any;
  invoice: {
    test?: boolean;
    nameRequested?: boolean;
    phoneRequested?: boolean;
    emailRequested?: boolean;
    shippingAddressRequested?: boolean;
    flexible?: boolean;
    phoneToProvider?: boolean;
    emailToProvider?: boolean;
    currency?: string;
    prices?: ApiLabeledPrice[];
  };
  nativeParams: ApiPaymentFormNativeParams;
}

export interface ApiPaymentFormNativeParams {
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  publishableKey?: string;
  publicToken?: string;
}

export interface ApiLabeledPrice {
  label: string;
  amount: number;
}

export interface ApiReceipt {
  currency: string;
  prices: ApiLabeledPrice[];
  info?: {
    shippingAddress?: ApiShippingAddress;
    phone?: string;
    name?: string;
  };
  totalAmount: number;
  credentialsTitle: string;
  shippingPrices?: ApiLabeledPrice[];
  shippingMethod?: string;
}
