import type { GlobalState } from '../types';
import { type ApiMessage, type ApiReactionWithPaid } from '../../api/types';

import { MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import { unique } from '../../util/iteratees';
import windowSize from '../../util/windowSize';
import {
  MIN_LEFT_COLUMN_WIDTH,
  SIDE_COLUMN_MAX_WIDTH,
} from '../../components/middle/helpers/calculateMiddleFooterTransforms';
import { groupMessageIdsByThreadId, updateReactionCount } from '../helpers';
import { selectIsChatWithSelf, selectSendAs, selectTabState } from '../selectors';
import { selectThreadReadState } from '../selectors/threads';
import { updateChatMessage } from './messages';
import { replaceThreadReadStateParam } from './threads';

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
  global: T, message: ApiMessage, userReactions: ApiReactionWithPaid[],
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
    if (reaction.type === 'paid') return;
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

export function addUnreadReactions<T extends GlobalState>({
  global, chatId, ids, totalCount,
}: {
  global: T;
  chatId: string;
  ids: number[];
  totalCount?: number;
}): T {
  const messageIdsByThreadId = groupMessageIdsByThreadId(global, chatId, ids, false);

  for (const threadId in messageIdsByThreadId) {
    const messageIds = messageIdsByThreadId[threadId];
    if (totalCount !== undefined) { // Assume that when `totalCount` is passed, server returned full id list
      global = replaceThreadReadStateParam(global, chatId, threadId, 'unreadReactions', messageIds);
      global = replaceThreadReadStateParam(global, chatId, threadId, 'unreadReactionsCount', totalCount);
      continue;
    }

    const readState = selectThreadReadState(global, chatId, threadId);
    const prevChatUnreadReactions = readState?.unreadReactions || [];
    const updatedUnreadReactions = unique([...prevChatUnreadReactions, ...messageIds]).sort((a, b) => b - a);
    global = replaceThreadReadStateParam(global, chatId, threadId, 'unreadReactions', updatedUnreadReactions);

    const delta = updatedUnreadReactions.length - prevChatUnreadReactions.length;
    if (delta > 0) {
      const unreadReactionsCount = (readState?.unreadReactionsCount || 0) + delta;
      global = replaceThreadReadStateParam(global, chatId, threadId, 'unreadReactionsCount', unreadReactionsCount);
    }
  }

  return global;
}

export function removeUnreadReactions<T extends GlobalState>({
  global, chatId, ids,
}: {
  global: T;
  chatId: string;
  ids: number[];
}): T {
  const messageIdsByThreadId = groupMessageIdsByThreadId(global, chatId, ids, false);

  for (const threadId in messageIdsByThreadId) {
    const messageIds = messageIdsByThreadId[threadId];
    const readState = selectThreadReadState(global, chatId, threadId);
    const prevChatUnreadReactions = readState?.unreadReactions || [];
    const updatedUnreadReactions = prevChatUnreadReactions.filter((id) => !messageIds.includes(id));
    global = replaceThreadReadStateParam(global, chatId, threadId, 'unreadReactions', updatedUnreadReactions);

    const delta = prevChatUnreadReactions.length - updatedUnreadReactions.length;
    if (delta > 0 && readState?.unreadReactionsCount) {
      const unreadReactionsCount = Math.max(readState.unreadReactionsCount - delta, 0);
      global = replaceThreadReadStateParam(global, chatId, threadId, 'unreadReactionsCount', unreadReactionsCount);
    }
  }
  return global;
}
