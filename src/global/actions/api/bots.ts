import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';

import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import type {
  ApiChat, ApiChatType, ApiContact, ApiUrlAuthResult, ApiUser,
} from '../../../api/types';
import type { InlineBotSettings } from '../../../types';

import { MAIN_THREAD_ID } from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import {
  selectChat, selectChatBot, selectChatMessage, selectCurrentChat, selectCurrentMessageList, selectTabState,
  selectIsTrustedBot, selectReplyingToId, selectSendAs, selectUser, selectThreadTopMessageId,
} from '../../selectors';
import { addChats, addUsers, removeBlockedContact } from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { debounce } from '../../../util/schedulers';
import { replaceInlineBotSettings, replaceInlineBotsIsLoading } from '../../reducers/bots';
import { getServerTime } from '../../../util/serverTime';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import PopupManager from '../../../util/PopupManager';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

const GAMEE_URL = 'https://prizes.gamee.com/';
const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runDebouncedForSearch = debounce((cb) => cb(), 500, false);

addActionHandler('clickBotInlineButton', (global, actions, payload): ActionReturnType => {
  const { messageId, button, tabId = getCurrentTabId() } = payload;

  switch (button.type) {
    case 'command':
      actions.sendBotCommand({ command: button.text, tabId });
      break;
    case 'url': {
      const { url } = button;
      actions.openUrl({ url, tabId });
      break;
    }
    case 'callback': {
      const chat = selectCurrentChat(global, tabId);
      if (!chat) {
        return;
      }

      void answerCallbackButton(global, actions, chat, messageId, button.data, undefined, tabId);
      break;
    }
    case 'requestPoll':
      actions.openPollModal({ isQuiz: button.isQuiz, tabId });
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
        tabId,
      });
      break;
    }
    case 'receipt': {
      const chat = selectCurrentChat(global, tabId);
      if (!chat) {
        return;
      }
      const { receiptMessageId } = button;
      actions.getReceipt({
        receiptMessageId, chatId: chat.id, messageId, tabId,
      });
      break;
    }
    case 'buy': {
      const chat = selectCurrentChat(global, tabId);
      if (!chat) {
        return;
      }
      actions.openInvoice({
        chatId: chat.id,
        messageId,
        tabId,
      });
      break;
    }
    case 'game': {
      const chat = selectCurrentChat(global, tabId);
      if (!chat) {
        return;
      }

      void answerCallbackButton(global, actions, chat, messageId, undefined, true, tabId);
      break;
    }
    case 'switchBotInline': {
      const { query, isSamePeer } = button;
      actions.switchBotInline({
        query, isSamePeer, messageId, tabId,
      });
      break;
    }

    case 'userProfile': {
      const { userId } = button;
      actions.openChatWithInfo({ id: userId, tabId });
      break;
    }

    case 'simpleWebView': {
      const { url } = button;
      const { chatId } = selectCurrentMessageList(global, tabId) || {};
      if (!chatId) {
        return;
      }
      const message = selectChatMessage(global, chatId, messageId);
      if (!message?.senderId) return;
      const theme = extractCurrentThemeParams();
      actions.requestSimpleWebView({
        url, botId: message?.senderId, theme, buttonText: button.text, tabId,
      });
      break;
    }

    case 'webView': {
      const { url } = button;
      const chat = selectCurrentChat(global, tabId);
      if (!chat) {
        return;
      }
      const message = selectChatMessage(global, chat.id, messageId);
      if (!message) {
        return;
      }
      const botId = message.viaBotId || message.senderId;
      if (!botId) {
        return;
      }
      const theme = extractCurrentThemeParams();
      actions.requestWebView({
        url,
        botId,
        peerId: chat.id,
        theme,
        buttonText: button.text,
        tabId,
      });
      break;
    }
    case 'urlAuth': {
      const { url } = button;
      const chat = selectCurrentChat(global, tabId);
      if (!chat) {
        return;
      }
      actions.requestBotUrlAuth({
        chatId: chat.id,
        messageId,
        buttonId: button.buttonId,
        url,
        tabId,
      });
      break;
    }
  }
});

addActionHandler('sendBotCommand', (global, actions, payload): ActionReturnType => {
  const { command, chatId, tabId = getCurrentTabId() } = payload;
  const { currentUserId } = global;
  const chat = chatId ? selectChat(global, chatId) : selectCurrentChat(global, tabId);
  const currentMessageList = selectCurrentMessageList(global, tabId);

  if (!currentUserId || !chat || !currentMessageList) {
    return;
  }

  const { threadId } = currentMessageList;
  actions.setReplyingToId({ messageId: undefined, tabId });
  actions.clearWebPagePreview({ tabId });

  void sendBotCommand(
    chat, currentUserId, command, selectReplyingToId(global, chat.id, threadId), selectSendAs(global, chat.id),
  );
});

