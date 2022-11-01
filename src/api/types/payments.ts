import type { ApiDocument, ApiMessageEntity, ApiPaymentCredentials } from './messages';
import type { ApiWebDocument } from './bots';
import type { ApiInvoiceContainer } from '../../types';

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
  isPasswordMissing?: boolean;
  formId: string;
  providerId: string;
  nativeProvider?: string;
  savedInfo?: ApiPaymentSavedInfo;
  savedCredentials?: ApiPaymentCredentials[];
  invoiceContainer: ApiInvoiceContainer;
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
  photo?: ApiWebDocument;
  text?: string;
  title?: string;
  currency: string;
  prices: ApiLabeledPrice[];
  info?: {
    shippingAddress?: ApiShippingAddress;
    phone?: string;
    name?: string;
  };
  tipAmount: number;
  totalAmount: number;
  credentialsTitle: string;
  shippingPrices?: ApiLabeledPrice[];
  shippingMethod?: string;
}

export interface ApiPremiumPromo {
  videoSections: string[];
  videos: ApiDocument[];
  statusText: string;
  statusEntities: ApiMessageEntity[];
  options: ApiPremiumSubscriptionOption[];
}

export interface ApiPremiumSubscriptionOption {
  isCurrent?: boolean;
  canPurchaseUpgrade?: boolean;
  months: number;
  currency: string;
  amount: string;
  botUrl: string;
}
