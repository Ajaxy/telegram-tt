import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { AudioOrigin, MediaViewerOrigin } from '../../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { omit } from '../../../util/iteratees';
import { getTimestampableMedia } from '../../helpers';
import { getMessageReplyInfo } from '../../helpers/replies';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectChatMessage, selectReplyMessage, selectTabState } from '../../selectors';

addActionHandler('openMediaViewer', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId = MAIN_THREAD_ID, messageId, timestamp, mediaIndex, isAvatarView, isSponsoredMessage, origin,
    withDynamicLoading, standaloneMedia, tabId = getCurrentTabId(),
  } = payload;

  const tabState = selectTabState(global, tabId);

  return updateTabState(global, {
    mediaViewer: {
      ...tabState.mediaViewer,
      chatId,
      threadId,
      messageId,
      mediaIndex: mediaIndex || 0,
      isAvatarView,
      isSponsoredMessage,
      origin,
      standaloneMedia,
      isHidden: false,
      withDynamicLoading,
      timestamp,
    },
    forwardMessages: {},
    isShareMessageModalShown: false,
  }, tabId);
});

addActionHandler('closeMediaViewer', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const {
    volume, isMuted, playbackRate, isHidden,
  } = selectTabState(global, tabId).mediaViewer;

  return updateTabState(global, {
    mediaViewer: {
      volume,
      isMuted,
      isHidden,
      playbackRate,
    },
  }, tabId);
});

addActionHandler('openMediaFromTimestamp', (global, actions, payload): ActionReturnType => {
  const {
    chatId, messageId, threadId, timestamp, tabId = getCurrentTabId(),
  } = payload;

  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return;

  const replyInfo = getMessageReplyInfo(message);
  const replyMessage = selectReplyMessage(global, message);

  const messageMedia = getTimestampableMedia(message);
  const maxMessageDuration = messageMedia?.duration;
  if (maxMessageDuration) {
    if (maxMessageDuration <= timestamp) return;

    if (messageMedia.mediaType === 'video') {
      actions.openMediaViewer({
        chatId,
        messageId,
        threadId,
        origin: MediaViewerOrigin.Inline,
        timestamp,
        tabId,
      });
      return;
    }

    actions.openAudioPlayer({
      chatId,
      messageId,
      threadId,
      origin: AudioOrigin.Inline,
      timestamp,
      tabId,
    });
    return;
  }

  const replyMessageMedia = replyMessage ? getTimestampableMedia(replyMessage) : undefined;
  const maxReplyMessageDuration = replyMessageMedia?.duration;
  if (!maxReplyMessageDuration || maxReplyMessageDuration <= timestamp) return;

  if (replyMessageMedia.mediaType === 'video') {
    actions.openMediaViewer({
      chatId: replyMessage!.chatId,
      messageId: replyMessage!.id,
      threadId: replyInfo?.replyToTopId,
      origin: MediaViewerOrigin.Inline,
      timestamp,
      tabId,
    });
    return;
  }

  actions.openAudioPlayer({
    chatId: replyMessage!.chatId,
    messageId: replyMessage!.id,
    threadId: replyInfo?.replyToTopId,
    origin: AudioOrigin.Inline,
    timestamp,
    tabId,
  });
});

addActionHandler('updateLastPlaybackTimestamp', (global, actions, payload): ActionReturnType => {
  const { chatId, messageId, timestamp } = payload;

  const currentChatPlaybacks = global.messages.playbackByChatId[chatId]?.byId || {};

  if (!timestamp) {
    return {
      ...global,
      messages: {
        ...global.messages,
        playbackByChatId: {
          ...global.messages.playbackByChatId,
          [chatId]: {
            byId: omit(currentChatPlaybacks, [messageId]),
          },
        },
      },
    };
  }

  return {
    ...global,
    messages: {
      ...global.messages,
      playbackByChatId: {
        ...global.messages.playbackByChatId,
        [chatId]: {
          byId: {
            ...currentChatPlaybacks,
            [messageId]: timestamp,
          },
        },
      },
    },
  };
});

addActionHandler('setMediaViewerVolume', (global, actions, payload): ActionReturnType => {
  const {
    volume,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    mediaViewer: {
      ...selectTabState(global, tabId).mediaViewer,
      volume,
      isMuted: false,
    },
  }, tabId);
});

addActionHandler('setMediaViewerPlaybackRate', (global, actions, payload): ActionReturnType => {
  const {
    playbackRate,
    tabId = getCurrentTabId(),
  } = payload;

  global = {
    ...global,
    mediaViewer: {
      ...global.mediaViewer,
      lastPlaybackRate: playbackRate,
    },
  };

  return updateTabState(global, {
    mediaViewer: {
      ...selectTabState(global, tabId).mediaViewer,
      playbackRate,
    },
  }, tabId);
});

addActionHandler('setMediaViewerMuted', (global, actions, payload): ActionReturnType => {
  const {
    isMuted,
    tabId = getCurrentTabId(),
  } = payload;

  return updateTabState(global, {
    mediaViewer: {
      ...selectTabState(global, tabId).mediaViewer,
      isMuted,
    },
  }, tabId);
});

addActionHandler('setMediaViewerHidden', (global, actions, payload): ActionReturnType => {
  const { isHidden, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    mediaViewer: {
      ...selectTabState(global, tabId).mediaViewer,
      isHidden,
    },
  }, tabId);
});
