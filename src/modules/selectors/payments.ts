
import { GlobalState } from '../../global/types';

export function selectPaymentMessageId(global: GlobalState) {
  return global.payment.messageId;
}

export function selectPaymentRequestId(global: GlobalState) {
  return global.payment.formId;
}

export function selectProviderPublishableKey(global: GlobalState) {
  return global.payment.nativeParams ? global.payment.nativeParams.publishableKey : undefined;
}

export function selectStripeCredentials(global: GlobalState) {
  return global.payment.stripeCredentials;
}
