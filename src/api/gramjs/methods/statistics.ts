import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiMessagePublicForward, ApiPostStatistics, ApiStoryPublicForward, ApiUser, StatisticsGraph,
} from '../../types';

import { STATISTICS_PUBLIC_FORWARDS_LIMIT } from '../../../config';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import {
  buildChannelStatistics,
  buildGraph,
  buildGroupStatistics,
  buildMessagePublicForwards,
  buildPostsStatistics,
  buildStoryPublicForwards,
} from '../apiBuilders/statistics';
import { buildApiUser } from '../apiBuilders/users';
import { buildInputEntity, buildInputPeer } from '../gramjsBuilders';
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
    chats: ApiChat[];
    users: ApiUser[];
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

  addEntitiesToLocalDb(result.chats);
  addEntitiesToLocalDb(result.users);

  return {
    forwards: buildMessagePublicForwards(result),
    count: result.count,
    nextOffset: result.nextOffset,
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
    users: result.users.map(buildApiUser).filter(Boolean),
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
    users: ApiUser[];
    chats: ApiChat[];
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

  addEntitiesToLocalDb(result.chats);
  addEntitiesToLocalDb(result.users);

  return {
    publicForwards: buildStoryPublicForwards(result),
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
    count: result.count,
    nextOffset: result.nextOffset,
  };
}
