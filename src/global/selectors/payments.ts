import type { GlobalState, TabArgs } from '../types';

import { DEFAULT_GIFT_PROFILE_FILTER_OPTIONS } from '../../config';
import arePropsShallowEqual from '../../util/arePropsShallowEqual';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import {
  getHasAdminRight, isChatAdmin, isChatChannel,
} from '../helpers';
import { selectChat } from './chats';
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

export function selectCanUseGiftProfileAdminFilter<T extends GlobalState>(
  global: T, peerId: string,
) {
  const chat = selectChat(global, peerId);
  return chat && isChatChannel(chat) && isChatAdmin(chat) && getHasAdminRight(chat, 'postMessages');
}

export function selectCanUseGiftProfileFilter<T extends GlobalState>(
  global: T, peerId: string,
) {
  const chat = selectChat(global, peerId);
  return chat && isChatChannel(chat);
}

export function selectGiftProfileFilter<T extends GlobalState>(
  global: T,
  peerId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectCanUseGiftProfileFilter(global, peerId) ? selectTabState(global, tabId).savedGifts.filter : undefined;
}

export function selectIsGiftProfileFilterDefault<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return arePropsShallowEqual(selectTabState(global, tabId).savedGifts.filter, DEFAULT_GIFT_PROFILE_FILTER_OPTIONS);
}
