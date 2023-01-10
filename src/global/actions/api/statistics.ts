import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api/gramjs';
import {
  updateStatistics, updateMessageStatistics, updateStatisticsGraph, addUsers,
} from '../../reducers';
import { selectChatMessages, selectChat } from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';

addActionHandler('loadStatistics', async (global, actions, payload) => {
  const { chatId, isGroup } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return;
  }

  const result = await callApi(isGroup ? 'fetchGroupStatistics' : 'fetchChannelStatistics', { chat });
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

  setGlobal(updateStatistics(global, chatId, stats));
});

addActionHandler('loadMessageStatistics', async (global, actions, payload) => {
  const { chatId, messageId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return;
  }

  let result = await callApi('fetchMessageStatistics', { chat, messageId });
  if (!result) {
    result = {};
  }

  global = getGlobal();

  const { views, forwards } = selectChatMessages(global, chatId)[messageId];
  result.views = views;
  result.forwards = forwards;

  const dcId = chat.fullInfo!.statisticsDcId;
  const publicForwards = await callApi('fetchMessagePublicForwards', { chat, messageId, dcId });
  result.publicForwards = publicForwards?.length;
  result.publicForwardsData = publicForwards;

  global = getGlobal();

  setGlobal(updateMessageStatistics(global, result));
});

addActionHandler('loadStatisticsAsyncGraph', async (global, actions, payload) => {
  const {
    chatId, token, name, isPercentage,
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return;
  }

  const dcId = chat.fullInfo!.statisticsDcId;
  const result = await callApi('fetchStatisticsAsyncGraph', { token, dcId, isPercentage });

  if (!result) {
    return;
  }

  setGlobal(updateStatisticsGraph(getGlobal(), chatId, name, result));
});
