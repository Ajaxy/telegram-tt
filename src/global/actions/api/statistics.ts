import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api/gramjs';
import { updateStatistics, updateStatisticsGraph } from '../../reducers';
import { selectChatMessages, selectChat } from '../../selectors';

addActionHandler('loadStatistics', (global, actions, payload) => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return;
  }

  (async () => {
    const result = await callApi('fetchStatistics', { chat });

    if (!result) {
      return;
    }

    global = getGlobal();

    if (result?.recentTopMessages.length) {
      const messages = selectChatMessages(global, chatId);

      result.recentTopMessages = result.recentTopMessages
        .map((message) => ({ ...message, ...messages[message.msgId] }));
    }

    global = updateStatistics(global, chatId, result);

    setGlobal(global);
  })();
});

addActionHandler('loadStatisticsAsyncGraph', (global, actions, payload) => {
  const {
    chatId, token, name, isPercentage,
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.fullInfo) {
    return;
  }

  (async () => {
    const dcId = chat.fullInfo!.statisticsDcId;
    const result = await callApi('fetchStatisticsAsyncGraph', { token, dcId, isPercentage });

    if (!result) {
      return;
    }

    setGlobal(updateStatisticsGraph(getGlobal(), chatId, name, result));
  })();
});
