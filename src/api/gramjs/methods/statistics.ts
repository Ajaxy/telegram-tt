import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiMessagePublicForward, ApiPeer, ApiPostStatistics, ApiStoryPublicForward, StatisticsGraph,
} from '../../types';

import {
  buildChannelMonetizationStatistics,
  buildChannelStatistics,
  buildGraph,
  buildGroupStatistics,
  buildMessagePublicForwards,
  buildPostsStatistics,
  buildStoryPublicForwards,
} from '../apiBuilders/statistics';
import { buildInputChannel, buildInputPeer, DEFAULT_PRIMITIVES } from '../gramjsBuilders';
import { checkErrorType, wrapError } from '../helpers/misc';
import { invokeRequest } from './client';
import { getPassword } from './twoFaSettings';

export async function fetchChannelStatistics({
  chat, dcId,
}: { chat: ApiChat; dcId?: number }) {
  const result = await invokeRequest(new GramJs.stats.GetBroadcastStats({
    channel: buildInputChannel(chat.id, chat.accessHash),
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return {
    stats: buildChannelStatistics(result),
    users: [],
  };
}

export async function fetchChannelMonetizationStatistics({
  peer, dcId,
}: {
  peer: ApiPeer;
  dcId?: number;
}) {
  const result = await invokeRequest(new GramJs.payments.GetStarsRevenueStats({
    peer: buildInputPeer(peer.id, peer.accessHash),
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return buildChannelMonetizationStatistics(result);
}

export async function fetchGroupStatistics({
  chat, dcId,
}: { chat: ApiChat; dcId?: number }) {
  const result = await invokeRequest(new GramJs.stats.GetMegagroupStats({
    channel: buildInputChannel(chat.id, chat.accessHash),
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return {
    stats: buildGroupStatistics(result),
  };
}

export async function fetchMessageStatistics({
  chat,
  messageId,
  dcId,
}: {
  chat: ApiChat;
  messageId: number;
  dcId?: number;
}): Promise<ApiPostStatistics | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetMessageStats({
    channel: buildInputChannel(chat.id, chat.accessHash),
    msgId: messageId,
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return buildPostsStatistics(result);
}

export async function fetchMessagePublicForwards({
  chat,
  messageId,
  dcId,
  offset = DEFAULT_PRIMITIVES.STRING,
  limit = DEFAULT_PRIMITIVES.INT,
}: {
  chat: ApiChat;
  messageId: number;
  dcId?: number;
  offset?: string;
  limit?: number;
}): Promise<{
  forwards?: ApiMessagePublicForward[];
  count?: number;
  nextOffset?: string;
} | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetMessagePublicForwards({
    channel: buildInputChannel(chat.id, chat.accessHash),
    msgId: messageId,
    offset,
    limit,
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return {
    forwards: buildMessagePublicForwards(result),
    count: result.count,
    nextOffset: result.nextOffset,
  };
}

export async function fetchStatisticsAsyncGraph({
  token,
  x,
  isPercentage,
  dcId,
}: {
  token: string;
  x?: number;
  isPercentage?: boolean;
  dcId?: number;
}): Promise<StatisticsGraph | undefined> {
  const result = await invokeRequest(new GramJs.stats.LoadAsyncGraph({
    token,
    ...(x && { x: BigInt(x) }),
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  const graph = buildGraph(result, isPercentage);

  if (graph.graphType !== 'graph') return undefined;
  return graph;
}

export async function fetchStoryStatistics({
  chat,
  storyId,
  dcId,
}: {
  chat: ApiChat;
  storyId: number;
  dcId?: number;
}): Promise<ApiPostStatistics | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetStoryStats({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: storyId,
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return buildPostsStatistics(result);
}

export async function fetchStoryPublicForwards({
  chat,
  storyId,
  dcId,
  offset = DEFAULT_PRIMITIVES.STRING,
  limit = DEFAULT_PRIMITIVES.INT,
}: {
  chat: ApiChat;
  storyId: number;
  dcId?: number;
  offset?: string;
  limit?: number;
}): Promise<{
  publicForwards: (ApiMessagePublicForward | ApiStoryPublicForward)[] | undefined;
  count?: number;
  nextOffset?: string;
} | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetStoryPublicForwards({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: storyId,
    offset,
    limit,
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return {
    publicForwards: buildStoryPublicForwards(result),
    count: result.count,
    nextOffset: result.nextOffset,
  };
}

export async function fetchMonetizationRevenueWithdrawalUrl({
  peer, currentPassword,
}: {
  peer: ApiPeer;
  currentPassword: string;
}) {
  try {
    const password = await getPassword(currentPassword);

    if (!password) {
      return undefined;
    }

    if ('error' in password) {
      return password;
    }

    const result = await invokeRequest(new GramJs.payments.GetStarsRevenueWithdrawalUrl({
      peer: buildInputPeer(peer.id, peer.accessHash),
      password,
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
