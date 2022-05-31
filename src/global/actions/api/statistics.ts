import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { ApiChannelStatistics } from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import { updateStatistics, updateMessageStatistics, updateStatisticsGraph } from '../../reducers';
import { selectChatMessages, selectChat } from '../../selectors';

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

  if ((result as ApiChannelStatistics).recentTopMessages?.length) {
    const messages = selectChatMessages(global, chatId);

    (result as ApiChannelStatistics).recentTopMessages = (result as ApiChannelStatistics).recentTopMessages
      .map((message) => ({ ...message, ...messages[message.msgId] }));
  }

  setGlobal(updateStatistics(global, chatId, result));
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