addActionHandler('restartBot', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const { currentUserId } = global;
  const chat = selectCurrentChat(global, tabId);
  const bot = currentUserId && selectChatBot(global, chatId);
  if (!currentUserId || !chat || !bot) {
    return;
  }

  const result = await callApi('unblockContact', bot.id, bot.accessHash);
  if (!result) {
    return;
  }

  global = getGlobal();
  global = removeBlockedContact(global, bot.id);
  setGlobal(global);
  void sendBotCommand(chat, currentUserId, '/start', undefined, selectSendAs(global, chatId));
});

addActionHandler('loadTopInlineBots', async (global): Promise<void> => {
  const { lastRequestedAt } = global.topInlineBots;
  if (lastRequestedAt && getServerTime() - lastRequestedAt < TOP_PEERS_REQUEST_COOLDOWN) {
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
      lastRequestedAt: getServerTime(),
    },
  };
  setGlobal(global);
});

addActionHandler('queryInlineBot', async (global, actions, payload): Promise<void> => {
  const {
    chatId, username, query, offset,
    tabId = getCurrentTabId(),
  } = payload;

  let inlineBotData = selectTabState(global, tabId).inlineBots.byUsername[username];
  if (inlineBotData === false) {
    return;
  }

  if (inlineBotData === undefined) {
    const { user: inlineBot, chat } = await callApi('fetchInlineBot', { username }) || {};
    global = getGlobal();
    if (!inlineBot || !chat) {
      global = replaceInlineBotSettings(global, username, false, tabId);
      setGlobal(global);
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
      cacheTime: 0,
    };

    global = replaceInlineBotSettings(global, username, inlineBotData, tabId);
    setGlobal(global);
  }

  if (query === inlineBotData.query && !inlineBotData.canLoadMore) {
    return;
  }

  void runDebouncedForSearch(() => {
    searchInlineBot(global, {
      username,
      inlineBotData: inlineBotData as InlineBotSettings,
      chatId,
      query,
      offset,
    }, tabId);
  });
});

addActionHandler('switchBotInline', (global, actions, payload): ActionReturnType => {
  const {
    query, isSamePeer, messageId, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectCurrentChat(global, tabId);
  if (!chat) {
    return undefined;
  }
  const message = selectChatMessage(global, chat.id, messageId);
  if (!message) {
    return undefined;
  }

  const botSender = selectUser(global, message.viaBotId || message.senderId!);
  if (!botSender) {
    return undefined;
  }

  actions.openChatWithDraft({
    text: `@${botSender.usernames![0].username} ${query}`,
    chatId: isSamePeer ? chat.id : undefined,
    tabId,
  });
  return undefined;
});

addActionHandler('sendInlineBotResult', (global, actions, payload): ActionReturnType => {
  const {
    id, queryId, isSilent, scheduledAt,
    tabId = getCurrentTabId(),
  } = payload;
  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList || !id) {
    return;
  }

  const { chatId, threadId } = currentMessageList;

  const chat = selectChat(global, chatId)!;
  const replyingTo = selectReplyingToId(global, chatId, threadId);
  let replyingToTopId: number | undefined;

  if (replyingTo && threadId !== MAIN_THREAD_ID) {
    replyingToTopId = selectThreadTopMessageId(global, chatId, threadId)!;
  }

  actions.setReplyingToId({ messageId: undefined, tabId });
  actions.clearWebPagePreview({ tabId });

  void callApi('sendInlineBotResult', {
    chat,
    resultId: id,
    queryId,
    replyingTo,
    replyingToTopId,
    sendAs: selectSendAs(global, chatId),
    isSilent,
    scheduleDate: scheduledAt,
  });
});

addActionHandler('resetInlineBot', (global, actions, payload): ActionReturnType => {
  const { username, force, tabId = getCurrentTabId() } = payload;

  let inlineBotData = selectTabState(global, tabId).inlineBots.byUsername[username];

  if (!inlineBotData) {
    return;
  }

  if (!force && Date.now() < inlineBotData.cacheTime) return;

  inlineBotData = {
    id: inlineBotData.id,
    query: '',
    offset: '',
    switchPm: undefined,
    canLoadMore: true,
    results: [],
    cacheTime: 0,
  };

  global = replaceInlineBotSettings(global, username, inlineBotData, tabId);
  setGlobal(global);
});

