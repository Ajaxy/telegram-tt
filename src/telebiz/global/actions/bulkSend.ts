import { addActionHandler, getGlobal, setGlobal } from '../../../global';

import type { ForwardMessagesParams } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { selectChat, selectChatLastMessageId, selectChatMessages } from '../../../global/selectors';
import { selectIsCurrentUserPremium } from '../../../global/selectors/users';
import { pause } from '../../../util/schedulers';
import { callApi } from '../../../api/gramjs';
import {
  cancelTelebizBulkSend,
  resetTelebizBulkSend,
  setTelebizBulkSendCurrentIndex,
  startTelebizBulkSend,
  updateTelebizBulkSendTarget,
} from '../reducers/bulkSend';

let isCancelled = false;

addActionHandler('startTelebizBulkSend', async (global, actions, payload): Promise<void> => {
  const {
    sourceChatId, messageIds, targetChatIds, delayMs,
  } = payload;

  isCancelled = false;

  global = getGlobal();
  global = startTelebizBulkSend(global, sourceChatId, messageIds, targetChatIds, delayMs);
  setGlobal(global);

  const sourceChat = selectChat(global, sourceChatId);
  if (!sourceChat) return;

  const messages = selectChatMessages(global, sourceChatId);
  if (!messages) return;

  const messagesToForward = messageIds
    .map((id) => messages[id])
    .filter(Boolean);

  if (messagesToForward.length === 0) return;

  const isCurrentUserPremium = selectIsCurrentUserPremium(global);

  for (let i = 0; i < targetChatIds.length; i++) {
    if (isCancelled) break;

    const targetChatId = targetChatIds[i];

    global = getGlobal();
    global = setTelebizBulkSendCurrentIndex(global, i);
    global = updateTelebizBulkSendTarget(global, targetChatId, 'sending');
    setGlobal(global);

    global = getGlobal();
    const targetChat = selectChat(global, targetChatId);

    if (!targetChat) {
      global = getGlobal();
      global = updateTelebizBulkSendTarget(global, targetChatId, 'failed', 'Chat not found');
      setGlobal(global);
      continue;
    }

    try {
      const lastMessageId = selectChatLastMessageId(global, targetChatId);

      const forwardParams: ForwardMessagesParams = {
        fromChat: sourceChat,
        toChat: targetChat,
        toThreadId: MAIN_THREAD_ID,
        messages: messagesToForward,
        noAuthors: true,
        noCaptions: false,
        isCurrentUserPremium,
        lastMessageId,
      };

      await callApi('forwardMessages', forwardParams);

      global = getGlobal();
      global = updateTelebizBulkSendTarget(global, targetChatId, 'sent');
      setGlobal(global);
    } catch (error) {
      global = getGlobal();
      const errorMessage = error instanceof Error ? error.message : 'Failed to send';
      global = updateTelebizBulkSendTarget(global, targetChatId, 'failed', errorMessage);
      setGlobal(global);
    }

    // Add delay between messages (except for the last one)
    if (!isCancelled && i < targetChatIds.length - 1) {
      await pause(delayMs);
    }
  }

  // Mark as completed (keep data for showing completion status)
  global = getGlobal();
  global = cancelTelebizBulkSend(global);
  setGlobal(global);
});

addActionHandler('cancelTelebizBulkSend', (global): void => {
  isCancelled = true;
  global = cancelTelebizBulkSend(global);
  setGlobal(global);
});

addActionHandler('resetTelebizBulkSend', (global): void => {
  isCancelled = false;
  global = resetTelebizBulkSend(global);
  setGlobal(global);
});
