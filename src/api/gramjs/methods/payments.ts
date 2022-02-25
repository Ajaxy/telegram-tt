import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { invokeRequest } from './client';
import { buildInputPeer, buildShippingInfo } from '../gramjsBuilders';
import { buildShippingOptions, buildPaymentForm, buildReceipt } from '../apiBuilders/payments';
import { ApiChat, OnApiUpdate } from '../../types';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function validateRequestedInfo({
  chat,
  messageId,
  requestInfo,
  shouldSave,
}: {
  chat: ApiChat;
  messageId: number;
  requestInfo: GramJs.TypePaymentRequestedInfo;
  shouldSave?: boolean;
}): Promise<{
    id: string;
    shippingOptions: any;
  } | undefined> {
  const result = await invokeRequest(new GramJs.payments.ValidateRequestedInfo({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
    save: shouldSave || undefined,
    info: buildShippingInfo(requestInfo),
  }));
  if (!result) {
    return undefined;
  }

  const { id, shippingOptions } = result;
  if (!id) {
    return undefined;
  }

  return {
    id,
    shippingOptions: buildShippingOptions(shippingOptions),
  };
}

export async function sendPaymentForm({
  chat,
  messageId,
  formId,
  requestedInfoId,
  shippingOptionId,
  credentials,
}: {
  chat: ApiChat;
  messageId: number;
  formId: string;
  credentials: any;
  requestedInfoId?: string;
  shippingOptionId?: string;
}) {
  const result = await invokeRequest(new GramJs.payments.SendPaymentForm({
    formId: BigInt(formId),
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
    requestedInfoId,
    shippingOptionId,
    credentials: new GramJs.InputPaymentCredentials({
      save: credentials.save,
      data: new GramJs.DataJSON({ data: JSON.stringify(credentials.data) }),
    }),
  }));

  if (result instanceof GramJs.payments.PaymentVerificationNeeded) {
    onUpdate({
      '@type': 'updatePaymentVerificationNeeded',
      url: result.url,
    });

    return undefined;
  }

  return Boolean(result);
}

export async function getPaymentForm({
  chat, messageId,
}: {
  chat: ApiChat;
  messageId: number;
}) {
  const result = await invokeRequest(new GramJs.payments.GetPaymentForm({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
  }));

  if (!result) {
    return undefined;
  }

  return buildPaymentForm(result);
}

export async function getReceipt(chat: ApiChat, msgId: number) {
  const result = await invokeRequest(new GramJs.payments.GetPaymentReceipt({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId,
  }));
  if (!result) {
    return undefined;
  }

  return buildReceipt(result);
}
