import { addReducer, getDispatch } from '../../../lib/teact/teactn';

import { ApiChat } from '../../../api/types';

import { RE_TME_INVITE_LINK, RE_TME_LINK } from '../../../config';
import { callApi } from '../../../api/gramjs';
import { selectChatMessage, selectCurrentChat } from '../../selectors';

addReducer('clickInlineButton', (global, actions, payload) => {
  const { button } = payload;

  switch (button.type) {
    case 'command':
      actions.sendBotCommand({ command: button.value });
      break;
    case 'url':
      if (button.value.match(RE_TME_INVITE_LINK) || button.value.match(RE_TME_LINK)) {
        actions.openTelegramLink({ url: button.value });
      } else {
        actions.toggleSafeLinkModal({ url: button.value });
      }
      break;
    case 'callback': {
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }

      void answerCallbackButton(chat, button.messageId, button.value);
      break;
    }
    case 'requestPoll':
      actions.openPollModal();
      break;
    case 'buy': {
      const chat = selectCurrentChat(global);
      const { messageId, value } = button;
      if (!chat) {
        return;
      }

      if (value) {
        actions.getReceipt({ receiptMessageId: value, chatId: chat.id, messageId });
      } else {
        actions.getPaymentForm({ messageId });
        actions.setInvoiceMessageInfo(selectChatMessage(global, chat.id, messageId));
        actions.openPaymentModal({ messageId });
      }
      break;
    }
  }
});

addReducer('sendBotCommand', (global, actions, payload) => {
  const { command } = payload;
  const { currentUserId } = global;
  const chat = selectCurrentChat(global);
  if (!currentUserId || !chat) {
    return;
  }

  void sendBotCommand(chat, currentUserId, command);
});

async function sendBotCommand(chat: ApiChat, currentUserId: number, command: string) {
  await callApi('sendMessage', {
    chat,
    text: command,
  });
}

async function answerCallbackButton(chat: ApiChat, messageId: number, data: string) {
  const result = await callApi('answerCallbackButton', {
    chatId: chat.id,
    accessHash: chat.accessHash,
    messageId,
    data,
  });

  if (!result || !result.message) {
    return;
  }

  const { message, alert: isError } = result;

  if (isError) {
    getDispatch().showError({ error: { message } });
  } else {
    getDispatch().showNotification({ message });
  }
}
