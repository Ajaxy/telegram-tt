import { addActionHandler, getGlobal } from '../../index';
import { callApi } from '../../../api/gramjs';
import * as mediaLoader from '../../../util/mediaLoader';
import { ApiAppConfig, ApiMediaFormat } from '../../../api/types';
import {
  selectChat,
  selectChatMessage,
  selectDefaultReaction,
  selectLocalAnimatedEmojiEffectByName,
  selectMessageIdsByGroupId,
} from '../../selectors';
import { addMessageReaction, subtractXForEmojiInteraction } from '../../reducers/reactions';
import { addUsers, updateChatMessage } from '../../reducers';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { ANIMATION_LEVEL_MAX } from '../../../config';
import { isMessageLocal } from '../../helpers';

const INTERACTION_RANDOM_OFFSET = 40;

let interactionLocalId = 0;

addActionHandler('loadAvailableReactions', async () => {
  const result = await callApi('getAvailableReactions');
  if (!result) {
    return undefined;
  }

  // Preload animations
  result.forEach((availableReaction) => {
    if (availableReaction.aroundAnimation) {
      mediaLoader.fetch(`sticker${availableReaction.aroundAnimation.id}`, ApiMediaFormat.Lottie);
    }
    if (availableReaction.centerIcon) {
      mediaLoader.fetch(`sticker${availableReaction.centerIcon.id}`, ApiMediaFormat.Lottie);
    }
  });

  return {
    ...getGlobal(),
    availableReactions: result,
  };
});

addActionHandler('interactWithAnimatedEmoji', (global, actions, payload) => {
  const {
    emoji, x, y, localEffect, startSize, isReversed,
  } = payload!;

  const activeEmojiInteraction = {
    id: interactionLocalId++,
    animatedEffect: emoji || localEffect,
    x: subtractXForEmojiInteraction(global, x) + Math.random()
      * INTERACTION_RANDOM_OFFSET - INTERACTION_RANDOM_OFFSET / 2,
    y: y + Math.random() * INTERACTION_RANDOM_OFFSET - INTERACTION_RANDOM_OFFSET / 2,
    startSize,
    isReversed,
  };

  return {
    ...global,
    activeEmojiInteractions: [...(global.activeEmojiInteractions || []), activeEmojiInteraction],
  };
});

addActionHandler('sendEmojiInteraction', (global, actions, payload) => {
  const {
    messageId, chatId, emoji, interactions, localEffect,
  } = payload!;

  const chat = selectChat(global, chatId);

  if (!chat || (!emoji && !localEffect) || chatId === global.currentUserId) {
    return;
  }

  void callApi('sendEmojiInteraction', {
    chat,
    messageId,
    emoticon: emoji || selectLocalAnimatedEmojiEffectByName(localEffect),
    timestamps: interactions,
  });
});

addActionHandler('sendDefaultReaction', (global, actions, payload) => {
  const {
    chatId, messageId, x, y,
  } = payload;
  const reaction = selectDefaultReaction(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);

  if (!reaction || !message || isMessageLocal(message)) return;

  actions.sendReaction({
    chatId,
    messageId,
    reaction,
    x,
    y,
  });
});

addActionHandler('sendReaction', (global, actions, payload) => {
  const {
    chatId,
  }: { chatId: string } = payload;
  let { messageId } = payload;

  let { reaction } = payload;

  const chat = selectChat(global, chatId);
  let message = selectChatMessage(global, chatId, messageId);

  if (!chat || !message) {
    return undefined;
  }

  const isInDocumentGroup = Boolean(message.groupedId) && !message.isInAlbum;
  const documentGroupFirstMessageId = isInDocumentGroup
    ? selectMessageIdsByGroupId(global, chatId, message.groupedId!)![0]
    : undefined;
  message = isInDocumentGroup
    ? selectChatMessage(global, chatId, documentGroupFirstMessageId!) || message
    : message;
  messageId = message?.id || messageId;

  if (message.reactions?.results?.some((l) => l.reaction === reaction && l.isChosen)) {
    reaction = undefined;
  }

  void callApi('sendReaction', { chat, messageId, reaction });

  const { animationLevel } = global.settings.byKey;

  if (animationLevel === ANIMATION_LEVEL_MAX) {
    global = {
      ...global,
      activeReactions: {
        ...(reaction ? global.activeReactions : omit(global.activeReactions, [messageId])),
        ...(reaction && {
          [messageId]: {
            reaction,
            messageId,
          },
        }),
      },
    };
  }

  return addMessageReaction(global, chatId, messageId, reaction);
});

addActionHandler('openChat', (global) => {
  return {
    ...global,
    activeReactions: {},
  };
});

addActionHandler('startActiveReaction', (global, actions, payload) => {
  const { messageId, reaction } = payload;
  const { animationLevel } = global.settings.byKey;

  if (animationLevel !== ANIMATION_LEVEL_MAX) return global;

  if (global.activeReactions[messageId]?.reaction === reaction) {
    return global;
  }

  return {
    ...global,
    activeReactions: {
      ...(reaction ? global.activeReactions : omit(global.activeReactions, [messageId])),
      ...(reaction && {
        [messageId]: {
          reaction,
          messageId,
        },
      }),
    },
  };
});

addActionHandler('stopActiveReaction', (global, actions, payload) => {
  const { messageId, reaction } = payload;

  if (global.activeReactions[messageId]?.reaction !== reaction) {
    return global;
  }

  return {
    ...global,
    activeReactions: omit(global.activeReactions, [messageId]),
  };
});

addActionHandler('setDefaultReaction', async (global, actions, payload) => {
  const { reaction } = payload;

  const result = await callApi('setDefaultReaction', { reaction });
  if (!result) {
    return undefined;
  }

  return {
    ...getGlobal(),
    appConfig: {
      ...global.appConfig,
      defaultReaction: reaction,
    } as ApiAppConfig,
  };
});

addActionHandler('stopActiveEmojiInteraction', (global, actions, payload) => {
  const { id } = payload;

  return {
    ...global,
    activeEmojiInteractions: global.activeEmojiInteractions?.filter((l) => l.id !== id),
  };
});

addActionHandler('loadReactors', async (global, actions, payload) => {
  const { chatId, messageId, reaction } = payload;
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);
  if (!chat || !message) {
    return undefined;
  }

  const offset = message.reactors?.nextOffset;
  const result = await callApi('fetchMessageReactionsList', {
    reaction,
    chat,
    messageId,
    offset,
  });

  if (!result) {
    return undefined;
  }

  global = getGlobal();

  if (result.users?.length) {
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  }

  const { nextOffset, count, reactions } = result;

  return updateChatMessage(global, chatId, messageId, {
    reactors: {
      nextOffset,
      count,
      reactions: [
        ...(message.reactors?.reactions || []),
        ...reactions,
      ],
    },
  });
});

addActionHandler('loadMessageReactions', (global, actions, payload) => {
  const { ids, chatId } = payload;

  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  callApi('fetchMessageReactions', { ids, chat });
});

addActionHandler('sendWatchingEmojiInteraction', (global, actions, payload) => {
  const {
    chatId, emoticon, x, y, startSize, isReversed, id,
  } = payload;

  const chat = selectChat(global, chatId);

  if (!chat || !global.activeEmojiInteractions?.some((l) => l.id === id) || chatId === global.currentUserId) {
    return undefined;
  }

  callApi('sendWatchingEmojiInteraction', { chat, emoticon });

  return {
    ...global,
    activeEmojiInteractions: global.activeEmojiInteractions.map((activeEmojiInteraction) => {
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
  };
});
