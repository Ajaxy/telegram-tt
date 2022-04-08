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
import PopupManager from '../../../util/PopupManager';

const GAMEE_URL = 'https://prizes.gamee.com/';
const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runDebouncedForSearch = debounce((cb) => cb(), 500, false);

addActionHandler('clickBotInlineButton', (global, actions, payload) => {
  const { messageId, button } = payload;

  switch (button.type) {
    case 'command':
      actions.sendBotCommand({ command: button.text });
      break;
    case 'url': {
      const { url } = button;
      if (url.match(RE_TME_LINK) || url.match(RE_TG_LINK)) {
        actions.openTelegramLink({ url });
      } else {
        actions.toggleSafeLinkModal({ url });
      }
      break;
    }
    case 'callback': {
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }

      void answerCallbackButton(chat, messageId, button.data);
      break;
    }
    case 'requestPoll':
      actions.openPollModal({ isQuiz: button.isQuiz });
      break;
    case 'requestPhone': {
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
    case 'receipt': {
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }
      const { receiptMessageId } = button;
      actions.getReceipt({ receiptMessageId, chatId: chat.id, messageId });
      break;
    }
    case 'buy': {
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }

      actions.getPaymentForm({ chat, messageId });
      actions.setInvoiceMessageInfo(selectChatMessage(global, chat.id, messageId));
      actions.openPaymentModal({ chatId: chat.id, messageId });
      break;
    }
    case 'game': {
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }

      void answerCallbackButton(chat, messageId, undefined, true);
      break;
    }
    case 'switchBotInline': {
      const { query, isSamePeer } = button;
      actions.switchBotInline({ query, isSamePeer, messageId });
      break;
    }

    case 'userProfile': {
      const { userId } = button;
      actions.openChatWithInfo({ id: userId });
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

addActionHandler('switchBotInline', (global, actions, payload) => {
  const { query, isSamePeer, messageId } = payload;
  const chat = selectCurrentChat(global);
  if (!chat) {
    return undefined;
  }
  const message = selectChatMessage(global, chat.id, messageId);
  if (!message) {
    return undefined;
  }

  const botSender = selectChatBot(global, message.senderId!);
  if (!botSender) {
    return undefined;
  }

  const text = `@${botSender.username} ${query}`;

  if (isSamePeer) {
    actions.openChatWithText({ chatId: chat.id, text });
    return undefined;
  }

  return {
    ...global,
    switchBotInline: {
      query,
      botUsername: botSender.username,
    },
  };
});

addActionHandler('resetSwitchBotInline', (global) => {
  return {
    ...global,
    switchBotInline: undefined,
  };
});

addActionHandler('sendInlineBotResult', (global, actions, payload) => {
  const {
    id, queryId, isSilent, scheduledAt,
  } = payload;
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
    isSilent,
    scheduleDate: scheduledAt,
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

let gameePopups: PopupManager | undefined;

async function answerCallbackButton(chat: ApiChat, messageId: number, data?: string, isGame = false) {
  const {
    showDialog, showNotification, toggleSafeLinkModal, openGame,
  } = getActions();

  if (isGame) {
    if (!gameePopups) {
      gameePopups = new PopupManager('popup,width=800,height=600', () => {
        showNotification({ message: 'Allow browser to open popup window' });
      });
    }

    gameePopups.preOpenIfNeeded();
  }

  const result = await callApi('answerCallbackButton', {
    chatId: chat.id,
    accessHash: chat.accessHash,
    messageId,
    data,
    isGame,
  });

  if (!result) {
    return;
  }
  const { message, alert: isError, url } = result;

  if (isError) {
    showDialog({ data: { message: message || 'Error' } });
  } else if (message) {
    showNotification({ message });
  } else if (url) {
    if (isGame) {
      // Workaround for Gamee embedding bug
      if (url.includes(GAMEE_URL)) {
        gameePopups!.open(url);
      } else {
        gameePopups!.cancelPreOpen();
        openGame({ url, chatId: chat.id, messageId });
      }
    } else {
      toggleSafeLinkModal({ url });
    }
  }
}
