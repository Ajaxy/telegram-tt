import { updateChatMessage } from './messages';
import type { GlobalState } from '../types';
import { selectChatMessage } from '../selectors';
import { MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import {
  MIN_LEFT_COLUMN_WIDTH,
  SIDE_COLUMN_MAX_WIDTH,
} from '../../components/middle/helpers/calculateMiddleFooterTransforms';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import windowSize from '../../util/windowSize';
import { updateChat } from './chats';
import type { ApiChat } from '../../api/types';

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
  return x - ((global.isLeftColumnShown && !IS_SINGLE_COLUMN_LAYOUT)
    ? global.leftColumnWidth || getLeftColumnWidth(windowSize.get().width)
    : 0);
}

export function addMessageReaction(global: GlobalState, chatId: string, messageId: number, reaction: string) {
  const { reactions } = selectChatMessage(global, chatId, messageId) || {};

  if (!reactions) {
    return global;
  }

  // Update UI without waiting for server response
  let results = reactions.results.map((l) => (l.reaction === reaction
    ? {
      ...l,
      count: l.isChosen ? l.count : l.count + 1,
      isChosen: true,
    } : (l.isChosen ? {
      ...l,
      isChosen: false,
      count: l.count - 1,
    } : l)))
    .filter((l) => l.count > 0);

  let { recentReactions } = reactions;

  if (reaction && !results.some((l) => l.reaction === reaction)) {
    const { currentUserId } = global;

    results = [...results, {
      reaction,
      isChosen: true,
      count: 1,
    }];

    if (reactions.canSeeList) {
      recentReactions = [...(recentReactions || []), {
        userId: currentUserId!,
        reaction,
      }];
    }
  }

  return updateChatMessage(global, chatId, messageId, {
    reactions: {
      ...reactions,
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
