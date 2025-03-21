import bigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { GiftProfileFilterOptions } from '../../../types';
import type {
  ApiChat,
  ApiPeer,
  ApiRequestInputSavedStarGift,
  ApiStarGiftRegular,
} from '../../types';

import { buildApiSavedStarGift, buildApiStarGift, buildApiStarGiftAttribute } from '../apiBuilders/gifts';
import {
  buildApiStarsAmount,
  buildApiStarsGiftOptions,
  buildApiStarsGiveawayOptions,
  buildApiStarsSubscription,
  buildApiStarsTransaction,
  buildApiStarTopupOption,
} from '../apiBuilders/payments';
import { buildInputPeer, buildInputSavedStarGift } from '../gramjsBuilders';
import { checkErrorType, wrapError } from '../helpers/misc';
import { invokeRequest } from './client';
import { getPassword } from './twoFaSettings';

export async function fetchStarsGiveawayOptions() {
  const result = await invokeRequest(new GramJs.payments.GetStarsGiveawayOptions());

  if (!result) {
    return undefined;
  }

  return result.map(buildApiStarsGiveawayOptions);
}

export async function fetchStarGifts() {
  const result = await invokeRequest(new GramJs.payments.GetStarGifts({}));

  if (!result || result instanceof GramJs.payments.StarGiftsNotModified) {
    return undefined;
  }

  // Right now, only regular star gifts can be bought, but API are not specific
  return result.gifts.map(buildApiStarGift).filter((gift): gift is ApiStarGiftRegular => gift.type === 'starGift');
}

export async function fetchSavedStarGifts({
  peer,
  offset = '',
  limit,
  filter,
}: {
  peer: ApiPeer;
  offset?: string;
  limit?: number;
  filter?: GiftProfileFilterOptions;
}) {
  type GetSavedStarGiftsParams = ConstructorParameters<typeof GramJs.payments.GetSavedStarGifts>[0];

  const params : GetSavedStarGiftsParams = {
    peer: buildInputPeer(peer.id, peer.accessHash),
    offset,
    limit,
    ...(filter && {
      sortByValue: filter.sortType === 'byValue' || undefined,
      excludeUnlimited: !filter.shouldIncludeUnlimited || undefined,
      excludeLimited: !filter.shouldIncludeLimited || undefined,
      excludeUnique: !filter.shouldIncludeUnique || undefined,
      excludeSaved: !filter.shouldIncludeDisplayed || undefined,
      excludeUnsaved: !filter.shouldIncludeHidden || undefined,
    } satisfies GetSavedStarGiftsParams),
  };

  const result = await invokeRequest(new GramJs.payments.GetSavedStarGifts(params));

  if (!result) {
    return undefined;
  }

  const gifts = result.gifts.map((g) => buildApiSavedStarGift(g, peer.id));

  return {
    gifts,
    nextOffset: result.nextOffset,
  };
}

export function saveStarGift({
  inputGift,
  shouldUnsave,
}: {
  inputGift: ApiRequestInputSavedStarGift;
  shouldUnsave?: boolean;
}) {
  return invokeRequest(new GramJs.payments.SaveStarGift({
    stargift: buildInputSavedStarGift(inputGift),
    unsave: shouldUnsave || undefined,
  }));
}

export function convertStarGift({
  inputSavedGift,
}: {
  inputSavedGift: ApiRequestInputSavedStarGift;
}) {
  return invokeRequest(new GramJs.payments.ConvertStarGift({
    stargift: buildInputSavedStarGift(inputSavedGift),
  }));
}

export async function getStarsGiftOptions({
  chat,
}: {
  chat?: ApiChat;
}) {
  const result = await invokeRequest(new GramJs.payments.GetStarsGiftOptions({
    userId: chat && buildInputPeer(chat.id, chat.accessHash),
  }));

  if (!result) {
    return undefined;
  }

  return result.map(buildApiStarsGiftOptions);
}

export async function fetchStarsStatus() {
  const result = await invokeRequest(new GramJs.payments.GetStarsStatus({
    peer: new GramJs.InputPeerSelf(),
  }));

  if (!result) {
    return undefined;
  }

  return {
    nextHistoryOffset: result.nextOffset,
    history: result.history?.map(buildApiStarsTransaction),
    nextSubscriptionOffset: result.subscriptionsNextOffset,
    subscriptions: result.subscriptions?.map(buildApiStarsSubscription),
    balance: buildApiStarsAmount(result.balance),
  };
}

export async function fetchStarsTransactions({
  peer,
  offset,
  isInbound,
  isOutbound,
}: {
  peer?: ApiPeer;
  offset?: string;
  isInbound?: true;
  isOutbound?: true;
}) {
  const inputPeer = peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf();
  const result = await invokeRequest(new GramJs.payments.GetStarsTransactions({
    peer: inputPeer,
    offset,
    inbound: isInbound,
    outbound: isOutbound,
  }));

  if (!result) {
    return undefined;
  }

  return {
    nextOffset: result.nextOffset,
    history: result.history?.map(buildApiStarsTransaction),
    balance: buildApiStarsAmount(result.balance),
  };
}

