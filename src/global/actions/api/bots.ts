import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';

import type {
  ApiChat, ApiContact, ApiUrlAuthResult, ApiUser,
} from '../../../api/types';
import type { InlineBotSettings } from '../../../types';

import { callApi } from '../../../api/gramjs';
import {
  selectBot,
  selectChat, selectChatBot, selectChatMessage, selectCurrentChat, selectCurrentMessageList,
  selectIsTrustedBot, selectReplyingToId, selectSendAs, selectUser,
} from '../../selectors';
import { addChats, addUsers, removeBlockedContact } from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { debounce } from '../../../util/schedulers';
import { replaceInlineBotSettings, replaceInlineBotsIsLoading } from '../../reducers/bots';
import { getServerTime } from '../../../util/serverTime';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
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
      actions.openUrl({ url });
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

    case 'simpleWebView': {
      const { url } = button;
      const { chatId } = selectCurrentMessageList(global) || {};
      if (!chatId) {
        return;
      }
      const bot = selectBot(global, chatId);
      if (!bot) {
        return;
      }
      const theme = extractCurrentThemeParams();
      actions.requestSimpleWebView({
        url, bot, theme, buttonText: button.text,
      });
      break;
    }

    case 'webView': {
      const { url } = button;
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }
      const message = selectChatMessage(global, chat.id, messageId);
      if (!message) {
        return;
      }
      if (!message.viaBotId && !message.senderId) {
        return;
      }
      const bot = selectBot(global, message.viaBotId! || message.senderId!);
      if (!bot) {
        return;
      }
      const theme = extractCurrentThemeParams();
      actions.requestWebView({
        url,
        bot,
        peer: chat,
        theme,
        buttonText: button.text,
      });
      break;
    }
    case 'urlAuth': {
      const { url } = button;
      const chat = selectCurrentChat(global);
      if (!chat) {
        return;
      }
      actions.requestBotUrlAuth({
        chatId: chat.id,
        messageId,
        buttonId: button.buttonId,
        url,
      });
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
    return;
  }

  const result = await callApi('fetchTopInlineBots');
  if (!result) {
    return;
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
  setGlobal(global);
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

addActionHandler('requestSimpleWebView', async (global, actions, payload) => {
  const {
    url, bot, theme, buttonText,
  } = payload;

  if (!selectIsTrustedBot(global, bot)) {
    setGlobal({
      ...global,
      botTrustRequest: {
        bot,
        type: 'webApp',
        onConfirm: {
          action: 'requestSimpleWebView',
          payload,
        },
      },
    });
    return;
  }

  const webViewUrl = await callApi('requestSimpleWebView', { url, bot, theme });
  if (!webViewUrl) {
    return;
  }

  global = getGlobal();
  setGlobal({
    ...global,
    webApp: {
      url: webViewUrl,
      bot,
      buttonText,
    },
  });
});

addActionHandler('requestWebView', async (global, actions, payload) => {
  const {
    url, bot, peer, theme, isSilent, buttonText, isFromBotMenu, startParam,
  } = payload;

  if (!selectIsTrustedBot(global, bot)) {
    setGlobal({
      ...global,
      botTrustRequest: {
        bot,
        type: 'webApp',
        onConfirm: {
          action: 'requestWebView',
          payload,
        },
      },
    });
    return;
  }

  const currentMessageList = selectCurrentMessageList(global);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId } = currentMessageList;
  const reply = chatId && selectReplyingToId(global, chatId, threadId);
  const result = await callApi('requestWebView', {
    url,
    bot,
    peer,
    theme,
    isSilent,
    replyToMessageId: reply || undefined,
    isFromBotMenu,
    startParam,
  });
  if (!result) {
    return;
  }

  const { url: webViewUrl, queryId } = result;

  global = getGlobal();
  setGlobal({
    ...global,
    webApp: {
      url: webViewUrl,
      bot,
      queryId,
      buttonText,
    },
  });
});

addActionHandler('prolongWebView', async (global, actions, payload) => {
  const {
    bot, peer, isSilent, replyToMessageId, queryId,
  } = payload;

  const result = await callApi('prolongWebView', {
    bot,
    peer,
    isSilent,
    replyToMessageId,
    queryId,
  });

  if (!result) {
    actions.closeWebApp();
  }
});

addActionHandler('sendWebViewData', (global, actions, payload) => {
  const {
    bot, data, buttonText,
  } = payload;

  callApi('sendWebViewData', {
    bot,
    data,
    buttonText,
  });
});

addActionHandler('closeWebApp', (global) => {
  return {
    ...global,
    webApp: undefined,
  };
});

addActionHandler('cancelBotTrustRequest', (global) => {
  return {
    ...global,
    botTrustRequest: undefined,
  };
});

addActionHandler('markBotTrusted', (global, actions, payload) => {
  const { botId } = payload;
  const { trustedBotIds } = global;

  const newTrustedBotIds = new Set(trustedBotIds);
  newTrustedBotIds.add(botId);
  setGlobal({
    ...global,
    botTrustRequest: undefined,
    trustedBotIds: Array.from(newTrustedBotIds),
  });

  if (global.botTrustRequest?.onConfirm) {
    const { action, payload: callbackPayload } = global.botTrustRequest.onConfirm;
    actions[action](callbackPayload);
  }
});

