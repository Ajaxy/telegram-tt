import type { ApiError, ApiReaction, ApiReactionEmoji } from '../../../api/types';
import type { ActionReturnType } from '../../types';
import { ApiMediaFormat } from '../../../api/types';

import { GENERAL_REFETCH_INTERVAL } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import {
  buildCollectionByCallback, buildCollectionByKey, omit, partition, unique,
} from '../../../util/iteratees';
import { getMessageKey } from '../../../util/keys/messageKey';
import * as mediaLoader from '../../../util/mediaLoader';
import requestActionTimeout from '../../../util/requestActionTimeout';
import { callApi } from '../../../api/gramjs';
import {
  addPaidReaction,
  getDocumentMediaHash,
  getReactionKey,
  getUserReactions,
  isMessageLocal,
  isSameReaction,
} from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addChatMessagesById, updateChat, updateChatMessage,
} from '../../reducers';
import { addMessageReaction, subtractXForEmojiInteraction, updateUnreadReactions } from '../../reducers/reactions';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatMessage,
  selectCurrentChat,
  selectDefaultReaction,
  selectIsChatWithSelf,
  selectMaxUserReactions,
  selectMessageIdsByGroupId,
  selectPerformanceSettingsValue,
  selectTabState,
} from '../../selectors';

const INTERACTION_RANDOM_OFFSET = 40;

let interactionLocalId = 0;

addActionHandler('loadAvailableReactions', async (global): Promise<void> => {
  const result = await callApi('fetchAvailableReactions');
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
      mediaLoader.fetch(getDocumentMediaHash(availableReaction.selectAnimation, 'full')!, ApiMediaFormat.BlobUrl);
    }
  });

  global = getGlobal();
  global = {
    ...global,
    reactions: {
      ...global.reactions,
      availableReactions: result,
    },
  };
  setGlobal(global);

  requestActionTimeout({
    action: 'loadAvailableReactions',
    payload: undefined,
  }, GENERAL_REFETCH_INTERVAL);
});

