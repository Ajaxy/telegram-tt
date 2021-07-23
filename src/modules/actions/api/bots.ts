import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { ApiChat } from '../../../api/types';
import { InlineBotSettings } from '../../../types';

import { RE_TME_INVITE_LINK, RE_TME_LINK } from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  selectChat, selectChatMessage, selectCurrentChat, selectCurrentMessageList, selectReplyingToId, selectUser,
} from '../../selectors';
import { addChats, addUsers } from '../../reducers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { debounce } from '../../../util/schedulers';
import { replaceInlineBotSettings, replaceInlineBotsIsLoading } from '../../reducers/bots';

const TOP_PEERS_REQUEST_COOLDOWN = 60000; // 1 min
const runDebouncedForSearch = debounce((cb) => cb(), 500, false);

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
  const { command, chatId } = payload;
  const { currentUserId } = global;
  const chat = chatId ? selectChat(global, chatId) : selectCurrentChat(global);
  if (!currentUserId || !chat) {
    return;
  }

  void sendBotCommand(chat, currentUserId, command);
});

addReducer('loadTopInlineBots', (global) => {
  const { serverTimeOffset } = global;
  const { hash, lastRequestedAt } = global.topInlineBots;

  if (lastRequestedAt && Date.now() + serverTimeOffset - lastRequestedAt < TOP_PEERS_REQUEST_COOLDOWN) {
    return;
  }

  (async () => {
    const result = await callApi('fetchTopInlineBots', { hash });
    if (!result) {
      return;
    }

    const { hash: newHash, ids, users } = result;

    let newGlobal = getGlobal();
    newGlobal = addUsers(newGlobal, buildCollectionByKey(users, 'id'));
    newGlobal = {
      ...newGlobal,
      topInlineBots: {
        ...newGlobal.topInlineBots,
        hash: newHash,
        userIds: ids,
        lastRequestedAt: Date.now(),
      },
    };
    setGlobal(newGlobal);
  })();
});

addReducer('queryInlineBot', ((global, actions, payload) => {
  const {
    chatId, username, query, offset,
  } = payload;

  (async () => {
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
  })();
}));

addReducer('sendInlineBotResult', (global, actions, payload) => {
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
  });
});

addReducer('resetInlineBot', ((global, actions, payload) => {
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
}));

async function searchInlineBot({
  username,
  inlineBotData,
  chatId,
  query,
  offset,
} : {
  username: string;
  inlineBotData: InlineBotSettings;
  chatId: number;
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
    getDispatch().showDialog({ data: { message } });
  } else {
    getDispatch().showNotification({ message });
  }
}
