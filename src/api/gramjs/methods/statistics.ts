import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiMessageStatistics, ApiMessagePublicForward, StatisticsGraph,
} from '../../types';

import { invokeRequest } from './client';
import { addEntitiesWithPhotosToLocalDb } from '../helpers';
import { buildInputEntity } from '../gramjsBuilders';
import {
  buildChannelStatistics, buildGroupStatistics, buildMessageStatistics, buildMessagePublicForwards, buildGraph,
} from '../apiBuilders/statistics';
import { buildApiUser } from '../apiBuilders/users';

export async function fetchChannelStatistics({
  chat,
}: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.stats.GetBroadcastStats({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
  }), undefined, undefined, undefined, chat.fullInfo!.statisticsDcId);

  if (!result) {
    return undefined;
  }

  return {
    stats: buildChannelStatistics(result),
    users: [],
  };
}

export async function fetchGroupStatistics({
  chat,
}: { chat: ApiChat }) {
  const result = await invokeRequest(new GramJs.stats.GetMegagroupStats({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
  }), undefined, undefined, undefined, chat.fullInfo!.statisticsDcId);

  if (!result) {
    return undefined;
  }

  addEntitiesWithPhotosToLocalDb(result.users);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    stats: buildGroupStatistics(result),
  };
}

export async function fetchMessageStatistics({
  chat,
  messageId,
}: {
  chat: ApiChat;
  messageId: number;
}): Promise<ApiMessageStatistics | undefined> {
  const result = await invokeRequest(new GramJs.stats.GetMessageStats({
    channel: buildInputEntity(chat.id, chat.accessHash) as GramJs.InputChannel,
    msgId: messageId,
  }), undefined, undefined, undefined, chat.fullInfo!.statisticsDcId);

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
  }), undefined, undefined, undefined, dcId);

  if (!result) {
    return undefined;
  }

  if ('chats' in result) {
    addEntitiesWithPhotosToLocalDb(result.chats);
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
  }), undefined, undefined, undefined, dcId);

  if (!result) {
    return undefined;
  }

  return buildGraph(result as GramJs.StatsGraph, isPercentage);
}
