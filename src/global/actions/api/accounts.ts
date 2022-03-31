import { addActionHandler } from '../../index';
import { selectChat } from '../../selectors';
import { callApi } from '../../../api/gramjs';

addActionHandler('reportPeer', async (global, actions, payload) => {
  const {
    chatId,
    reason,
    description,
  } = payload!;

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
    message: result
      ? 'Thank you! Your report will be reviewed by our team.'
      : 'Error occurred while submitting report. Please, try again later.',
  });
});

addActionHandler('reportProfilePhoto', async (global, actions, payload) => {
  const {
    chatId,
    reason,
    description,
    photo,
  } = payload!;

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
    message: result
      ? 'Thank you! Your report will be reviewed by our team.'
      : 'Error occurred while submitting report. Please, try again later.',
  });
});
