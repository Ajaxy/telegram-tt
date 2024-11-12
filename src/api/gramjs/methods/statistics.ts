import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiMessagePublicForward, ApiPostStatistics, ApiStoryPublicForward, StatisticsGraph,
} from '../../types';

import { STATISTICS_PUBLIC_FORWARDS_LIMIT } from '../../../config';
import {
  buildChannelMonetizationStatistics,
  buildChannelStatistics,
  buildGraph,
  buildGroupStatistics,
  buildMessagePublicForwards,
  buildPostsStatistics,
  buildStoryPublicForwards,
} from '../apiBuilders/statistics';
import { buildInputEntity, buildInputPeer } from '../gramjsBuilders';
import { invokeRequest } from './client';
import { getPassword, onPasswordError } from './twoFaSettings';

export async function fetchChannelStatistics({
  chat, dcId,
}: { chat: ApiChat; dcId?: number }) {
  const result = await invokeRequest(new GramJs.stats.GetBroadcastStats({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
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
  chat, dcId,
}: { chat: ApiChat; dcId?: number }) {
  const result = await invokeRequest(new GramJs.stats.GetBroadcastRevenueStats({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
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
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
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
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
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
  offset,
}: {
  chat: ApiChat;
  messageId: number;
  dcId?: number;
  offset?: string;
}): Promise<{
    forwards?: ApiMessagePublicForward[];
    count?: number;
    nextOffset?: string;
  } | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetMessagePublicForwards({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    msgId: messageId,
    offset,
    limit: STATISTICS_PUBLIC_FORWARDS_LIMIT,
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

  return buildGraph(result as GramJs.StatsGraph, isPercentage);
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
  offset,
}: {
  chat: ApiChat;
  storyId: number;
  dcId?: number;
  offset?: string;
}): Promise<{
    publicForwards: (ApiMessagePublicForward | ApiStoryPublicForward)[] | undefined;
    count?: number;
    nextOffset?: string;
  } | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetStoryPublicForwards({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: storyId,
    offset,
    limit: STATISTICS_PUBLIC_FORWARDS_LIMIT,
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

export async function loadMonetizationRevenueWithdrawalUrl({
  chat, currentPassword,
}: { chat: ApiChat; currentPassword: string }) {
  try {
    const password = await getPassword(currentPassword);

    if (!password || 'error' in password) {
      return undefined;
    }

    const result = await invokeRequest(new GramJs.stats.GetBroadcastRevenueWithdrawalUrl({
      channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
      password,
    }), {
      shouldThrow: true,
    });

    if (!result) {
      return undefined;
    }

    return result;
  } catch (err: any) {
    onPasswordError(err);
  }

  return undefined;
}
