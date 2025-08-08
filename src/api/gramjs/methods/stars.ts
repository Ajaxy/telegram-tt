import bigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { GiftProfileFilterOptions, ResaleGiftsFilterOptions } from '../../../types';
import type {
  ApiChat,
  ApiPeer,
  ApiRequestInputSavedStarGift,
  ApiStarGiftAttributeId,
  ApiStarGiftRegular,
} from '../../types';

import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildApiResaleGifts, buildApiSavedStarGift, buildApiStarGift,
  buildApiStarGiftAttribute, buildInputResaleGiftsAttributes } from '../apiBuilders/gifts';
import {
  buildApiCurrencyAmount,
  buildApiStarsGiftOptions,
  buildApiStarsGiveawayOptions,
  buildApiStarsSubscription,
  buildApiStarsTransaction,
  buildApiStarTopupOption,
} from '../apiBuilders/payments';
import { buildApiUser } from '../apiBuilders/users';
import { buildInputPeer, buildInputSavedStarGift, buildInputUser, DEFAULT_PRIMITIVES } from '../gramjsBuilders';
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
  const result = await invokeRequest(new GramJs.payments.GetStarGifts({
    hash: DEFAULT_PRIMITIVES.INT,
  }));

  if (!result || result instanceof GramJs.payments.StarGiftsNotModified) {
    return undefined;
  }

  const chats = result.chats?.map((chat) => buildApiChatFromPreview(chat)).filter(Boolean);
  const users = result.users?.map(buildApiUser).filter(Boolean);

  // Right now, only regular star gifts can be bought, but API are not specific
  const gifts
   = result.gifts.map(buildApiStarGift).filter((gift): gift is ApiStarGiftRegular => gift.type === 'starGift');

  return {
    gifts,
    chats,
    users,
  };
}

export async function fetchResaleGifts({
  giftId,
  offset = DEFAULT_PRIMITIVES.STRING,
  limit = DEFAULT_PRIMITIVES.INT,
  attributesHash,
  filter,
}: {
  giftId: string;
  offset?: string;
  limit?: number;
  attributesHash?: string;
  filter?: ResaleGiftsFilterOptions;
}) {
   type GetResaleStarGifts = ConstructorParameters<typeof GramJs.payments.GetResaleStarGifts>[0];

   const attributes: ApiStarGiftAttributeId[] = [
     ...(filter?.backdropAttributes ?? []),
     ...(filter?.modelAttributes ?? []),
     ...(filter?.patternAttributes ?? []),
   ];

   const params: GetResaleStarGifts = {
     giftId: bigInt(giftId),
     offset,
     limit,
     attributesHash: attributesHash ? bigInt(attributesHash) : DEFAULT_PRIMITIVES.BIGINT,
     attributes: buildInputResaleGiftsAttributes(attributes),
     ...(filter && {
       sortByPrice: filter.sortType === 'byPrice' || undefined,
       sortByNum: filter.sortType === 'byNumber' || undefined,
     } satisfies Partial<GetResaleStarGifts>),
   };

   const result = await invokeRequest(new GramJs.payments.GetResaleStarGifts(params));

   if (!result) {
     return undefined;
   }

   return buildApiResaleGifts(result);
}

export async function fetchSavedStarGifts({
  peer,
  offset = DEFAULT_PRIMITIVES.STRING,
  limit = DEFAULT_PRIMITIVES.INT,
  filter,
}: {
  peer: ApiPeer;
  offset?: string;
  limit?: number;
  filter?: GiftProfileFilterOptions;
}) {
  type GetSavedStarGiftsParams = ConstructorParameters<typeof GramJs.payments.GetSavedStarGifts>[0];

  const params: GetSavedStarGiftsParams = {
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
    } satisfies Partial<GetSavedStarGiftsParams>),
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
    userId: chat && buildInputUser(chat.id, chat.accessHash),
  }));

  if (!result) {
    return undefined;
  }

  return result.map(buildApiStarsGiftOptions);
}

export async function fetchStarsStatus({
  isTon,
}: {
  isTon?: boolean;
} = {}) {
  const result = await invokeRequest(new GramJs.payments.GetStarsStatus({
    peer: new GramJs.InputPeerSelf(),
    ton: isTon || undefined,
  }));

  if (!result) {
    return undefined;
  }

  const balance = buildApiCurrencyAmount(result.balance);
  if (!balance) {
    return undefined;
  }

  return {
    nextHistoryOffset: result.nextOffset,
    history: result.history?.map(buildApiStarsTransaction).filter(Boolean),
    nextSubscriptionOffset: result.subscriptionsNextOffset,
    subscriptions: result.subscriptions?.map(buildApiStarsSubscription),
    balance,
  };
}

export async function fetchStarsTransactions({
  peer,
  offset = DEFAULT_PRIMITIVES.STRING,
  limit = DEFAULT_PRIMITIVES.INT,
  isInbound,
  isOutbound,
  isTon,
}: {
  peer?: ApiPeer;
  offset?: string;
  limit?: number;
  isInbound?: boolean;
  isOutbound?: boolean;
  isTon?: boolean;
}) {
  const inputPeer = peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf();
  const result = await invokeRequest(new GramJs.payments.GetStarsTransactions({
    peer: inputPeer,
    offset,
    limit,
    inbound: isInbound || undefined,
    outbound: isOutbound || undefined,
    ton: isTon || undefined,
  }));

  if (!result) {
    return undefined;
  }

  const balance = buildApiCurrencyAmount(result.balance);
  if (!balance) {
    return undefined;
  }

  return {
    nextOffset: result.nextOffset,
    history: result.history?.map(buildApiStarsTransaction).filter(Boolean),
    balance,
  };
}

export async function fetchStarsTransactionById({
  id, peer, ton,
}: {
  id: string;
  peer?: ApiPeer;
  ton?: true;
}) {
  const inputPeer = peer ? buildInputPeer(peer.id, peer.accessHash) : new GramJs.InputPeerSelf();
  const result = await invokeRequest(new GramJs.payments.GetStarsTransactionsByID({
    peer: inputPeer,
    ton,
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
  offset = DEFAULT_PRIMITIVES.STRING,
  peer,
}: {
  offset?: string; limit?: number;
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

  const balance = buildApiCurrencyAmount(result.balance);
  if (!balance) {
    return undefined;
  }

  return {
    nextOffset: result.subscriptionsNextOffset,
    subscriptions: result.subscriptions.map(buildApiStarsSubscription),
    balance,
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

export function updateStarGiftPrice({
  inputSavedGift,
  price,
}: {
  inputSavedGift: ApiRequestInputSavedStarGift;
  price: number;
}) {
  return invokeRequest(new GramJs.payments.UpdateStarGiftPrice({
    stargift: buildInputSavedStarGift(inputSavedGift),
    resellStars: bigInt(price),
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