export async function fetchStarsTransactionById({
  id, peer,
}: {
  id: string;
  peer?: ApiPeer;
}) {
  const inputPeer = peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf();
  const result = await invokeRequest(new GramJs.payments.GetStarsTransactionsByID({
    peer: inputPeer,
    id: [new GramJs.InputStarsTransaction({
      id,
    })],
  }));

  if (!result?.history?.[0]) {
    return undefined;
  }

  return {
    transaction: buildApiStarsTransaction(result?.history[0]),
  };
}

export async function fetchStarsSubscriptions({
  offset, peer,
}: {
  offset?: string;
  peer?: ApiPeer;
}) {
  const inputPeer = peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf();
  const result = await invokeRequest(new GramJs.payments.GetStarsSubscriptions({
    peer: inputPeer,
    offset,
  }));

  if (!result?.subscriptions) {
    return undefined;
  }

  return {
    nextOffset: result.subscriptionsNextOffset,
    subscriptions: result.subscriptions.map(buildApiStarsSubscription),
    balance: buildApiStarsAmount(result.balance),
  };
}

export async function changeStarsSubscription({
  peer, subscriptionId, isCancelled,
}: {
  peer?: ApiPeer;
  subscriptionId: string;
  isCancelled: boolean;
}) {
  const result = await invokeRequest(new GramJs.payments.ChangeStarsSubscription({
    peer: peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf(),
    subscriptionId,
    canceled: isCancelled,
  }));

  return result;
}

export async function fulfillStarsSubscription({
  peer, subscriptionId,
}: {
  peer?: ApiPeer;
  subscriptionId: string;
}) {
  const result = await invokeRequest(new GramJs.payments.FulfillStarsSubscription({
    peer: peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf(),
    subscriptionId,
  }));

  return result;
}

export async function fetchStarsTopupOptions() {
  const result = await invokeRequest(new GramJs.payments.GetStarsTopupOptions());

  if (!result) {
    return undefined;
  }

  return result.map(buildApiStarTopupOption);
}

export async function fetchUniqueStarGift({ slug }: {
  slug: string;
}) {
  const result = await invokeRequest(new GramJs.payments.GetUniqueStarGift({ slug }));

  if (!result) return undefined;

  const gift = buildApiStarGift(result.gift);
  if (gift.type !== 'starGiftUnique') return undefined;
  return gift;
}

export async function fetchStarGiftUpgradePreview({
  giftId,
}: {
  giftId: string;
}) {
  const result = await invokeRequest(new GramJs.payments.GetStarGiftUpgradePreview({
    giftId: bigInt(giftId),
  }));

  if (!result) {
    return undefined;
  }

  return result.sampleAttributes.map(buildApiStarGiftAttribute).filter(Boolean);
}

export function upgradeStarGift({
  inputSavedGift,
  shouldKeepOriginalDetails,
}: {
  inputSavedGift: ApiRequestInputSavedStarGift;
  shouldKeepOriginalDetails?: true;
}) {
  return invokeRequest(new GramJs.payments.UpgradeStarGift({
    stargift: buildInputSavedStarGift(inputSavedGift),
    keepOriginalDetails: shouldKeepOriginalDetails,
  }), {
    shouldReturnTrue: true,
  });
}

export function transferStarGift({
  inputSavedGift,
  toPeer,
}: {
  inputSavedGift: ApiRequestInputSavedStarGift;
  toPeer: ApiPeer;
}) {
  return invokeRequest(new GramJs.payments.TransferStarGift({
    stargift: buildInputSavedStarGift(inputSavedGift),
    toId: buildInputPeer(toPeer.id, toPeer.accessHash),
  }), {
    shouldReturnTrue: true,
  });
}

export function toggleSavedGiftPinned({
  inputSavedGifts,
  peer,
}: {
  inputSavedGifts: ApiRequestInputSavedStarGift[];
  peer: ApiPeer;
}) {
  return invokeRequest(new GramJs.payments.ToggleStarGiftsPinnedToTop({
    stargift: inputSavedGifts.map(buildInputSavedStarGift),
    peer: buildInputPeer(peer.id, peer.accessHash),
  }), {
    shouldReturnTrue: true,
  });
}

export async function fetchStarGiftWithdrawalUrl({
  inputGift,
  password,
}: {
  inputGift: ApiRequestInputSavedStarGift;
  password: string;
}) {
  try {
    const passwordCheck = await getPassword(password);

    if (!passwordCheck) {
      return undefined;
    }

    if ('error' in passwordCheck) {
      return passwordCheck;
    }

    const result = await invokeRequest(new GramJs.payments.GetStarGiftWithdrawalUrl({
      stargift: buildInputSavedStarGift(inputGift),
      password: passwordCheck,
    }), {
      shouldThrow: true,
    });

    if (!result) {
      return undefined;
    }

    return { url: result.url };
  } catch (err: unknown) {
    if (!checkErrorType(err)) return undefined;

    return wrapError(err);
  }

  return undefined;
}
