import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from './tabs';

export function selectPaymentInputInvoice<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.inputInvoice;
}

export function selectPaymentForm<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.form;
}

export function selectStarsPayment<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).starsPayment;
}

export function selectPaymentRequestId<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.requestId;
}

export function selectProviderPublishableKey<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.form?.nativeParams.publishableKey;
}

export function selectProviderPublicToken<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.form?.nativeParams.publicToken;
}

export function selectStripeCredentials<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.stripeCredentials;
}

export function selectSmartGlocalCredentials<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).payment.smartGlocalCredentials;
}
