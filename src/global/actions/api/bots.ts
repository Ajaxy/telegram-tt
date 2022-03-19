import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';

import { ApiChat, ApiContact, ApiUser } from '../../../api/types';
import { InlineBotSettings } from '../../../types';

import {
  RE_TG_LINK, RE_TME_LINK,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  selectChat, selectChatBot, selectChatMessage, selectCurrentChat, selectCurrentMessageList,
  selectReplyingToId, selectSendAs, selectUser,
} from '../../selectors';
import { addChats, addUsers, removeBlockedContact } from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { debounce } from '../../../util/schedulers';
import { replaceInlineBotSettings, replaceInlineBotsIsLoading } from '../../reducers/bots';
import { getServerTime } from '../../../util/serverTime';

const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runDebouncedForSearch = debounce((cb) => cb(), 500, false);

addActionHandler('clickInlineButton', (global, actions, payload) => {
  const { button } = payload;

  switch (button.type) {
    case 'command':
      actions.sendBotCommand({ command: button.value });
      break;
    case 'url':
      if (button.value.match(RE_TME_LINK) || button.value.match(RE_TG_LINK)) {
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
    case 'requestSelfContact': {
      const user = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
      if (!user) {
        return;
      }
      actions.showDialog({
        data: {
          phoneNumber: user.phoneNumber,
          firstName: user.firstName,
          lastName: user.lastName,
          userId: user.id,
        } as ApiContact,
      });
      break;
    }
    case 'buy': {
      const chat = selectCurrentChat(global);
      const { messageId, value } = button;
      if (!chat) {
        return;
      }

      if (value) {
        actions.getReceipt({ receiptMessageId: value, chatId: chat.id, messageId });
      } else {
        actions.getPaymentForm({ chat, messageId });
        actions.setInvoiceMessageInfo(selectChatMessage(global, chat.id, messageId));
        actions.openPaymentModal({ chatId: chat.id, messageId });
      }
      break;
    }
  }
});

addActionHandler('sendBotCommand', (global, actions, payload) => {
  const { command, chatId } = payload;
  const { currentUserId } = global;
  const chat = chatId ? selectChat(global, chatId) : selectCurrentChat(global);
  const currentMessageList = selectCurrentMessageList(global);

  if (!currentUserId || !chat || !currentMessageList) {
    return;
  }

  const { threadId } = currentMessageList;
  actions.setReplyingToId({ messageId: undefined });
  actions.clearWebPagePreview({ chatId: chat.id, threadId, value: false });

  void sendBotCommand(
    chat, currentUserId, command, selectReplyingToId(global, chat.id, threadId), selectSendAs(global, chatId),
  );
});

addActionHandler('restartBot', async (global, actions, payload) => {
  const { chatId } = payload;
  const { currentUserId } = global;
  const chat = selectCurrentChat(global);
  const bot = currentUserId && selectChatBot(global, chatId);
  if (!currentUserId || !chat || !bot) {
    return;
  }

  const result = await callApi('unblockContact', bot.id, bot.accessHash);
  if (!result) {
    return;
  }

  setGlobal(removeBlockedContact(getGlobal(), bot.id));
  void sendBotCommand(chat, currentUserId, '/start', undefined, selectSendAs(global, chatId));
});

addActionHandler('loadTopInlineBots', async (global) => {
  const { lastRequestedAt } = global.topInlineBots;
  if (lastRequestedAt && getServerTime(global.serverTimeOffset) - lastRequestedAt < TOP_PEERS_REQUEST_COOLDOWN) {
    return undefined;
  }

  const result = await callApi('fetchTopInlineBots');
  if (!result) {
    return undefined;
  }

  const { ids, users } = result;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = {
    ...global,
    topInlineBots: {
      ...global.topInlineBots,
      userIds: ids,
      lastRequestedAt: getServerTime(global.serverTimeOffset),
    },
  };
  return global;
});

addActionHandler('queryInlineBot', async (global, actions, payload) => {
  const {
    chatId, username, query, offset,
  } = payload;

  let inlineBotData = global.inlineBots.byUsername[username];
  if (inlineBotData === false) {
    return;
  }

  if (inlineBotData === undefined) {
    const { user: inlineBot, chat } = await callApi('fetchInlineBot', { username }) || {};
    global = getGlobal();
    if (!inlineBot || !chat) {
      setGlobal(replaceInlineBotSettings(global, username, false));
      return;
    }

    global = addUsers(global, { [inlineBot.id]: inlineBot });
    global = addChats(global, { [chat.id]: chat });
    inlineBotData = {
      id: inlineBot.id,
      query: '',
      offset: '',
      switchPm: undefined,
      canLoadMore: true,
      results: [],
    };

    global = replaceInlineBotSettings(global, username, inlineBotData);
    setGlobal(global);
  }

  if (query === inlineBotData.query && !inlineBotData.canLoadMore) {
    return;
  }

  void runDebouncedForSearch(() => {
    searchInlineBot({
      username,
      inlineBotData: inlineBotData as InlineBotSettings,
      chatId,
      query,
      offset,
    });
  });
});

addActionHandler('sendInlineBotResult', (global, actions, payload) => {
  const { id, queryId } = payload;
  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList || !id) {
    return;
  }

  const { chatId, threadId } = currentMessageList;

  const chat = selectChat(global, chatId)!;

  actions.setReplyingToId({ messageId: undefined });
  actions.clearWebPagePreview({ chatId, threadId, value: false });

  void callApi('sendInlineBotResult', {
    chat,
    resultId: id,
    queryId,
    replyingTo: selectReplyingToId(global, chatId, threadId),
    sendAs: selectSendAs(global, chatId),
  });
});