addActionHandler('loadAvailableEffects', async (global): Promise<void> => {
  const result = await callApi('fetchAvailableEffects');
  if (!result) {
    return;
  }

  const { effects, emojis, stickers } = result;
  const reactions:ApiReactionEmoji[] = [];

  const effectById = buildCollectionByKey(effects, 'id');

  for (const effect of effects) {
    if (effect.effectAnimationId) {
      const reaction: ApiReactionEmoji = {
        type: 'emoji',
        emoticon: effect.emoticon,
      };
      reactions.push(reaction);
    }
  }

  global = getGlobal();
  global = {
    ...global,
    availableEffectById: effectById,
    stickers: {
      ...global.stickers,
      effect: {
        stickers,
        emojis,
      },
    },
    reactions: {
      ...global.reactions,
      effectReactions: reactions,
    },
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

  if (!chat || !emoji || selectIsChatWithSelf(global, chatId)) {
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

  const isInSaved = selectIsChatWithSelf(global, chatId);

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
  const [paidReactions, regularReactions] = partition(newUserReactions, (r) => r.type === 'paid');
  const trimmedRegularReactions = regularReactions.slice(-limit) as ApiReaction[];
  const localReactions = [...paidReactions, ...trimmedRegularReactions];
  const messageKey = getMessageKey(message);

  if (selectPerformanceSettingsValue(global, 'reactionEffects')) {
    if (hasReaction) {
      actions.stopActiveReaction({ containerId: messageKey, reaction, tabId });
    } else {
      actions.startActiveReaction({ containerId: messageKey, reaction, tabId });
    }
  }

  global = addMessageReaction(global, message, localReactions);
  setGlobal(global);

  try {
    await callApi('sendReaction', {
      chat,
      messageId,
      reactions: trimmedRegularReactions,
      shouldAddToRecent,
    });

    if (isInSaved) {
      actions.loadSavedReactionTags();
    }
  } catch (error) {
    global = getGlobal();
    global = addMessageReaction(global, message, userReactions);
    setGlobal(global);
  }
});

addActionHandler('addLocalPaidReaction', (global, actions, payload): ActionReturnType => {
  const {
    chatId, messageId, count, isPrivate, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);

  if (!chat || !message) {
    return;
  }

  const currentReactions = message.reactions?.results || [];
  const newReactions = addPaidReaction(currentReactions, count, isPrivate);
  global = updateChatMessage(global, message.chatId, message.id, {
    reactions: {
      ...currentReactions,
      results: newReactions,
    },
  });
  setGlobal(global);

  const messageKey = getMessageKey(message);
  if (selectPerformanceSettingsValue(global, 'reactionEffects')) {
    actions.startActiveReaction({
      containerId: messageKey,
      reaction: {
        type: 'paid',
      },
      tabId,
    });
  }
});

addActionHandler('sendPaidReaction', async (global, actions, payload): Promise<void> => {
  const {
    chatId, messageId, forcedAmount, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);

  if (!chat || !message) {
    return;
  }

  const paidReaction = message.reactions?.results?.find((r) => r.reaction.type === 'paid');
  const count = forcedAmount || paidReaction?.localAmount || 0;
  if (!count) {
    return;
  }
  actions.resetLocalPaidReactions({ chatId, messageId });

  try {
    await callApi('sendPaidReaction', {
      chat,
      messageId,
      count,
      isPrivate: paidReaction?.localIsPrivate,
    });
  } catch (error) {
    if ((error as ApiError).message === 'BALANCE_TOO_LOW') {
      actions.openStarsBalanceModal({ originReaction: { chatId, messageId, amount: count }, tabId });
    }
  }
});

addActionHandler('startActiveReaction', (global, actions, payload): ActionReturnType => {
  const { containerId, reaction, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);

  if (!selectPerformanceSettingsValue(global, 'reactionEffects')) return undefined;

  const currentActiveReactions = tabState.activeReactions[containerId] || [];
  if (currentActiveReactions.some((active) => isSameReaction(active, reaction))) {
    return undefined;
  }

  const newActiveReactions = currentActiveReactions.concat(reaction);

  return updateTabState(global, {
    activeReactions: {
      ...tabState.activeReactions,
      [containerId]: newActiveReactions,
    },
  }, tabId);
});

addActionHandler('stopActiveReaction', (global, actions, payload): ActionReturnType => {
  const { containerId, reaction, tabId = getCurrentTabId() } = payload;

  const tabState = selectTabState(global, tabId);

  const currentActiveReactions = tabState.activeReactions[containerId] || [];
  // Remove all reactions if reaction is not specified
  const newMessageActiveReactions = reaction
    ? currentActiveReactions.filter((active) => !isSameReaction(active, reaction)) : [];

  const newActiveReactions = newMessageActiveReactions.length ? {
    ...tabState.activeReactions,
    [containerId]: newMessageActiveReactions,
  } : omit(tabState.activeReactions, [containerId]);

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
    || selectIsChatWithSelf(global, chatId)) {
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

  const { messages } = result;

  const byId = buildCollectionByKey(messages, 'id');
  const ids = Object.keys(byId).map(Number);

  global = getGlobal();
  global = addChatMessagesById(global, chat.id, byId);
  global = updateUnreadReactions(global, chatId, {
    unreadReactions: unique([...(chat.unreadReactions || []), ...ids]).sort((a, b) => b - a),
  });

  setGlobal(global);
});

addActionHandler('animateUnreadReaction', (global, actions, payload): ActionReturnType => {
  const { messageIds, tabId = getCurrentTabId() } = payload;

  const chat = selectCurrentChat(global, tabId);
  if (!chat) return undefined;

  if (!chat.unreadReactionsCount) {
    return updateUnreadReactions(global, chat.id, {
      unreadReactions: [],
    });
  }

  const unreadReactionsCount = Math.max(chat.unreadReactionsCount - messageIds.length, 0);
  const unreadReactions = (chat.unreadReactions || []).filter((id) => !messageIds.includes(id));

  global = updateUnreadReactions(global, chat.id, {
    unreadReactions,
    unreadReactionsCount,
  });

  setGlobal(global);

  actions.markMessagesRead({ messageIds, shouldFetchUnreadReactions: true, tabId });

  if (!selectPerformanceSettingsValue(global, 'reactionEffects')) return undefined;

  global = getGlobal();

  messageIds.forEach((id) => {
    const message = selectChatMessage(global, chat.id, id);
    if (!message) return;

    const { reaction, isOwn, isUnread } = message.reactions?.recentReactions?.[0] ?? {};
    if (reaction && isUnread && !isOwn) {
      const messageKey = getMessageKey(message);
      actions.startActiveReaction({ containerId: messageKey, reaction, tabId: getCurrentTabId() });
    }
  });

  return undefined;
});

addActionHandler('focusNextReaction', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const chat = selectCurrentChat(global, tabId);

  if (!chat?.unreadReactions) {
    if (chat?.unreadReactionsCount) {
      return updateChat(global, chat.id, {
        unreadReactionsCount: 0,
      });
    }
    return undefined;
  }

  actions.focusMessage({
    chatId: chat.id, messageId: chat.unreadReactions[0], tabId, scrollTargetPosition: 'end',
  });
  actions.markMessagesRead({ messageIds: [chat.unreadReactions[0]], tabId });
  return undefined;
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
  const result = await callApi('fetchTopReactions', {
    hash: global.reactions.hash.topReactions,
  });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    reactions: {
      ...global.reactions,
      topReactions: result.reactions,
      hash: {
        ...global.reactions.hash,
        topReactions: result.hash,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('loadRecentReactions', async (global): Promise<void> => {
  const result = await callApi('fetchRecentReactions', {
    hash: global.reactions.hash.recentReactions,
  });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    reactions: {
      ...global.reactions,
      recentReactions: result.reactions,
      hash: {
        ...global.reactions.hash,
        recentReactions: result.hash,
      },
    },
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
    reactions: {
      ...global.reactions,
      recentReactions: [],
    },
  };
  setGlobal(global);
});

addActionHandler('loadDefaultTagReactions', async (global): Promise<void> => {
  const result = await callApi('fetchDefaultTagReactions', {
    hash: global.reactions.hash.defaultTags,
  });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    reactions: {
      ...global.reactions,
      defaultTags: result.reactions,
      hash: {
        ...global.reactions.hash,
        defaultTags: result.hash,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('loadSavedReactionTags', async (global): Promise<void> => {
  const { hash } = global.savedReactionTags || {};

  const result = await callApi('fetchSavedReactionTags', { hash });
  if (!result) {
    return;
  }

  global = getGlobal();

  const tagsByKey = buildCollectionByCallback(result.tags, (tag) => ([getReactionKey(tag.reaction), tag]));

  global = {
    ...global,
    savedReactionTags: {
      hash: result.hash,
      byKey: tagsByKey,
    },
  };
  setGlobal(global);
});

addActionHandler('editSavedReactionTag', async (global, actions, payload): Promise<void> => {
  const { reaction, title } = payload;

  const result = await callApi('updateSavedReactionTag', { reaction, title });

  if (!result) {
    return;
  }

  global = getGlobal();
  const tagsByKey = global.savedReactionTags?.byKey;
  if (!tagsByKey) return;

  const key = getReactionKey(reaction);
  const tag = tagsByKey[key];

  const newTag = {
    ...tag,
    title,
  };

  global = {
    ...global,
    savedReactionTags: {
      ...global.savedReactionTags!,
      byKey: {
        ...tagsByKey,
        [key]: newTag,
      },
    },
  };
  setGlobal(global);
});
