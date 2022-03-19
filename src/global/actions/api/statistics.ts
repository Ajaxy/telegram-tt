import { addActionHandler, getGlobal } from '../../index';

import { callApi } from '../../../api/gramjs';
import { updateStatistics, updateStatisticsGraph } from '../../reducers';
import { selectChatMessages, selectChat } from '../../selectors';

addActionHandler('loadStatistics', async (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return undefined;
  }

  const result = await callApi('fetchStatistics', { chat });
  if (!result) {
    return undefined;
  }

  global = getGlobal();

  if (result?.recentTopMessages.length) {
    const messages = selectChatMessages(global, chatId);

    result.recentTopMessages = result.recentTopMessages
      .map((message) => ({ ...message, ...messages[message.msgId] }));
  }

  global = updateStatistics(global, chatId, result);

  return global;
});

addActionHandler('loadStatisticsAsyncGraph', async (global, actions, payload) => {
  const {
    chatId, token, name, isPercentage,
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return undefined;
  }

  const dcId = chat.fullInfo!.statisticsDcId;
  const result = await callApi('fetchStatisticsAsyncGraph', { token, dcId, isPercentage });

  if (!result) {
    return undefined;
  }

  return updateStatisticsGraph(getGlobal(), chatId, name, result);
});
