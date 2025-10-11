import { Api as GramJs } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';

import type {
  ApiChat,
  ApiInputStorePaymentPurpose,
  ApiPeer,
  ApiRequestInputInvoice,
  ApiThemeParameters,
} from '../../types';

import { DEBUG } from '../../../config';
import {
  buildApiBoost,
  buildApiBoostsStatus,
  buildApiCheckedGiftCode,
  buildApiGiveawayInfo,
  buildApiMyBoost,
  buildApiPaymentForm,
  buildApiPremiumGiftCodeOption,
  buildApiPremiumPromo,
  buildApiReceipt,
  buildShippingOptions,
} from '../apiBuilders/payments';
import { buildApiPeerId } from '../apiBuilders/peers';
import {
  buildInputInvoice,
  buildInputPeer,
  buildInputStorePaymentPurpose,
  buildInputThemeParams,
  buildShippingInfo,
  DEFAULT_PRIMITIVES,
} from '../gramjsBuilders';
import {
  deserializeBytes,
  serializeBytes,
} from '../helpers/misc';
import localDb from '../localDb';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { handleGramJsUpdate, invokeRequest } from './client';
import { getTemporaryPaymentPassword } from './twoFaSettings';

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

  if (!result) return false;

  if (result instanceof GramJs.payments.PaymentVerificationNeeded) {
    sendApiUpdate({
      '@type': 'updatePaymentVerificationNeeded',
      url: result.url,
    });

    return undefined;
  } else {
    handleGramJsUpdate(result.updates);
  }

  return Boolean(result);
}

export async function sendStarPaymentForm({
  formId,
  inputInvoice,
}: {
  formId: string;
  inputInvoice: ApiRequestInputInvoice;
}) {
  const result = await invokeRequest(new GramJs.payments.SendStarsForm({
    formId: BigInt(formId),
    invoice: buildInputInvoice(inputInvoice),
  }));

  if (!result) return undefined;

  if (result instanceof GramJs.payments.PaymentVerificationNeeded) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Unexpected PaymentVerificationNeeded in sendStarsForm');
    }

    return undefined;
  }

  handleGramJsUpdate(result.updates);

  if (inputInvoice.type === 'chatInviteSubscription') {
    const updates = 'updates' in result.updates ? result.updates.updates : undefined;

    const mtpChannelId = updates?.find((update): update is GramJs.UpdateChannel => (
      update instanceof GramJs.UpdateChannel
    ))?.channelId;

    if (!mtpChannelId) {
      return undefined;
    }

    return {
      channelId: buildApiPeerId(mtpChannelId, 'channel'),
    };
  }

  return {
    completed: true,
  };
}

export async function getPaymentForm(inputInvoice: ApiRequestInputInvoice, theme?: ApiThemeParameters) {
  try {
    const result = await invokeRequest(new GramJs.payments.GetPaymentForm({
      invoice: buildInputInvoice(inputInvoice),
      themeParams: theme ? buildInputThemeParams(theme) : undefined,
    }), {
      shouldThrow: true,
    });

    if (!result) {
      return undefined;
    }

    return buildApiPaymentForm(result);
  } catch (err: any) {
    if (err instanceof RPCError) {
      return {
        error: err.errorMessage,
      };
    } else {
      throw err;
    }
  }
}

export async function getReceipt(chat: ApiChat, msgId: number) {
  const result = await invokeRequest(new GramJs.payments.GetPaymentReceipt({
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId,
  }));

  if (!result) {
    return undefined;
  }

  return {
    receipt: buildApiReceipt(result),
  };
}

export async function fetchPremiumPromo() {
  const result = await invokeRequest(new GramJs.help.GetPremiumPromo());
  if (!result) return undefined;

  result.videos.forEach((video) => {
    if (video instanceof GramJs.Document) {
      localDb.documents[video.id.toString()] = video;
    }
  });

  return {
    promo: buildApiPremiumPromo(result),
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

  const boosts = result.myBoosts.map(buildApiMyBoost);

  return {
    boosts,
  };
}

export async function applyBoost({
  chat,
  slots,
}: {
  chat: ApiChat;
  slots: number[];
}) {
  const result = await invokeRequest(new GramJs.premium.ApplyBoost({
    peer: buildInputPeer(chat.id, chat.accessHash),
    slots,
  }));

  if (!result) return undefined;

  const boosts = result.myBoosts.map(buildApiMyBoost);

  return {
    boosts,
  };
}

export async function fetchBoostStatus({
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

export async function fetchBoostList({
  chat,
  isGifts,
  offset = DEFAULT_PRIMITIVES.STRING,
  limit = DEFAULT_PRIMITIVES.INT,
}: {
  chat: ApiChat;
  isGifts?: boolean;
  offset?: string;
  limit?: number;
}) {
  const result = await invokeRequest(new GramJs.premium.GetBoostsList({
    peer: buildInputPeer(chat.id, chat.accessHash),
    gifts: isGifts || undefined,
    offset,
    limit,
  }));

  if (!result) {
    return undefined;
  }

  const boostList = result.boosts.map(buildApiBoost);

  return {
    count: result.count,
    boostList,
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

  return {
    code: buildApiCheckedGiftCode(result),
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

export async function getPremiumGiftCodeOptions({
  chat,
}: {
  chat?: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.payments.GetPremiumGiftCodeOptions({
    boostPeer: chat && buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) {
    return undefined;
  }

  return result.map(buildApiPremiumGiftCodeOption);
}

export function launchPrepaidGiveaway({
  chat,
  giveawayId,
  paymentPurpose,
}: {
  chat: ApiChat;
  giveawayId: string;
  paymentPurpose: ApiInputStorePaymentPurpose;
}) {
  return invokeRequest(new GramJs.payments.LaunchPrepaidGiveaway({
    peer: buildInputPeer(chat.id, chat.accessHash),
    giveawayId: BigInt(giveawayId),
    purpose: buildInputStorePaymentPurpose(paymentPurpose),
  }), {
    shouldReturnTrue: true,
  });
}
