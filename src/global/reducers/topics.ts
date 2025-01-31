import type { ApiTopic } from '../../api/types';
import type { TopicsInfo } from '../../types';
import type { GlobalState } from '../types';

import { buildCollectionByKey, omit, unique } from '../../util/iteratees';
import {
  selectChat, selectTopic, selectTopics,
  selectTopicsInfo,
} from '../selectors';
import { updateThread, updateThreadInfo } from './messages';

function updateTopicsStore<T extends GlobalState>(
  global: T, chatId: string, update: Partial<TopicsInfo>,
) {
  const info = global.chats.topicsInfoById[chatId] || {};

  global = {
    ...global,
    chats: {
      ...global.chats,
      topicsInfoById: {
        ...global.chats.topicsInfoById,
        [chatId]: {
          ...info,
          ...update,
        },
      },
    },
  };

  return global;
}

export function updateListedTopicIds<T extends GlobalState>(
  global: T, chatId: string, topicIds: number[],
): T {
  const listedIds = selectTopicsInfo(global, chatId)?.listedTopicIds || [];
  return updateTopicsStore(global, chatId, {
    listedTopicIds: unique([
      ...listedIds,
      ...topicIds,
    ]),
  });
}

export function updateTopics<T extends GlobalState>(
  global: T, chatId: string, topicsCount: number, topics: ApiTopic[],
): T {
  const oldTopics = selectTopics(global, chatId);
  const newTopics = buildCollectionByKey(topics, 'id');

  global = updateTopicsStore(global, chatId, {
    topicsById: {
      ...oldTopics,
      ...newTopics,
    },
    totalCount: topicsCount,
  });

  topics.forEach((topic) => {
    global = updateThread(global, chatId, topic.id, {
      firstMessageId: topic.id,
    });

    global = updateThreadInfo(global, chatId, topic.id, {
      lastMessageId: topic.lastMessageId,
      threadId: topic.id,
      chatId,
    });
  });

  return global;
}

export function updateTopic<T extends GlobalState>(
  global: T, chatId: string, topicId: number, update: Partial<ApiTopic>,
): T {
  const chat = selectChat(global, chatId);

  if (!chat) return global;

  const topic = selectTopic(global, chatId, topicId);
  const oldTopics = selectTopics(global, chatId);

  const updatedTopic = {
    ...topic,
    ...update,
  } as ApiTopic;

  if (!updatedTopic.id) return global;

  global = updateTopicsStore(global, chatId, {
    topicsById: {
      ...oldTopics,
      [topicId]: updatedTopic,
    },
  });

  global = updateThread(global, chatId, updatedTopic.id, {
    firstMessageId: updatedTopic.id,
  });

  global = updateThreadInfo(global, chatId, updatedTopic.id, {
    lastMessageId: updatedTopic.lastMessageId,
    threadId: updatedTopic.id,
    chatId,
  });

  return global;
}

export function deleteTopic<T extends GlobalState>(
  global: T, chatId: string, topicId: number,
) {
  const topics = selectTopics(global, chatId);
  if (!topics) return global;

  global = updateTopicsStore(global, chatId, {
    topicsById: omit(topics, [topicId]),
  });

  return global;
}

export function updateTopicLastMessageId<T extends GlobalState>(
  global: T, chatId: string, threadId: number, lastMessageId: number,
) {
  return updateTopic(global, chatId, threadId, {
    lastMessageId,
  });
}

export function replacePinnedTopicIds<T extends GlobalState>(
  global: T, chatId: string, pinnedTopicIds: number[],
) {
  return updateTopicsStore(global, chatId, {
    orderedPinnedTopicIds: pinnedTopicIds,
  });
}
