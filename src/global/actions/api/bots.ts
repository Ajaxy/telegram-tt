import type { InlineBotSettings } from '../../../types';
import type { RequiredGlobalActions } from '../../index';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import {
  type ApiChat, type ApiChatType, type ApiContact, type ApiInputMessageReplyInfo, type ApiPeer, type ApiUrlAuthResult,
  MAIN_THREAD_ID,
} from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { BOT_FATHER_USERNAME, GENERAL_REFETCH_INTERVAL } from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { translate } from '../../../util/langProvider';
import PopupManager from '../../../util/PopupManager';
import requestActionTimeout from '../../../util/requestActionTimeout';
import { debounce } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import { callApi } from '../../../api/gramjs';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  addChats, addUsers, removeBlockedUser, updateManagementProgress, updateUser, updateUserFullInfo,
} from '../../reducers';
import { replaceInlineBotSettings, replaceInlineBotsIsLoading } from '../../reducers/bots';
import { updateTabState } from '../../reducers/tabs';
import {
  selectBot,
  selectChat,
  selectChatLastMessageId,
  selectChatMessage,
  selectCurrentChat,
  selectCurrentMessageList,
  selectDraft,
  selectIsTrustedBot,
  selectMessageReplyInfo,
  selectSendAs,
  selectTabState,
  selectUser,
  selectUserFullInfo,
} from '../../selectors';
import { fetchChatByUsername } from './chats';

const GAMEE_URL = 'https://prizes.gamee.com/';
const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runDebouncedForSearch = debounce((cb) => cb(), 500, false);
let botFatherId: string | null;

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
          firstName: user.firstName || '',
          lastName: user.lastName || '',
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
  const chat = chatId ? selectChat(global, chatId) : selectCurrentChat(global, tabId);
  const currentMessageList = selectCurrentMessageList(global, tabId);

  if (!chat || !currentMessageList) {
    return;
  }

  const { threadId } = currentMessageList;
  actions.resetDraftReplyInfo({ tabId });
  actions.clearWebPagePreview({ tabId });

  const lastMessageId = selectChatLastMessageId(global, chat.id);

  void sendBotCommand(
    chat, command, selectDraft(global, chat.id, threadId)?.replyInfo, selectSendAs(global, chat.id), lastMessageId,
  );
});

addActionHandler('restartBot', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const { currentUserId } = global;
  const chat = selectCurrentChat(global, tabId);
  const bot = currentUserId && selectBot(global, chatId);
  if (!currentUserId || !chat || !bot) {
    return;
  }

  const lastMessageId = selectChatLastMessageId(global, chat.id);

  const result = await callApi('unblockUser', { user: bot });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = removeBlockedUser(global, bot.id);
  setGlobal(global);
  void sendBotCommand(chat, '/start', undefined, selectSendAs(global, chatId), lastMessageId);
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
    query, isSamePeer, messageId, filter, tabId = getCurrentTabId(),
  } = payload;
  let {
    botId,
  } = payload;
  const chat = selectCurrentChat(global, tabId);
  if (!chat) {
    return undefined;
  }

  if (!botId && messageId) {
    const message = selectChatMessage(global, chat.id, messageId);
    if (!message) {
      return undefined;
    }
    botId = message.viaBotId || message.senderId;
  }

  if (!botId) {
    return undefined;
  }

  const botSender = selectUser(global, botId);
  if (!botSender) {
    return undefined;
  }

  actions.openChatWithDraft({
    text: `@${botSender.usernames![0].username} ${query}`,
    chatId: isSamePeer ? chat.id : undefined,
    filter,
    tabId,
  });
  return undefined;
});

