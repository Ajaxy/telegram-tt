import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiMessagePublicForward, ApiMessageStatistics, StatisticsGraph,
} from '../../types';

import {
  buildChannelStatistics, buildGraph,
  buildGroupStatistics, buildMessagePublicForwards, buildMessageStatistics,
} from '../apiBuilders/statistics';
import { buildApiUser } from '../apiBuilders/users';
import { buildInputEntity } from '../gramjsBuilders';
import { addEntitiesToLocalDb } from '../helpers';
import { invokeRequest } from './client';

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

  addEntitiesToLocalDb(result.users);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
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
}): Promise<ApiMessageStatistics | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetMessageStats({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    msgId: messageId,
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  return buildMessageStatistics(result);
}

export async function fetchMessagePublicForwards({
  chat,
  messageId,
  dcId,
}: {
  chat: ApiChat;
  messageId: number;
  dcId?: number;
}): Promise<ApiMessagePublicForward[] | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetMessagePublicForwards({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    msgId: messageId,
    offsetPeer: new GramJs.InputPeerEmpty(),
  }), {
    dcId,
  });

  if (!result) {
    return undefined;
  }

  if ('chats' in result) {
    addEntitiesToLocalDb(result.chats);
  }

  return buildMessagePublicForwards(result);
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
