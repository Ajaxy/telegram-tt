import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiPeer, ApiRequestInputInvoice,
  OnApiUpdate,
} from '../../types';

import { buildCollectionByCallback } from '../../../util/iteratees';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import {
  buildApiBoostsStatus,
  buildApiCheckedGiftCode,
  buildApiGiveawayInfo,
  buildApiInvoiceFromForm,
  buildApiMyBoost,
  buildApiPaymentForm,
  buildApiPremiumPromo,
  buildApiReceipt,
  buildShippingOptions,
} from '../apiBuilders/payments';
import { buildApiUser } from '../apiBuilders/users';
import { buildInputInvoice, buildInputPeer, buildShippingInfo } from '../gramjsBuilders';
import {
  addEntitiesToLocalDb,
  deserializeBytes,
  serializeBytes,
} from '../helpers';
import localDb from '../localDb';
import { invokeRequest } from './client';
import { getTemporaryPaymentPassword } from './twoFaSettings';

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
  savedCredentialId,
  temporaryPassword,
  tipAmount,
}: {
  inputInvoice: ApiRequestInputInvoice;
  formId: string;
  credentials: any;
  requestedInfoId?: string;
  shippingOptionId?: string;
  savedCredentialId?: string;
  temporaryPassword?: string;
  tipAmount?: number;
}) {
  const inputCredentials = temporaryPassword && savedCredentialId
    ? new GramJs.InputPaymentCredentialsSaved({
      id: savedCredentialId,
      tmpPassword: deserializeBytes(temporaryPassword),
    })
    : new GramJs.InputPaymentCredentials({
      save: credentials.save,
      data: new GramJs.DataJSON({ data: JSON.stringify(credentials.data) }),
    });
  const result = await invokeRequest(new GramJs.payments.SendPaymentForm({
    formId: BigInt(formId),
    invoice: buildInputInvoice(inputInvoice),
    requestedInfoId,
    shippingOptionId,
    credentials: inputCredentials,
    ...(tipAmount && { tipAmount: BigInt(tipAmount) }),
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

  addEntitiesToLocalDb(result.users);

  return {
    form: buildApiPaymentForm(result),
    invoice: buildApiInvoiceFromForm(result),
    users: result.users.map(buildApiUser).filter(Boolean),
    botId: result.botId.toString(),
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

  addEntitiesToLocalDb(result.users);

  return {
    receipt: buildApiReceipt(result),
    users: result.users.map(buildApiUser).filter(Boolean),
  };
}

export async function fetchPremiumPromo() {
  const result = await invokeRequest(new GramJs.help.GetPremiumPromo());
  if (!result) return undefined;

  addEntitiesToLocalDb(result.users);

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

export async function fetchTemporaryPaymentPassword(password: string) {
  const result = await getTemporaryPaymentPassword(password);

  if (!result) {
    return undefined;
  }

  if ('error' in result) {
    return result;
  }

  return {
    value: serializeBytes(result.tmpPassword),
    validUntil: result.validUntil,
  };
}

export async function fetchMyBoosts() {
  const result = await invokeRequest(new GramJs.premium.GetMyBoosts());

  if (!result) return undefined;

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const boosts = result.myBoosts.map(buildApiMyBoost);

  return {
    users,
    chats,
    boosts,
  };
}

export async function applyBoost({
  chat,
  slots,
} : {
  chat: ApiChat;
  slots: number[];
}) {
  const result = await invokeRequest(new GramJs.premium.ApplyBoost({
    peer: buildInputPeer(chat.id, chat.accessHash),
    slots,
  }));

  if (!result) return undefined;

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const boosts = result.myBoosts.map(buildApiMyBoost);

  return {
    users,
    chats,
    boosts,
  };
}

export async function fetchBoostsStatus({
  chat,
}: {
  chat: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.premium.GetBoostsStatus({
    peer: buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) {
    return undefined;
  }

  return buildApiBoostsStatus(result);
}

export async function fetchBoostsList({
  chat,
  offset = '',
  limit,
}: {
  chat: ApiChat;
  offset?: string;
  limit?: number;
}) {
  const result = await invokeRequest(new GramJs.premium.GetBoostsList({
    peer: buildInputPeer(chat.id, chat.accessHash),
    offset,
    limit,
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);

  const users = result.users.map(buildApiUser).filter(Boolean);

  const userBoosts = result.boosts.filter((boost) => boost.userId);
  const boosterIds = userBoosts.map((boost) => boost.userId!.toString());
  const boosters = buildCollectionByCallback(userBoosts, (boost) => (
    [boost.userId!.toString(), boost.expires]
  ));

  return {
    count: result.count,
    users,
    boosters,
    boosterIds,
    nextOffset: result.nextOffset,
  };
}

export async function fetchGiveawayInfo({
  peer,
  messageId,
}: {
  peer: ApiPeer;
  messageId: number;
}) {
  const result = await invokeRequest(new GramJs.payments.GetGiveawayInfo({
    peer: buildInputPeer(peer.id, peer.accessHash),
    msgId: messageId,
  }));

  if (!result) {
    return undefined;
  }

  return buildApiGiveawayInfo(result);
}

export async function checkGiftCode({
  slug,
}: {
  slug: string;
}) {
  const result = await invokeRequest(new GramJs.payments.CheckGiftCode({
    slug,
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);

  return {
    code: buildApiCheckedGiftCode(result),
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
  };
}

export function applyGiftCode({
  slug,
}: {
  slug: string;
}) {
  return invokeRequest(new GramJs.payments.ApplyGiftCode({
    slug,
  }), {
    shouldReturnTrue: true,
  });
}
