import type { ApiTopic, ApiTopicWithState } from '../../api/types';
import type { TopicsInfo } from '../../types';
import type { GlobalState } from '../types';

import { omit, pick, unique } from '../../util/iteratees';
import {
  selectChat, selectTopic, selectTopics,
  selectTopicsInfo,
} from '../selectors';
import {
  updateThreadInfo,
  updateThreadLocalState,
  updateThreadReadState,
} from './threads';

const SAFE_MIN_PROPERTIES: (keyof ApiTopic)[] = [
  'id',
  'title',
  'iconColor',
  'iconEmojiId',
  'date',
  'fromId',
  'isOwner',
  'isClosed',
];

export function updateTopicsInfo<T extends GlobalState>(
  global: T, chatId: string, update: Partial<TopicsInfo>,
) {
  const info = global.chats.topicsInfoById[chatId] || { topicsById: {} };

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
  return updateTopicsInfo(global, chatId, {
    listedTopicIds: unique([
      ...listedIds,
      ...topicIds,
    ]),
  });
}

export function updateTopic<T extends GlobalState>(
  global: T, chatId: string, topicId: number, update: Partial<ApiTopic>,
): T {
  const chat = selectChat(global, chatId);

  if (!chat) return global;

  const topic = selectTopic(global, chatId, topicId);
  const oldTopics = selectTopics(global, chatId);

  const safeUpdate = update.isMin ? pick(update, SAFE_MIN_PROPERTIES) : update;

  const updatedTopic = {
    ...topic,
    ...safeUpdate,
  } as ApiTopic;

  if (!updatedTopic.id) return global;

  global = updateTopicsInfo(global, chatId, {
    topicsById: {
      ...oldTopics,
      [topicId]: updatedTopic,
    },
  });

  global = updateThreadLocalState(global, chatId, updatedTopic.id, {
    firstMessageId: updatedTopic.id,
  });

  return global;
}

export function updateTopicWithState<T extends GlobalState>(
  global: T, chatId: string, topicWithState: ApiTopicWithState,
): T {
  const topicId = topicWithState.topic.id;

  global = updateTopic(global, chatId, topicId, topicWithState.topic);
  if (!topicWithState.topic.isMin) {
    global = updateThreadInfo(global, {
      isCommentsInfo: false,
      chatId,
      threadId: topicId,
      lastMessageId: topicWithState.lastMessageId,
    });
  }
  if (topicWithState.readState) {
    global = updateThreadReadState(global, chatId, topicId, topicWithState.readState);
  }

  return global;
}

export function deleteTopic<T extends GlobalState>(
  global: T, chatId: string, topicId: number,
) {
  const topics = selectTopics(global, chatId);
  if (!topics) return global;

  global = updateTopicsInfo(global, chatId, {
    topicsById: omit(topics, [topicId]),
  });

  return global;
}

export function replacePinnedTopicIds<T extends GlobalState>(
  global: T, chatId: string, pinnedTopicIds: number[],
) {
  return updateTopicsInfo(global, chatId, {
    orderedPinnedTopicIds: pinnedTopicIds,
  });
}
