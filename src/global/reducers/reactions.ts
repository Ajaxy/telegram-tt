import type { GlobalState } from '../types';
import {
  type ApiMessage, type ApiReactions, type ApiReactionWithPaid,
} from '../../api/types';

import { MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import { getServerTime } from '../../util/serverTime';
import windowSize from '../../util/windowSize';
import {
  MIN_LEFT_COLUMN_WIDTH,
  SIDE_COLUMN_MAX_WIDTH,
} from '../../components/middle/helpers/calculateMiddleFooterTransforms';
import { getReactionKey, updateReactionCount } from '../helpers';
import { selectIsChatWithSelf, selectSendAs, selectTabState } from '../selectors';
import { updateChatMessage } from './messages';
import { addUnreadCount, removeUnreadCount } from './unreadCounters';

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

const REACTION_POLLING_PAUSE_SECONDS = 30;

export function pauseReactionPolling<T extends GlobalState>(global: T, chatId: string): T {
  return {
    ...global,
    reactionPollingPause: { until: getServerTime() + REACTION_POLLING_PAUSE_SECONDS, chatId },
  };
}

export function removePeerReactions(message: ApiMessage, peerId: string): Partial<ApiMessage> | undefined {
  const { reactions, reactors } = message;

  const peerEmojiKeys = new Set<string>();
  reactions?.recentReactions?.forEach((r) => {
    if (r.peerId === peerId) peerEmojiKeys.add(getReactionKey(r.reaction));
  });
  reactors?.reactions.forEach((r) => {
    if (r.peerId === peerId) peerEmojiKeys.add(getReactionKey(r.reaction));
  });
  const wasInTopReactors = Boolean(reactions?.topReactors?.some((r) => r.peerId === peerId));
  const wasInReactorsList = Boolean(reactors?.reactions.some((r) => r.peerId === peerId));

  if (!peerEmojiKeys.size && !wasInTopReactors && !wasInReactorsList) {
    return undefined;
  }

  const update: Partial<ApiMessage> = {};

  if (reactions) {
    const newRecent = reactions.recentReactions?.filter((r) => r.peerId !== peerId);
    const newTopReactors = reactions.topReactors?.filter((r) => r.peerId !== peerId);
    const newResults = reactions.results
      .map((rc) => (peerEmojiKeys.has(getReactionKey(rc.reaction))
        ? { ...rc, count: Math.max(0, rc.count - 1) }
        : rc))
      .filter((rc) => rc.count > 0);

    let newReactions: ApiReactions | undefined;
    if (newResults.length) {
      newReactions = { ...reactions, results: newResults };
      if (newRecent !== undefined) newReactions.recentReactions = newRecent;
      if (newTopReactors !== undefined) newReactions.topReactors = newTopReactors;
    }
    update.reactions = newReactions;
  }

  if (reactors && wasInReactorsList) {
    const newReactorEntries = reactors.reactions.filter((r) => r.peerId !== peerId);
    const removedReactorCount = reactors.reactions.length - newReactorEntries.length;
    update.reactors = {
      ...reactors,
      reactions: newReactorEntries,
      count: Math.max(0, reactors.count - removedReactorCount),
    };
  }

  return update;
}

export function addUnreadReactions<T extends GlobalState>({
  global, chatId, ids, totalCount,
}: {
  global: T;
  chatId: string;
  ids: number[];
  totalCount?: number;
}): T {
  return addUnreadCount({
    global,
    chatId,
    messageIds: ids,
    totalCount,
    unreadCountKey: 'unreadReactionsCount',
  });
}

export function removeUnreadReactions<T extends GlobalState>({
  global, chatId, ids,
}: {
  global: T;
  chatId: string;
  ids: number[];
}): T {
  return removeUnreadCount({
    global,
    chatId,
    messageIds: ids,
    unreadCountKey: 'unreadReactionsCount',
  });
}
