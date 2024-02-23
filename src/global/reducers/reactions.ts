import type { ApiChat, ApiMessage, ApiReaction } from '../../api/types';
import type { GlobalState } from '../types';

import { MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import windowSize from '../../util/windowSize';
import {
  MIN_LEFT_COLUMN_WIDTH,
  SIDE_COLUMN_MAX_WIDTH,
} from '../../components/middle/helpers/calculateMiddleFooterTransforms';
import { updateReactionCount } from '../helpers';
import { selectIsChatWithSelf, selectSendAs, selectTabState } from '../selectors';
import { updateChat } from './chats';
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
  const tabState = selectTabState(global);
  return x - ((tabState.isLeftColumnShown && !getIsMobile())
    ? global.leftColumnWidth || getLeftColumnWidth(windowSize.get().width)
    : 0);
}

export function addMessageReaction<T extends GlobalState>(
  global: T, message: ApiMessage, userReactions: ApiReaction[],
): T {
  const isInSavedMessages = selectIsChatWithSelf(global, message.chatId);
  const currentReactions = message.reactions || { results: [], areTags: isInSavedMessages };
  const currentSendAs = selectSendAs(global, message.chatId);

  // Update UI without waiting for server response
  const results = updateReactionCount(currentReactions.results, userReactions);

  let { recentReactions = [] } = currentReactions;

  if (recentReactions.length) {
    recentReactions = recentReactions.filter(({ isOwn, peerId }) => !isOwn && peerId !== global.currentUserId);
  }

  userReactions.forEach((reaction) => {
    const { currentUserId } = global;
    recentReactions.unshift({
      peerId: currentSendAs?.id || currentUserId!,
      reaction,
      addedDate: Math.floor(Date.now() / 1000),
      isOwn: true,
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

export function updateUnreadReactions<T extends GlobalState>(
  global: T, chatId: string, update: Pick<ApiChat, 'unreadReactionsCount' | 'unreadReactions'>,
): T {
  return updateChat(global, chatId, update, undefined, true);
}