addActionHandler('resetInlineBot', (global, actions, payload) => {
  const { username } = payload;

  let inlineBotData = global.inlineBots.byUsername[username];

  if (!inlineBotData) {
    return;
  }

  inlineBotData = {
    id: inlineBotData.id,
    query: '',
    offset: '',
    switchPm: undefined,
    canLoadMore: true,
    results: [],
  };

  setGlobal(replaceInlineBotSettings(global, username, inlineBotData));
});

addActionHandler('startBot', async (global, actions, payload) => {
  const { botId, param } = payload;

  const bot = selectUser(global, botId);
  if (!bot) {
    return;
  }

  await callApi('startBot', {
    bot,
    startParam: param,
  });
});

async function searchInlineBot({
  username,
  inlineBotData,
  chatId,
  query,
  offset,
}: {
  username: string;
  inlineBotData: InlineBotSettings;
  chatId: string;
  query: string;
  offset?: string;
}) {
  let global = getGlobal();
  const bot = selectUser(global, inlineBotData.id);
  const chat = selectChat(global, chatId);
  if (!bot || !chat) {
    return;
  }

  const shouldReplaceSettings = inlineBotData.query !== query;
  global = replaceInlineBotsIsLoading(global, true);
  global = replaceInlineBotSettings(global, username, {
    ...inlineBotData,
    query,
    ...(shouldReplaceSettings && { offset: undefined, results: [] }),
  });
  setGlobal(global);

  const result = await callApi('fetchInlineBotResults', {
    bot,
    chat,
    query,
    offset: shouldReplaceSettings ? undefined : offset,
  });

  const newInlineBotData = global.inlineBots.byUsername[username];
  global = replaceInlineBotsIsLoading(getGlobal(), false);
  if (!result || !newInlineBotData || query !== newInlineBotData.query) {
    setGlobal(global);
    return;
  }

  const currentIds = new Set((newInlineBotData.results || []).map((data) => data.id));
  const newResults = result.results.filter((data) => !currentIds.has(data.id));

  global = replaceInlineBotSettings(global, username, {
    ...newInlineBotData,
    help: result.help,
    ...(newResults.length && { isGallery: result.isGallery }),
    ...(result.switchPm && { switchPm: result.switchPm }),
    canLoadMore: result.results.length > 0 && Boolean(result.nextOffset),
    results: newInlineBotData.offset === '' || newInlineBotData.offset === result.nextOffset
      ? result.results
      : (newInlineBotData.results || []).concat(newResults),
    offset: newResults.length ? result.nextOffset : '',
  });

  setGlobal(global);
}

async function sendBotCommand(
  chat: ApiChat, currentUserId: string, command: string, replyingTo?: number, sendAs?: ApiChat | ApiUser,
) {
  await callApi('sendMessage', {
    chat,
    text: command,
    replyingTo,
    sendAs,
  });
}

async function answerCallbackButton(chat: ApiChat, messageId: number, data: string) {
  const result = await callApi('answerCallbackButton', {
    chatId: chat.id,
    accessHash: chat.accessHash,
    messageId,
    data,
  });

  if (!result) {
    return;
  }

  const { showDialog, showNotification, toggleSafeLinkModal } = getActions();
  const { message, alert: isError, url } = result;

  if (isError) {
    showDialog({ data: { message: message || 'Error' } });
  } else if (message) {
    showNotification({ message });
  } else if (url) {
    toggleSafeLinkModal({ url });
  }
}
