import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api/gramjs';
import {
  updateStatistics, updateMessageStatistics, updateStatisticsGraph, addUsers,
} from '../../reducers';
import { selectChatMessages, selectChat, selectChatFullInfo } from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('loadStatistics', async (global, actions, payload): Promise<void> => {
  const { chatId, isGroup, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const fullInfo = selectChatFullInfo(global, chatId);
  if (!chat || !fullInfo) {
    return;
  }

  const result = await callApi(
    isGroup ? 'fetchGroupStatistics' : 'fetchChannelStatistics',
    { chat, dcId: fullInfo.statisticsDcId },
  );
  if (!result) {
    return;
  }

  global = getGlobal();
  const { stats, users } = result;

  global = addUsers(global, buildCollectionByKey(users, 'id'));

  if ('recentTopMessages' in stats && stats.recentTopMessages.length) {
    const messages = selectChatMessages(global, chatId);

    stats.recentTopMessages = stats.recentTopMessages.map((message) => ({ ...message, ...messages[message.msgId] }));
  }

  global = updateStatistics(global, chatId, stats, tabId);
  setGlobal(global);
});

addActionHandler('loadMessageStatistics', async (global, actions, payload): Promise<void> => {
  const { chatId, messageId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const fullInfo = selectChatFullInfo(global, chatId);
  if (!chat || !fullInfo) {
    return;
  }

  const dcId = fullInfo.statisticsDcId;
  let result = await callApi('fetchMessageStatistics', { chat, messageId, dcId });
  if (!result) {
    result = {};
  }

  global = getGlobal();

  const { views, forwards } = selectChatMessages(global, chatId)[messageId];
  result.views = views;
  result.forwards = forwards;

  const publicForwards = await callApi('fetchMessagePublicForwards', { chat, messageId, dcId });
  result.publicForwards = publicForwards?.length;
  result.publicForwardsData = publicForwards;

  global = getGlobal();

  global = updateMessageStatistics(global, result, tabId);
  setGlobal(global);
});

addActionHandler('loadStatisticsAsyncGraph', async (global, actions, payload): Promise<void> => {
  const {
    chatId, token, name, isPercentage, tabId = getCurrentTabId(),
  } = payload;
  const fullInfo = selectChatFullInfo(global, chatId);
  if (!fullInfo) {
    return;
  }

  const dcId = fullInfo.statisticsDcId;
  const result = await callApi('fetchStatisticsAsyncGraph', { token, dcId, isPercentage });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateStatisticsGraph(global, chatId, name, result, tabId);
  setGlobal(global);
});
