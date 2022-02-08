import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';
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

addReducer('loadAvailableReactions', () => {
  (async () => {
    const result = await callApi('getAvailableReactions');

    if (!result) {
      return;
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

    setGlobal({
      ...getGlobal(),
      availableReactions: result,
    });
  })();
});

addReducer('interactWithAnimatedEmoji', (global, actions, payload) => {
  const {
    emoji, x, y, localEffect, startSize, isReversed,
  } = payload!;

  return {
    ...global,
    activeEmojiInteraction: {
      animatedEffect: emoji || localEffect,
      x: subtractXForEmojiInteraction(global, x),
      y,
      startSize,
      isReversed,
    },
  };
});

addReducer('sendEmojiInteraction', (global, actions, payload) => {
  const {
    messageId, chatId, emoji, interactions, localEffect,
    x, y, startX, startY, startSize,
  } = payload!;

  const chat = selectChat(global, chatId);

  if (!chat || (!emoji && !localEffect) || chatId === global.currentUserId) {
    return undefined;
  }

  void callApi('sendEmojiInteraction', {
    chat,
    messageId,
    emoticon: emoji || selectLocalAnimatedEmojiEffectByName(localEffect),
    timestamps: interactions,
  });

  if (!global.activeEmojiInteraction) return undefined;

  return {
    ...global,
    activeEmojiInteraction: {
      ...global.activeEmojiInteraction,
      endX: subtractXForEmojiInteraction(global, x),
      endY: y,
      ...(startX && { x: subtractXForEmojiInteraction(global, startX) }),
      ...(startY && { y: startY }),
      ...(startSize && { startSize }),
    },
  };
});

addReducer('sendDefaultReaction', (global, actions, payload) => {
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

addReducer('sendReaction', (global, actions, payload) => {
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

addReducer('openChat', (global) => {
  return {
    ...global,
    activeReactions: {},
  };
});

addReducer('stopActiveReaction', (global, actions, payload) => {
  const { messageId, reaction } = payload;

  if (global.activeReactions[messageId]?.reaction !== reaction) {
    return global;
  }

  return {
    ...global,
    activeReactions: omit(global.activeReactions, [messageId]),
  };
});

addReducer('setDefaultReaction', (global, actions, payload) => {
  const { reaction } = payload;

  (async () => {
    const result = await callApi('setDefaultReaction', { reaction });

    if (!result) {
      return;
    }

    global = getGlobal();
    setGlobal({
      ...global,
      appConfig: {
        ...global.appConfig,
        defaultReaction: reaction,
      } as ApiAppConfig,
    });
  })();
});

addReducer('stopActiveEmojiInteraction', (global) => {
  return {
    ...global,
    activeEmojiInteraction: undefined,
  };
});

addReducer('loadReactors', (global, actions, payload) => {
  const { chatId, messageId, reaction } = payload;
  const chat = selectChat(global, chatId);
  const message = selectChatMessage(global, chatId, messageId);
  if (!chat || !message) {
    return;
  }

  const offset = message.reactors?.nextOffset;

  (async () => {
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
    if (result.users?.length) {
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    }

    const { nextOffset, count, reactions } = result;

    setGlobal(updateChatMessage(global, chatId, messageId, {
      reactors: {
        nextOffset,
        count,
        reactions: [
          ...(message.reactors?.reactions || []),
          ...reactions,
        ],
      },
    }));
  })();
});

addReducer('loadMessageReactions', (global, actions, payload) => {
  const { ids, chatId } = payload;

  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  callApi('fetchMessageReactions', { ids, chat });
});

addReducer('sendWatchingEmojiInteraction', (global, actions, payload) => {
  const {
    chatId, emoticon, x, y, startSize, isReversed,
  } = payload;

  const chat = selectChat(global, chatId);

  if (!chat || !global.activeEmojiInteraction || chatId === global.currentUserId) {
    return undefined;
  }

  callApi('sendWatchingEmojiInteraction', { chat, emoticon });

  return {
    ...global,
    activeEmojiInteraction: {
      ...global.activeEmojiInteraction,
      x: subtractXForEmojiInteraction(global, x),
      y,
      startSize,
      isReversed,
    },
  };
});
