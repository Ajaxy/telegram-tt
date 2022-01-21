import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { ManagementProgress } from '../../../types';
import { callApi } from '../../../api/gramjs';
import { updateManagement, updateManagementProgress } from '../../reducers';
import { selectChat, selectCurrentMessageList } from '../../selectors';
import { isChatBasicGroup } from '../../helpers';

addReducer('checkPublicLink', (global, actions, payload) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  if (!chatId) {
    return;
  }

  // No need to check the username if already in progress
  if (global.management.progress === ManagementProgress.InProgress) {
    return;
  }

  const { username } = payload!;

  (async () => {
    global = updateManagementProgress(global, ManagementProgress.InProgress);
    global = updateManagement(global, chatId, { isUsernameAvailable: undefined });
    setGlobal(global);

    const isUsernameAvailable = await callApi('checkChatUsername', { username })!;

    global = getGlobal();
    global = updateManagementProgress(
      global, isUsernameAvailable ? ManagementProgress.Complete : ManagementProgress.Error,
    );
    global = updateManagement(global, chatId, { isUsernameAvailable });
    setGlobal(global);
  })();
});

addReducer('updatePublicLink', (global, actions, payload) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  let chat = chatId && selectChat(global, chatId);
  if (!chatId || !chat) {
    return;
  }

  const { username } = payload!;

  (async () => {
    global = updateManagementProgress(global, ManagementProgress.InProgress);
    setGlobal(global);

    if (isChatBasicGroup(chat)) {
      chat = await callApi('migrateChat', chat);

      if (!chat) {
        return;
      }

      actions.openChat({ id: chat.id });
    }

    const result = await callApi('setChatUsername', { chat, username });

    global = getGlobal();
    global = updateManagementProgress(global, result ? ManagementProgress.Complete : ManagementProgress.Error);
    global = updateManagement(global, chatId, { isUsernameAvailable: undefined });
    setGlobal(global);
  })();
});

addReducer('updatePrivateLink', (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  const chat = chatId && selectChat(global, chatId);
  if (!chatId || !chat) {
    return;
  }

  callApi('updatePrivateLink', { chat });
});

addReducer('setEditingExportedInvite', (global, actions, payload) => {
  const { chatId, invite } = payload;

  setGlobal(updateManagement(global, chatId, { editingInvite: invite }));
});
