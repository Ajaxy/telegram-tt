
import { GlobalState } from '../../global/types';

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
  return global.payment.nativeParams ? global.payment.nativeParams.publishableKey : undefined;
}

export function selectStripeCredentials(global: GlobalState) {
  return global.payment.stripeCredentials;
}
