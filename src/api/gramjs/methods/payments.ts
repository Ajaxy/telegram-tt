import { Api as GramJs } from '../../../lib/gramjs';
import { invokeRequest } from './client';
import { buildShippingInfo } from '../gramjsBuilders';
import { buildShippingOptions, buildPaymentForm, buildReceipt } from '../apiBuilders/payments';

export async function validateRequestedInfo({
  messageId,
  requestInfo,
  shouldSave,
}: {
  messageId: number;
  requestInfo: GramJs.TypePaymentRequestedInfo;
  shouldSave?: boolean;
}): Promise<{
    id: string;
    shippingOptions: any;
  } | undefined> {
  const result = await invokeRequest(new GramJs.payments.ValidateRequestedInfo({
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

export function sendPaymentForm({
  messageId,
  requestedInfoId,
  shippingOptionId,
  credentials,
}: {
  messageId: number;
  credentials: any;
  requestedInfoId?: string;
  shippingOptionId?: string;
}) {
  return invokeRequest(new GramJs.payments.SendPaymentForm({
    msgId: messageId,
    requestedInfoId,
    shippingOptionId,
    credentials: new GramJs.InputPaymentCredentials({
      save: credentials.save,
      data: new GramJs.DataJSON({ data: JSON.stringify(credentials.data) }),
    }),
  }), true);
}

export async function getPaymentForm({
  messageId,
}: {
  messageId: number;
}) {
  const result = await invokeRequest(new GramJs.payments.GetPaymentForm({
    msgId: messageId,
  }));
  if (!result) {
    return undefined;
  }

  return buildPaymentForm(result);
}

export async function getReceipt(msgId: number) {
  const result = await invokeRequest(new GramJs.payments.GetPaymentReceipt({ msgId }));
  if (!result) {
    return undefined;
  }
  return buildReceipt(result);
}