addActionHandler('sendInlineBotResult', (global, actions, payload): ActionReturnType => {
  const {
    id, queryId, isSilent, scheduledAt, messageList,
    tabId = getCurrentTabId(),
  } = payload;
  if (!id) {
    return;
  }

  const { chatId, threadId } = messageList;
  const chat = selectChat(global, chatId)!;
  const draftReplyInfo = selectDraft(global, chatId, threadId)?.replyInfo;

  const replyInfo = selectMessageReplyInfo(global, chatId, threadId, draftReplyInfo);

  actions.resetDraftReplyInfo({ tabId });
  actions.clearWebPagePreview({ tabId });

  void callApi('sendInlineBotResult', {
    chat,
    resultId: id,
    queryId,
    replyInfo,
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

  const bot = selectUser(global, botId);
  if (!bot) {
    return;
  }

  let fullInfo = selectUserFullInfo(global, botId);
  if (!fullInfo) {
    const result = await callApi('fetchFullUser', { id: bot.id, accessHash: bot.accessHash });
    fullInfo = result?.fullInfo;
  }

  if (fullInfo?.isBlocked) {
    await callApi('unblockUser', { user: bot });
  }

  await callApi('startBot', {
    bot,
    startParam: param,
  });
});

addActionHandler('sharePhoneWithBot', async (global, actions, payload): Promise<void> => {
  const { botId } = payload;
  const bot = selectUser(global, botId);
  if (!bot) {
    return;
  }

  let fullInfo = selectUserFullInfo(global, botId);
  if (!fullInfo) {
    const result = await callApi('fetchFullUser', { id: bot.id, accessHash: bot.accessHash });
    fullInfo = result?.fullInfo;
  }

  if (fullInfo?.isBlocked) {
    await callApi('unblockUser', { user: bot });
  }

  global = getGlobal();
  const chat = selectChat(global, botId);
  const currentUser = selectUser(global, global.currentUserId!)!;

  if (!chat) return;
  const lastMessageId = selectChatLastMessageId(global, chat.id);

  await callApi('sendMessage', {
    chat,
    contact: {
      firstName: currentUser.firstName || '',
      lastName: currentUser.lastName || '',
      phoneNumber: currentUser.phoneNumber || '',
      userId: currentUser.id,
    },
    lastMessageId,
  });
});

addActionHandler('requestSimpleWebView', async (global, actions, payload): Promise<void> => {
  const {
    url, botId, theme, buttonText, isFromSideMenu, isFromSwitchWebView, startParam,
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

  const webViewUrl = await callApi('requestSimpleWebView', {
    url,
    bot,
    theme,
    startParam,
    isFromSideMenu,
    isFromSwitchWebView,
  });
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
  const draftReplyInfo = chatId ? selectDraft(global, chatId, threadId)?.replyInfo : undefined;
  const replyInfo = selectMessageReplyInfo(global, chatId, threadId, draftReplyInfo);

  const sendAs = selectSendAs(global, chatId);
  const result = await callApi('requestWebView', {
    url,
    bot,
    peer,
    theme,
    isSilent,
    replyInfo,
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
      replyInfo,
      buttonText,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('requestAppWebView', async (global, actions, payload): Promise<void> => {
  const {
    botId, appName, startApp, theme, isWriteAllowed, isFromConfirm,
    tabId = getCurrentTabId(),
  } = payload;

  const bot = selectUser(global, botId);
  if (!bot) return;

  // Native clients require to install attach bots before using their named mini apps
  const isAttachBotInstalled = Boolean(global.attachMenu.bots[bot.id]);
  if (bot.isAttachBot && !isFromConfirm && !isAttachBotInstalled) {
    const result = await callApi('loadAttachBot', {
      bot,
    });
    if (result) {
      const attachBot = result.bot;
      global = getGlobal();
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
      setGlobal(global);

      const shouldAskForTos = attachBot.isDisclaimerNeeded || attachBot.isForAttachMenu || attachBot.isForSideMenu;

      if (shouldAskForTos) {
        global = updateTabState(global, {
          requestedAttachBotInstall: {
            bot: attachBot,
            onConfirm: {
              action: 'requestAppWebView',
              payload: {
                ...payload,
                isFromConfirm: true,
              },
            },
          },
        }, tabId);
        setGlobal(global);
        return;
      }
    }
  }

  const botApp = await callApi('fetchBotApp', {
    bot,
    appName,
  });
  global = getGlobal();

  if (!botApp) {
    actions.showNotification({ message: translate('lng_username_app_not_found'), tabId });
    return;
  }

  if (botApp.isInactive && !selectIsTrustedBot(global, botId)) {
    global = updateTabState(global, {
      botTrustRequest: {
        botId,
        shouldRequestWriteAccess: botApp.shouldRequestWriteAccess,
        type: 'botApp',
        onConfirm: {
          action: 'requestAppWebView',
          payload,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  const peer = selectCurrentChat(global, tabId);

  const url = await callApi('requestAppWebView', {
    peer: peer || bot,
    app: botApp,
    startParam: startApp,
    isWriteAllowed,
    theme,
  });
  global = getGlobal();

  if (!url) return;

  global = updateTabState(global, {
    webApp: {
      url,
      botId,
      buttonText: '',
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('prolongWebView', async (global, actions, payload): Promise<void> => {
  const {
    botId, peerId, isSilent, replyInfo, queryId, tabId = getCurrentTabId(),
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
    replyInfo,
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
  const { botId, isWriteAllowed, tabId = getCurrentTabId() } = payload;
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
    actions[action]({
      ...(callbackPayload as {}),
      isWriteAllowed,
    });
  }

  global = updateTabState(global, {
    botTrustRequest: undefined,
  }, tabId);

  setGlobal(global);
});

addActionHandler('loadAttachBots', async (global, actions, payload): Promise<void> => {
  const { hash } = payload || {};
  const result = await loadAttachBots(global, hash);

  requestActionTimeout({
    action: 'loadAttachBots',
    payload: { hash: result?.hash },
  }, GENERAL_REFETCH_INTERVAL);
});

addActionHandler('toggleAttachBot', async (global, actions, payload): Promise<void> => {
  const { botId, isWriteAllowed, isEnabled } = payload;

  const bot = selectUser(global, botId);

  if (!bot) return;

  await callApi('toggleAttachBot', { bot, isWriteAllowed, isEnabled });
});

async function loadAttachBots<T extends GlobalState>(global: T, hash?: string) {
  const result = await callApi('loadAttachBots', { hash });
  if (!result) {
    return undefined;
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

  return result;
}

addActionHandler('callAttachBot', (global, actions, payload): ActionReturnType => {
  const {
    bot, startParam, isFromConfirm, tabId = getCurrentTabId(),
  } = payload;
  const isFromSideMenu = 'isFromSideMenu' in payload && payload.isFromSideMenu;

  const isFromBotMenu = !bot;
  const shouldDisplayDisclaimer = (!isFromBotMenu && !global.attachMenu.bots[bot.id])
    || bot?.isInactive || bot?.isDisclaimerNeeded;

  if (!isFromConfirm && shouldDisplayDisclaimer) {
    return updateTabState(global, {
      requestedAttachBotInstall: {
        bot,
        onConfirm: {
          action: 'callAttachBot',
          payload: {
            ...payload,
            isFromConfirm: true,
          },
        },
      },
    }, tabId);
  }

  const theme = extractCurrentThemeParams();
  if (isFromSideMenu) {
    actions.requestSimpleWebView({
      botId: bot!.id,
      buttonText: '',
      isFromSideMenu: true,
      startParam,
      theme,
      tabId,
    });
  }

  if ('chatId' in payload) {
    const { chatId, threadId = MAIN_THREAD_ID, url } = payload;
    actions.openThread({ chatId, threadId, tabId });
    actions.requestWebView({
      url,
      peerId: chatId!,
      botId: (isFromBotMenu ? chatId : bot.id)!,
      theme,
      buttonText: '',
      isFromBotMenu,
      startParam,
      tabId,
    });
  }

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

  actions.markBotTrusted({ botId: bot.id, isWriteAllowed, tabId });
  await callApi('toggleAttachBot', { bot: botUser, isWriteAllowed, isEnabled: true });
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

  const supportedFilters = bot.attachMenuPeerTypes?.filter((type): type is ApiChatType => (
    type !== 'self' && filter.includes(type)
  ));

  if (!supportedFilters?.length) {
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
    ...(result.switchWebview && { switchWebview: result.switchWebview }),
    canLoadMore: result.results.length > 0 && Boolean(result.nextOffset),
    results: newInlineBotData.offset === '' || newInlineBotData.offset === result.nextOffset
      ? result.results
      : (newInlineBotData.results || []).concat(newResults),
    offset: newResults.length ? result.nextOffset : '',
  }, tabId);

  setGlobal(global);
}

async function sendBotCommand(
  chat: ApiChat, command: string, replyInfo?: ApiInputMessageReplyInfo, sendAs?: ApiPeer, lastMessageId?: number,
) {
  await callApi('sendMessage', {
    chat,
    replyInfo,
    text: command,
    sendAs,
    lastMessageId,
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

addActionHandler('setBotInfo', async (global, actions, payload): Promise<void> => {
  const {
    bot, name, description: about,
    tabId = getCurrentTabId(),
  } = payload;

  let { langCode } = payload;
  if (!langCode) langCode = global.settings.byKey.language;

  const { currentUserId } = global;
  if (!currentUserId || !bot) {
    return;
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  if (name || about) {
    const result = await callApi('setBotInfo', {
      bot, langCode, name, about,
    });

    if (result) {
      global = getGlobal();
      global = updateUser(
        global,
        bot.id,
        {
          firstName: name,
        },
      );
      global = updateUserFullInfo(global, bot.id, { bio: about });
      setGlobal(global);
    }
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);
});

addActionHandler('startBotFatherConversation', async (global, actions, payload): Promise<void> => {
  const {
    param,
    tabId = getCurrentTabId(),
  } = payload;

  if (!botFatherId) {
    const chat = await fetchChatByUsername(global, BOT_FATHER_USERNAME);
    if (!chat) {
      return;
    }
    botFatherId = chat.id;
  }

  if (param) {
    actions.startBot({ botId: botFatherId, param });
  }

  actions.openChat({ id: botFatherId, tabId });
});
