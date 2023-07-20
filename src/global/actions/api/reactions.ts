import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { callApi } from '../../../api/gramjs';

import type { ActionReturnType } from '../../types';
import { ApiMediaFormat } from '../../../api/types';

import {
  selectChat,
  selectChatMessage,
  selectCurrentChat,
  selectDefaultReaction,
  selectMaxUserReactions,
  selectMessageIdsByGroupId,
  selectPerformanceSettingsValue,
  selectTabState,
} from '../../selectors';
import { addMessageReaction, subtractXForEmojiInteraction, updateUnreadReactions } from '../../reducers/reactions';
import {
  addChatMessagesById, addChats, addUsers, updateChatMessage,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import * as mediaLoader from '../../../util/mediaLoader';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import {
  isSameReaction, getUserReactions, isMessageLocal, getDocumentMediaHash,
} from '../../helpers';

const INTERACTION_RANDOM_OFFSET = 40;

let interactionLocalId = 0;

addActionHandler('loadAvailableReactions', async (global): Promise<void> => {
  const result = await callApi('getAvailableReactions');
  if (!result) {
    return;
  }

  // Preload animations
  result.forEach((availableReaction) => {
    if (availableReaction.aroundAnimation) {
      mediaLoader.fetch(`sticker${availableReaction.aroundAnimation.id}`, ApiMediaFormat.BlobUrl);
    }
    if (availableReaction.centerIcon) {
      mediaLoader.fetch(`sticker${availableReaction.centerIcon.id}`, ApiMediaFormat.BlobUrl);
    }
    if (availableReaction.appearAnimation) {
      mediaLoader.fetch(`sticker${availableReaction.appearAnimation.id}`, ApiMediaFormat.BlobUrl);
    }
    if (availableReaction.selectAnimation) {
      mediaLoader.fetch(getDocumentMediaHash(availableReaction.selectAnimation), ApiMediaFormat.BlobUrl);
    }
  });

  global = getGlobal();
  global = {
    ...global,
    availableReactions: result,
  };
  setGlobal(global);
});

addActionHandler('interactWithAnimatedEmoji', (global, actions, payload): ActionReturnType => {
  const {
    emoji, x, y, startSize, isReversed, tabId = getCurrentTabId(),
  } = payload!;

  const activeEmojiInteraction = {
    id: interactionLocalId++,
    animatedEffect: emoji,
    x: subtractXForEmojiInteraction(global, x) + Math.random()
      * INTERACTION_RANDOM_OFFSET - INTERACTION_RANDOM_OFFSET / 2,
    y: y + Math.random() * INTERACTION_RANDOM_OFFSET - INTERACTION_RANDOM_OFFSET / 2,
    startSize,
    isReversed,
  };

  return updateTabState(global, {
    activeEmojiInteractions: [...(selectTabState(global, tabId).activeEmojiInteractions || []), activeEmojiInteraction],
  }, tabId);
});

addActionHandler('sendEmojiInteraction', (global, actions, payload): ActionReturnType => {
  const {
    messageId, chatId, emoji, interactions,
  } = payload!;
  if (global.connectionState !== 'connectionStateReady') return;

  const chat = selectChat(global, chatId);

  if (!chat || !emoji || chatId === global.currentUserId) {
    return;
  }

  void callApi('sendEmojiInteraction', {
    chat,
    messageId,
    emoticon: emoji,
    timestamps: interactions,
  });
});

addActionHandler('sendDefaultReaction', (global, actions, payload): ActionReturnType => {
  const {
    chatId, messageId, tabId = getCurrentTabId(),
  } = payload;
  const reaction = selectDefaultReaction(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);

  if (!reaction || !message || isMessageLocal(message)) return;

  actions.toggleReaction({
    chatId,
    messageId,
    reaction,
    tabId,
  });
});

addActionHandler('toggleReaction', async (global, actions, payload): Promise<void> => {
  const {
    chatId,
    reaction,
    shouldAddToRecent,
    tabId = getCurrentTabId(),
  } = payload;
  let { messageId } = payload;

  const chat = selectChat(global, chatId);
  let message = selectChatMessage(global, chatId, messageId);

  if (!chat || !message) {
    return;
  }

  const isInDocumentGroup = Boolean(message.groupedId) && !message.isInAlbum;
  const documentGroupFirstMessageId = isInDocumentGroup
    ? selectMessageIdsByGroupId(global, chatId, message.groupedId!)![0]
    : undefined;
  message = isInDocumentGroup
    ? selectChatMessage(global, chatId, documentGroupFirstMessageId!) || message
    : message;
  messageId = message?.id || messageId;

  const userReactions = getUserReactions(message);
  const hasReaction = userReactions.some((userReaction) => isSameReaction(userReaction, reaction));

  const newUserReactions = hasReaction
    ? userReactions.filter((userReaction) => !isSameReaction(userReaction, reaction)) : [...userReactions, reaction];

  const limit = selectMaxUserReactions(global);
  const reactions = newUserReactions.slice(-limit);
  const tabState = selectTabState(global, tabId);

  if (selectPerformanceSettingsValue(global, 'reactionEffects')) {
    const newActiveReactions = hasReaction ? omit(tabState.activeReactions, [messageId]) : {
      ...tabState.activeReactions,
      [messageId]: [
        ...(tabState.activeReactions[messageId] || []),
        {
          messageId,
          reaction,
        },
      ],
    };
    global = updateTabState(global, {
      activeReactions: newActiveReactions,
    }, tabId);
  }

  global = addMessageReaction(global, message, reactions);
  setGlobal(global);

  try {
    await callApi('sendReaction', {
      chat,
      messageId,
      reactions,
      shouldAddToRecent,
    });
  } catch (error) {
    global = getGlobal();
    global = addMessageReaction(global, message, userReactions);
    setGlobal(global);
  }
});

addActionHandler('stopActiveReaction', (global, actions, payload): ActionReturnType => {
  const { messageId, reaction, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);
  if (!tabState.activeReactions[messageId]?.some((active) => isSameReaction(active.reaction, reaction))) {
    return global;
  }

  const newMessageActiveReactions = tabState.activeReactions[messageId]
    .filter((active) => !isSameReaction(active.reaction, reaction));

  const newActiveReactions = newMessageActiveReactions.length ? {
    ...tabState.activeReactions,
    [messageId]: newMessageActiveReactions,
  } : omit(tabState.activeReactions, [messageId]);

  return updateTabState(global, {
    activeReactions: newActiveReactions,
  }, tabId);
});

addActionHandler('setDefaultReaction', async (global, actions, payload): Promise<void> => {
  const { reaction } = payload;

  const result = await callApi('setDefaultReaction', { reaction });
  if (!result) {
    return;
  }

  global = getGlobal();

  if (!global.config) {
    actions.loadConfig(); // Refetch new config, if it is somehow not loaded
    return;
  }

  global = {
    ...global,
    config: {
      ...global.config,
      defaultReaction: reaction,
    },
  };
  setGlobal(global);
});

addActionHandler('stopActiveEmojiInteraction', (global, actions, payload): ActionReturnType => {
  const { id, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    activeEmojiInteractions: selectTabState(global, tabId)
      .activeEmojiInteractions?.filter((active) => active.id !== id),
  }, tabId);
});

