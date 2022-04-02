import { addActionHandler } from '../../index';
import { selectChat } from '../../selectors';
import { callApi } from '../../../api/gramjs';
import { getTranslation } from '../../../util/langProvider';

addActionHandler('reportPeer', async (global, actions, payload) => {
  const {
    chatId,
    reason,
    description,
  } = payload;
  if (!chatId) {
    return;
  }

  const chat = selectChat(global, chatId)!;
  if (!chat) {
    return;
  }

  const result = await callApi('reportPeer', {
    peer: chat,
    reason,
    description,
  });

  actions.showNotification({
    message: getTranslation(result ? 'ReportPeer.AlertSuccess' : 'ReportPeer.AlertFailure'),
  });
});

addActionHandler('reportProfilePhoto', async (global, actions, payload) => {
  const {
    chatId,
    reason,
    description,
    photo,
  } = payload;
  if (!chatId) {
    return;
  }

  const chat = selectChat(global, chatId)!;
  if (!chat || !photo) {
    return;
  }

  const result = await callApi('reportProfilePhoto', {
    peer: chat,
    photo,
    reason,
    description,
  });

  actions.showNotification({
    message: getTranslation(result ? 'ReportPeer.AlertSuccess' : 'ReportPeer.AlertFailure'),
  });
});
