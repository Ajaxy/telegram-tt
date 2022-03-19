import { GlobalState } from '../types';

export function selectPaymentChatId(global: GlobalState) {
  return global.payment.chatId;
}

export function selectPaymentMessageId(global: GlobalState) {
  return global.payment.messageId;
}

export function selectPaymentFormId(global: GlobalState) {
  return global.payment.formId;
}

export function selectPaymentRequestId(global: GlobalState) {
  return global.payment.requestId;
}

export function selectProviderPublishableKey(global: GlobalState) {
  return global.payment.nativeParams?.publishableKey;
}

export function selectProviderPublicToken(global: GlobalState) {
  return global.payment.nativeParams?.publicToken;
}

export function selectStripeCredentials(global: GlobalState) {
  return global.payment.stripeCredentials;
}

export function selectSmartGlocalCredentials(global: GlobalState) {
  return global.payment.smartGlocalCredentials;
}