addActionHandler('loadReactors', async (global, actions, payload): Promise<void> => {
  const { chatId, messageId, reaction } = payload;
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);
  if (!chat || !message) {
    return;
  }

  const offset = message.reactors?.nextOffset;
  const result = await callApi('fetchMessageReactionsList', {
    reaction,
    chat,
    messageId,
    offset,
  });

  if (!result) {
    return;
  }

  global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));

  global = updateChatMessage(global, chatId, messageId, {
    reactors: result,
  });
  setGlobal(global);
});

addActionHandler('loadMessageReactions', (global, actions, payload): ActionReturnType => {
  const { ids, chatId } = payload;

  const chat = selectChat(global, chatId);

  if (!chat || global.connectionState !== 'connectionStateReady') {
    return;
  }

  callApi('fetchMessageReactions', { ids, chat });
});

addActionHandler('sendWatchingEmojiInteraction', (global, actions, payload): ActionReturnType => {
  const {
    chatId, emoticon, x, y, startSize, isReversed, id, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);

  const tabState = selectTabState(global, tabId);
  if (!chat || !tabState.activeEmojiInteractions?.some((interaction) => interaction.id === id)
    || chatId === global.currentUserId) {
    return undefined;
  }

  if (global.connectionState === 'connectionStateReady') {
    callApi('sendWatchingEmojiInteraction', { chat, emoticon });
  }

  return updateTabState(global, {
    activeEmojiInteractions: tabState.activeEmojiInteractions.map((activeEmojiInteraction) => {
      if (activeEmojiInteraction.id === id) {
        return {
          ...activeEmojiInteraction,
          x: subtractXForEmojiInteraction(global, x),
          y,
          startSize,
          isReversed,
        };
      }
      return activeEmojiInteraction;
    }),
  }, tabId);
});

