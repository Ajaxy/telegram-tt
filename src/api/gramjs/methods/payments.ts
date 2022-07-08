import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { invokeRequest } from './client';
import { buildInputInvoice, buildInputPeer, buildShippingInfo } from '../gramjsBuilders';
import {
  buildShippingOptions, buildPaymentForm, buildReceipt, buildApiPremiumPromo, buildApiInvoiceFromForm,
} from '../apiBuilders/payments';
import type {
  ApiChat, OnApiUpdate, ApiRequestInputInvoice,
} from '../../types';
import localDb from '../localDb';
import { addEntitiesWithPhotosToLocalDb } from '../helpers';
import { buildApiUser } from '../apiBuilders/users';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function validateRequestedInfo({
  inputInvoice,
  requestInfo,
  shouldSave,
}: {
  inputInvoice: ApiRequestInputInvoice;
  requestInfo: GramJs.TypePaymentRequestedInfo;
  shouldSave?: boolean;
}): Promise<{
    id: string;
    shippingOptions: any;
  } | undefined> {
  const result = await invokeRequest(new GramJs.payments.ValidateRequestedInfo({
    invoice: buildInputInvoice(inputInvoice),
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
  inputInvoice,
  formId,
  requestedInfoId,
  shippingOptionId,
  credentials,
}: {
  inputInvoice: ApiRequestInputInvoice;
  formId: string;
  credentials: any;
  requestedInfoId?: string;
  shippingOptionId?: string;
}) {
  const result = await invokeRequest(new GramJs.payments.SendPaymentForm({
    formId: BigInt(formId),
    invoice: buildInputInvoice(inputInvoice),
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

export async function getPaymentForm(inputInvoice: ApiRequestInputInvoice) {
  const result = await invokeRequest(new GramJs.payments.GetPaymentForm({
    invoice: buildInputInvoice(inputInvoice),
  }));

  if (!result) {
    return undefined;
  }

  if (result.photo) {
    localDb.webDocuments[result.photo.url] = result.photo;
  }

  return {
    form: buildPaymentForm(result),
    invoice: buildApiInvoiceFromForm(result),
  };
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

export async function fetchPremiumPromo() {
  const result = await invokeRequest(new GramJs.help.GetPremiumPromo());
  if (!result) return undefined;

  addEntitiesWithPhotosToLocalDb(result.users);

  const users = result.users.map(buildApiUser).filter(Boolean);
  result.videos.forEach((video) => {
    if (video instanceof GramJs.Document) {
      localDb.documents[video.id.toString()] = video;
    }
  });

  return {
    promo: buildApiPremiumPromo(result),
    users,
  };
}