addActionHandler('resetAllInlineBots', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const inlineBots = selectTabState(global, tabId).inlineBots.byUsername;

  Object.keys(inlineBots).forEach((username) => {
    actions.resetInlineBot({ username, tabId });
  });
});

addActionHandler('startBot', async (global, actions, payload): Promise<void> => {
  const { botId, param } = payload;

  let bot = selectUser(global, botId);
  if (!bot) {
    return;
  }
  if (!bot.fullInfo) await callApi('fetchFullUser', { id: bot.id, accessHash: bot.accessHash });
  global = getGlobal();
  bot = selectUser(global, botId)!;
  if (bot.fullInfo?.isBlocked) await callApi('unblockContact', bot.id, bot.accessHash);

  await callApi('startBot', {
    bot,
    startParam: param,
  });
});

addActionHandler('requestSimpleWebView', async (global, actions, payload): Promise<void> => {
  const {
    url, botId, theme, buttonText,
    tabId = getCurrentTabId(),
  } = payload;

  const bot = selectUser(global, botId);
  if (!bot) return;

  if (!selectIsTrustedBot(global, botId)) {
    global = updateTabState(global, {
      botTrustRequest: {
        botId,
        type: 'webApp',
        onConfirm: {
          action: 'requestSimpleWebView',
          payload,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  const webViewUrl = await callApi('requestSimpleWebView', { url, bot, theme });
  if (!webViewUrl) {
    return;
  }

  global = getGlobal();
  global = updateTabState(global, {
    webApp: {
      url: webViewUrl,
      botId,
      buttonText,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('requestWebView', async (global, actions, payload): Promise<void> => {
  const {
    url, botId, peerId, theme, isSilent, buttonText, isFromBotMenu, startParam,
    tabId = getCurrentTabId(),
  } = payload;

  const bot = selectUser(global, botId);
  if (!bot) return;
  const peer = selectChat(global, peerId);
  if (!peer) return;

  if (!selectIsTrustedBot(global, botId)) {
    global = updateTabState(global, {
      botTrustRequest: {
        botId,
        type: 'webApp',
        onConfirm: {
          action: 'requestWebView',
          payload,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) {
    return;
  }

  const { chatId, threadId } = currentMessageList;
  const reply = chatId && selectReplyingToId(global, chatId, threadId);
  const sendAs = selectSendAs(global, chatId);
  const result = await callApi('requestWebView', {
    url,
    bot,
    peer,
    theme,
    isSilent,
    replyToMessageId: reply || undefined,
    threadId,
    isFromBotMenu,
    startParam,
    sendAs,
  });
  if (!result) {
    return;
  }

  const { url: webViewUrl, queryId } = result;

  global = getGlobal();
  global = updateTabState(global, {
    webApp: {
      url: webViewUrl,
      botId,
      queryId,
      replyToMessageId: reply || undefined,
      threadId,
      buttonText,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('prolongWebView', async (global, actions, payload): Promise<void> => {
  const {
    botId, peerId, isSilent, replyToMessageId, queryId, threadId,
    tabId = getCurrentTabId(),
  } = payload;

  const bot = selectUser(global, botId);
  if (!bot) return;
  const peer = selectChat(global, peerId);
  if (!peer) return;

  const sendAs = selectSendAs(global, peerId);

  const result = await callApi('prolongWebView', {
    bot,
    peer,
    isSilent,
    replyToMessageId,
    threadId,
    queryId,
    sendAs,
  });

  if (!result) {
    actions.closeWebApp({ tabId });
  }
});

addActionHandler('sendWebViewData', (global, actions, payload): ActionReturnType => {
  const {
    bot, data, buttonText,
  } = payload;

  callApi('sendWebViewData', {
    bot,
    data,
    buttonText,
  });
});

addActionHandler('closeWebApp', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    webApp: undefined,
  }, tabId);
});

addActionHandler('setWebAppPaymentSlug', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);
  if (!tabState.webApp?.url) return undefined;

  return updateTabState(global, {
    webApp: {
      ...tabState.webApp,
      slug: payload.slug,
    },
  }, tabId);
});

addActionHandler('cancelBotTrustRequest', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    botTrustRequest: undefined,
  }, tabId);
});

addActionHandler('markBotTrusted', (global, actions, payload): ActionReturnType => {
  const { botId, tabId = getCurrentTabId() } = payload;
  const { trustedBotIds } = global;

  const newTrustedBotIds = new Set(trustedBotIds);
  newTrustedBotIds.add(botId);

  global = {
    ...global,
    trustedBotIds: Array.from(newTrustedBotIds),
  };

  const tabState = selectTabState(global, tabId);
  if (tabState.botTrustRequest?.onConfirm) {
    const { action, payload: callbackPayload } = tabState.botTrustRequest.onConfirm;
    // @ts-ignore
    actions[action](callbackPayload);
  }

  global = updateTabState(global, {
    botTrustRequest: undefined,
  }, tabId);

  setGlobal(global);
});

addActionHandler('loadAttachBots', async (global, actions, payload): Promise<void> => {
  const { hash } = payload || {};
  await loadAttachBots(global, hash);
});

addActionHandler('toggleAttachBot', async (global, actions, payload): Promise<void> => {
  const { botId, isWriteAllowed, isEnabled } = payload;

  const bot = selectUser(global, botId);

  if (!bot) return;

  await toggleAttachBot(global, bot, isEnabled, isWriteAllowed);
});

async function toggleAttachBot<T extends GlobalState>(
  global: T, bot: ApiUser, isEnabled: boolean, isWriteAllowed?: boolean,
) {
  await callApi('toggleAttachBot', { bot, isWriteAllowed, isEnabled });
  global = getGlobal();
  await loadAttachBots(global);
}

async function loadAttachBots<T extends GlobalState>(global: T, hash?: string) {
  const result = await callApi('loadAttachBots', { hash });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = {
    ...global,
    attachMenu: {
      hash: result.hash,
      bots: result.bots,
    },
  };
  setGlobal(global);
}

addActionHandler('callAttachBot', (global, actions, payload): ActionReturnType => {
  const {
    chatId, bot, url, startParam, threadId,
    tabId = getCurrentTabId(),
  } = payload;
  const isFromBotMenu = !bot;
  if (!isFromBotMenu && !global.attachMenu.bots[bot.id]) {
    return updateTabState(global, {
      requestedAttachBotInstall: {
        bot,
        onConfirm: {
          action: 'callAttachBot',
          payload,
        },
      },
    }, tabId);
  }
  const theme = extractCurrentThemeParams();
  actions.openChat({ id: chatId, threadId, tabId });
  actions.requestWebView({
    url,
    peerId: chatId,
    botId: isFromBotMenu ? chatId : bot.id,
    theme,
    buttonText: '',
    isFromBotMenu,
    startParam,
    tabId,
  });

  return undefined;
});

addActionHandler('confirmAttachBotInstall', async (global, actions, payload): Promise<void> => {
  const { isWriteAllowed, tabId = getCurrentTabId() } = payload;
  const { requestedAttachBotInstall } = selectTabState(global, tabId);

  const { bot, onConfirm } = requestedAttachBotInstall!;

  global = updateTabState(global, {
    requestedAttachBotInstall: undefined,
  }, tabId);
  setGlobal(global);

  const botUser = selectUser(global, bot.id);
  if (!botUser) return;

  await toggleAttachBot(global, botUser, true, isWriteAllowed);
  if (onConfirm) {
    const { action, payload: actionPayload } = onConfirm;
    // @ts-ignore
    actions[action](actionPayload);
  }
});

addActionHandler('cancelAttachBotInstall', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    requestedAttachBotInstall: undefined,
  }, tabId);
});

addActionHandler('requestAttachBotInChat', (global, actions, payload): ActionReturnType => {
  const {
    bot, filter, startParam, tabId = getCurrentTabId(),
  } = payload;
  const currentChatId = selectCurrentMessageList(global, tabId)?.chatId;

  const supportedFilters = bot.peerTypes.filter((type): type is ApiChatType => (
    type !== 'self' && filter.includes(type)
  ));

  if (!supportedFilters.length) {
    actions.callAttachBot({
      chatId: currentChatId || bot.id,
      bot,
      startParam,
      tabId,
    });
    return;
  }

  global = updateTabState(global, {
    requestedAttachBotInChat: {
      bot,
      filter: supportedFilters,
      startParam,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('cancelAttachBotInChat', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    requestedAttachBotInChat: undefined,
  }, tabId);
});

addActionHandler('requestBotUrlAuth', async (global, actions, payload): Promise<void> => {
  const {
    chatId, buttonId, messageId, url, tabId = getCurrentTabId(),
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
  global = updateTabState(global, {
    urlAuth: {
      url,
      button: {
        buttonId,
        messageId,
        chatId: chat.id,
      },
    },
  }, tabId);
  setGlobal(global);
  handleUrlAuthResult(global, actions, url, result, tabId);
});

addActionHandler('acceptBotUrlAuth', async (global, actions, payload): Promise<void> => {
  const { isWriteAllowed, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);
  if (!tabState.urlAuth?.button) return;
  const {
    button, url,
  } = tabState.urlAuth;
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
  global = getGlobal();
  handleUrlAuthResult(global, actions, url, result, tabId);
});

addActionHandler('requestLinkUrlAuth', async (global, actions, payload): Promise<void> => {
  const { url, tabId = getCurrentTabId() } = payload;

  const result = await callApi('requestLinkUrlAuth', { url });
  if (!result) return;
  global = getGlobal();
  global = updateTabState(global, {
    urlAuth: {
      url,
    },
  }, tabId);
  setGlobal(global);
  handleUrlAuthResult(global, actions, url, result, tabId);
});

addActionHandler('acceptLinkUrlAuth', async (global, actions, payload): Promise<void> => {
  const { isWriteAllowed, tabId = getCurrentTabId() } = payload;
  const tabState = selectTabState(global, tabId);
  if (!tabState.urlAuth?.url) return;
  const { url } = tabState.urlAuth;

  const result = await callApi('acceptLinkUrlAuth', { url, isWriteAllowed });
  if (!result) return;
  global = getGlobal();
  handleUrlAuthResult(global, actions, url, result, tabId);
});

addActionHandler('closeUrlAuthModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    urlAuth: undefined,
  }, tabId);
});

function handleUrlAuthResult<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  url: string, result: ApiUrlAuthResult,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (result.type === 'request') {
    global = getGlobal();
    const tabState = selectTabState(global, tabId);
    if (!tabState.urlAuth) return;
    const { domain, bot, shouldRequestWriteAccess } = result;
    global = updateTabState(global, {
      urlAuth: {
        ...tabState.urlAuth,
        request: {
          domain,
          botId: bot.id,
          shouldRequestWriteAccess,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  const siteUrl = result.type === 'accepted' ? result.url : url;
  window.open(siteUrl, '_blank', 'noopener');
  actions.closeUrlAuthModal({ tabId });
}

async function searchInlineBot<T extends GlobalState>(global: T, {
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
}, ...[tabId = getCurrentTabId()]: TabArgs<T>) {
  global = getGlobal();
  const bot = selectUser(global, inlineBotData.id);
  const chat = selectChat(global, chatId);
  if (!bot || !chat) {
    return;
  }

  const shouldReplaceSettings = inlineBotData.query !== query;
  global = replaceInlineBotsIsLoading(global, true, tabId);
  global = replaceInlineBotSettings(global, username, {
    ...inlineBotData,
    query,
    ...(shouldReplaceSettings && { offset: undefined, results: [] }),
  }, tabId);
  setGlobal(global);

  const result = await callApi('fetchInlineBotResults', {
    bot,
    chat,
    query,
    offset: shouldReplaceSettings ? undefined : offset,
  });

  global = getGlobal();
  const newInlineBotData = selectTabState(global, tabId).inlineBots.byUsername[username];
  global = replaceInlineBotsIsLoading(global, false, tabId);
  if (!result || !newInlineBotData || query !== newInlineBotData.query) {
    setGlobal(global);
    return;
  }

  const currentIds = new Set((newInlineBotData.results || []).map((data) => data.id));
  const newResults = result.results.filter((data) => !currentIds.has(data.id));

  global = replaceInlineBotSettings(global, username, {
    ...newInlineBotData,
    help: result.help,
    cacheTime: Date.now() + result.cacheTime * 1000,
    ...(newResults.length && { isGallery: result.isGallery }),
    ...(result.switchPm && { switchPm: result.switchPm }),
    canLoadMore: result.results.length > 0 && Boolean(result.nextOffset),
    results: newInlineBotData.offset === '' || newInlineBotData.offset === result.nextOffset
      ? result.results
      : (newInlineBotData.results || []).concat(newResults),
    offset: newResults.length ? result.nextOffset : '',
  }, tabId);

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

async function answerCallbackButton<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions, chat: ApiChat, messageId: number, data?: string, isGame = false,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const {
    showDialog, showNotification, openUrl, openGame,
  } = actions;

  if (isGame) {
    if (!gameePopups) {
      gameePopups = new PopupManager('popup,width=800,height=600', () => {
        showNotification({ message: 'Allow browser to open popup window', tabId });
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
    showDialog({ data: { message: message || 'Error' }, tabId });
  } else if (message) {
    showNotification({ message, tabId });
  } else if (url) {
    if (isGame) {
      // Workaround for Gamee embedding bug
      if (url.includes(GAMEE_URL)) {
        gameePopups!.open(url);
      } else {
        gameePopups!.cancelPreOpen();
        openGame({
          url, chatId: chat.id, messageId, tabId,
        });
      }
    } else {
      openUrl({ url, tabId });
    }
  }
}