addActionHandler('loadAttachMenuBots', async (global, actions, payload) => {
  const { hash } = payload || {};
  await loadAttachMenuBots(hash);
});

addActionHandler('toggleBotInAttachMenu', async (global, actions, payload) => {
  const { botId, isEnabled } = payload;

  const bot = selectUser(global, botId);

  if (!bot) return;

  await toggleBotInAttachMenu(bot, isEnabled);
});

async function toggleBotInAttachMenu(bot: ApiUser, isEnabled: boolean) {
  await callApi('toggleBotInAttachMenu', { bot, isEnabled });
  await loadAttachMenuBots();
}

async function loadAttachMenuBots(hash?: string) {
  const result = await callApi('loadAttachMenuBots', { hash });
  if (!result) {
    return;
  }

  const global = getGlobal();
  setGlobal({
    ...global,
    attachMenu: {
      hash: result.hash,
      bots: result.bots,
    },
  });
}

addActionHandler('callAttachMenuBot', (global, actions, payload) => {
  const {
    chatId, botId, isFromBotMenu, url, startParam,
  } = payload;
  const chat = selectChat(global, chatId);
  const bot = selectChatBot(global, botId);
  if (!chat || !bot) {
    return undefined;
  }
  const { attachMenu: { bots } } = global;
  if (!isFromBotMenu && !bots[botId]) {
    return {
      ...global,
      botAttachRequest: {
        bot,
        chatId,
        startParam,
      },
    };
  }
  const theme = extractCurrentThemeParams();
  actions.requestWebView({
    url,
    peer: chat,
    bot,
    theme,
    buttonText: '',
    isFromBotMenu,
    startParam,
  });

  return undefined;
});

addActionHandler('confirmBotAttachRequest', async (global, actions) => {
  const { botAttachRequest } = global;
  if (!botAttachRequest) return;

  const { bot, chatId, startParam } = botAttachRequest;

  setGlobal({
    ...global,
    botAttachRequest: undefined,
  });

  await toggleBotInAttachMenu(bot, true);

  actions.callAttachMenuBot({ chatId, botId: bot.id, startParam });
});

addActionHandler('closeBotAttachRequestModal', (global) => {
  return {
    ...global,
    botAttachRequest: undefined,
  };
});

addActionHandler('requestBotUrlAuth', async (global, actions, payload) => {
  const {
    chatId, buttonId, messageId, url,
  } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('requestBotUrlAuth', {
    chat,
    buttonId,
    messageId,
  });

  if (!result) return;
  global = getGlobal();
  setGlobal({
    ...global,
    urlAuth: {
      url,
      button: {
        buttonId,
        messageId,
        chatId: chat.id,
      },
    },
  });
  handleUrlAuthResult(url, result);
});

addActionHandler('acceptBotUrlAuth', async (global, actions, payload) => {
  const { isWriteAllowed } = payload;
  if (!global.urlAuth?.button) return;
  const {
    button, url,
  } = global.urlAuth;
  const { chatId, messageId, buttonId } = button;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('acceptBotUrlAuth', {
    chat,
    messageId,
    buttonId,
    isWriteAllowed,
  });
  if (!result) return;
  handleUrlAuthResult(url, result);
});

addActionHandler('requestLinkUrlAuth', async (global, actions, payload) => {
  const { url } = payload;

  const result = await callApi('requestLinkUrlAuth', { url });
  if (!result) return;
  global = getGlobal();
  setGlobal({
    ...global,
    urlAuth: {
      url,
    },
  });
  handleUrlAuthResult(url, result);
});

addActionHandler('acceptLinkUrlAuth', async (global, actions, payload) => {
  const { isWriteAllowed } = payload;
  if (!global.urlAuth?.url) return;
  const { url } = global.urlAuth;

  const result = await callApi('acceptLinkUrlAuth', { url, isWriteAllowed });
  if (!result) return;
  handleUrlAuthResult(url, result);
});

addActionHandler('closeUrlAuthModal', (global) => {
  return {
    ...global,
    urlAuth: undefined,
  };
});

function handleUrlAuthResult(url: string, result: ApiUrlAuthResult) {
  if (result.type === 'request') {
    const global = getGlobal();
    if (!global.urlAuth) return;
    const { domain, bot, shouldRequestWriteAccess } = result;
    setGlobal({
      ...global,
      urlAuth: {
        ...global.urlAuth,
        request: {
          domain,
          botId: bot.id,
          shouldRequestWriteAccess,
        },
      },
    });
    return;
  }

  const siteUrl = result.type === 'accepted' ? result.url : url;
  window.open(siteUrl, '_blank', 'noopener');
  getActions().closeUrlAuthModal();
}

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
    showDialog, showNotification, openUrl, openGame,
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
      openUrl({ url });
    }
  }
}
