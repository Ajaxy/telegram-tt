import type { GlobalState } from '../types';
import type { ApiChat, ApiMessage, ApiReaction } from '../../api/types';

import { MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import {
  MIN_LEFT_COLUMN_WIDTH,
  SIDE_COLUMN_MAX_WIDTH,
} from '../../components/middle/helpers/calculateMiddleFooterTransforms';
import windowSize from '../../util/windowSize';
import { updateChat } from './chats';
import { isSameReaction, isReactionChosen } from '../helpers';
import { updateChatMessage } from './messages';
import { getIsMobile } from '../../hooks/useAppLayout';

function getLeftColumnWidth(windowWidth: number) {
  if (windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN) {
    return Math.min(
      Math.max(windowWidth * 0.25, MIN_LEFT_COLUMN_WIDTH),
      windowWidth * 0.33,
    );
  }

  if (windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN) {
    return Math.min(
      Math.max(windowWidth * 0.33, MIN_LEFT_COLUMN_WIDTH),
      windowWidth * 0.4,
    );
  }

  return SIDE_COLUMN_MAX_WIDTH;
}

export function subtractXForEmojiInteraction(global: GlobalState, x: number) {
  return x - ((global.isLeftColumnShown && !getIsMobile())
    ? global.leftColumnWidth || getLeftColumnWidth(windowSize.get().width)
    : 0);
}

export function addMessageReaction(
  global: GlobalState, message: ApiMessage, userReactions: ApiReaction[],
) {
  const currentReactions = message.reactions || { results: [] };

  // Update UI without waiting for server response
  const results = currentReactions.results.map((current) => (
    isReactionChosen(current) ? {
      ...current,
      chosenOrder: undefined,
      count: current.count - 1,
    } : current
  )).filter(({ count }) => count > 0);

  userReactions.forEach((reaction, i) => {
    const existingIndex = results.findIndex((r) => isSameReaction(r.reaction, reaction));
    if (existingIndex > -1) {
      results[existingIndex] = {
        ...results[existingIndex],
        chosenOrder: i,
        count: results[existingIndex].count + 1,
      };
    } else {
      results.push({
        reaction,
        chosenOrder: i,
        count: 1,
      });
    }
  });

  let { recentReactions = [] } = currentReactions;

  if (recentReactions.length) {
    recentReactions = recentReactions.filter(({ userId }) => userId !== global.currentUserId);
  }

  userReactions.forEach((reaction) => {
    const { currentUserId } = global;
    recentReactions.unshift({
      userId: currentUserId!,
      reaction,
    });
  });

  return updateChatMessage(global, message.chatId, message.id, {
    reactions: {
      ...currentReactions,
      results,
      recentReactions,
    },
  });
}

export function updateUnreadReactions(
  global: GlobalState, chatId: string, update: Pick<ApiChat, 'unreadReactionsCount' | 'unreadReactions'>,
) {
  return updateChat(global, chatId, update, undefined, true);
}