addActionHandler('fetchUnreadReactions', async (global, actions, payload): Promise<void> => {
  const { chatId, offsetId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('fetchUnreadReactions', { chat, offsetId, addOffset: offsetId ? -1 : undefined });

  // Server side bug, when server returns unread reactions count > 0 for deleted messages
  if (!result || !result.messages.length) {
    global = getGlobal();
    global = updateUnreadReactions(global, chatId, {
      unreadReactionsCount: 0,
    });

    setGlobal(global);
    return;
  }

  const { messages, chats, users } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number);

  global = getGlobal();
  global = addChatMessagesById(global, chat.id, byId);
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChats(global, buildCollectionByKey(chats, 'id'));
  global = updateUnreadReactions(global, chatId, {
    unreadReactions: [...(chat.unreadReactions || []), ...ids],
  });

  setGlobal(global);
});

addActionHandler('animateUnreadReaction', (global, actions, payload): ActionReturnType => {
  const { messageIds, tabId = getCurrentTabId() } = payload;

  const chat = selectCurrentChat(global, tabId);
  if (!chat) return undefined;

  if (chat.unreadReactionsCount) {
    const unreadReactionsCount = chat.unreadReactionsCount - messageIds.length;
    const unreadReactions = (chat.unreadReactions || []).filter((id) => !messageIds.includes(id));

    global = updateUnreadReactions(global, chat.id, {
      unreadReactions,
    });

    setGlobal(global);

    if (!unreadReactions.length && unreadReactionsCount) {
      actions.fetchUnreadReactions({ chatId: chat.id, offsetId: Math.min(...messageIds) });
    }
  }

  actions.markMessagesRead({ messageIds, tabId });

  if (!selectPerformanceSettingsValue(global, 'reactionEffects')) return undefined;

  global = getGlobal();

  return updateTabState(global, {
    activeReactions: {
      ...selectTabState(global, tabId).activeReactions,
      ...Object.fromEntries(messageIds.map((messageId) => {
        const message = selectChatMessage(global, chat.id, messageId);

        if (!message) return undefined;

        const unread = message.reactions?.recentReactions?.filter(({ isUnread }) => isUnread);

        if (!unread) return undefined;

        const reactions = unread.map((recent) => recent.reaction);

        return [messageId, reactions.map((r) => ({
          messageId,
          reaction: r,
        }))];
      }).filter(Boolean)),
    },
  }, tabId);
});

addActionHandler('focusNextReaction', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const chat = selectCurrentChat(global, tabId);

  if (!chat?.unreadReactions) return;

  actions.focusMessage({ chatId: chat.id, messageId: chat.unreadReactions[0], tabId });
});

addActionHandler('readAllReactions', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const chat = selectCurrentChat(global, tabId);
  if (!chat) return undefined;

  callApi('readAllReactions', { chat });

  return updateUnreadReactions(global, chat.id, {
    unreadReactionsCount: undefined,
    unreadReactions: undefined,
  });
});

addActionHandler('loadTopReactions', async (global): Promise<void> => {
  const result = await callApi('fetchTopReactions', {});
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    topReactions: result.reactions,
  };
  setGlobal(global);
});

addActionHandler('loadRecentReactions', async (global): Promise<void> => {
  const result = await callApi('fetchRecentReactions', {});
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    recentReactions: result.reactions,
  };
  setGlobal(global);
});

addActionHandler('clearRecentReactions', async (global): Promise<void> => {
  const result = await callApi('clearRecentReactions');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    recentReactions: [],
  };
  setGlobal(global);
});
