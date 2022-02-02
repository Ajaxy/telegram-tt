import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { ManagementProgress } from '../../../types';
import { callApi } from '../../../api/gramjs';
import { updateChat, updateManagement, updateManagementProgress } from '../../reducers';
import { selectChat, selectCurrentMessageList, selectUser } from '../../selectors';
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

addReducer('setOpenedInviteInfo', (global, actions, payload) => {
  const { chatId, invite } = payload;

  const update = invite ? { inviteInfo: { invite } } : { inviteInfo: undefined };

  setGlobal(updateManagement(global, chatId, update));
});

addReducer('loadExportedChatInvites', (global, actions, payload) => {
  const {
    chatId, adminId, isRevoked, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const admin = selectUser(global, adminId || global.currentUserId);
  if (!peer || !admin) return;

  (async () => {
    const result = await callApi('fetchExportedChatInvites', {
      peer, admin, isRevoked, limit,
    });
    if (!result) {
      return;
    }
    const update = isRevoked ? { revokedInvites: result } : { invites: result };

    setGlobal(updateManagement(getGlobal(), chatId, update));
  })();
});

addReducer('editExportedChatInvite', (global, actions, payload) => {
  const {
    chatId, link, isRevoked, expireDate, usageLimit, isRequestNeeded, title,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

  (async () => {
    const result = await callApi('editExportedChatInvite', {
      peer,
      link,
      isRevoked,
      expireDate,
      usageLimit,
      isRequestNeeded,
      title,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    let invites = global.management.byChatId[chatId].invites || [];
    const revokedInvites = global.management.byChatId[chatId].revokedInvites || [];
    const { oldInvite, newInvite } = result;
    invites = invites.filter((current) => current.link !== oldInvite.link);
    if (newInvite.isRevoked) {
      revokedInvites.unshift(newInvite);
    } else {
      invites.push(newInvite);
    }
    setGlobal(updateManagement(global, chatId, {
      invites,
      revokedInvites,
    }));
  })();
});

addReducer('exportChatInvite', (global, actions, payload) => {
  const {
    chatId, expireDate, usageLimit, isRequestNeeded, title,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

  (async () => {
    const result = await callApi('exportChatInvite', {
      peer,
      expireDate,
      usageLimit,
      isRequestNeeded,
      title,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    const invites = global.management.byChatId[chatId].invites || [];
    setGlobal(updateManagement(global, chatId, {
      invites: [...invites, result],
    }));
  })();
});

addReducer('deleteExportedChatInvite', (global, actions, payload) => {
  const {
    chatId, link,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

  (async () => {
    const result = await callApi('deleteExportedChatInvite', {
      peer,
      link,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    const managementState = global.management.byChatId[chatId];
    setGlobal(updateManagement(global, chatId, {
      invites: managementState?.invites?.filter((invite) => invite.link !== link),
      revokedInvites: managementState?.revokedInvites?.filter((invite) => invite.link !== link),
    }));
  })();
});

addReducer('deleteRevokedExportedChatInvites', (global, actions, payload) => {
  const {
    chatId, adminId,
  } = payload!;
  const peer = selectChat(global, chatId);
  const admin = selectUser(global, adminId || global.currentUserId);
  if (!peer || !admin) return;

  (async () => {
    const result = await callApi('deleteRevokedExportedChatInvites', {
      peer,
      admin,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    setGlobal(updateManagement(global, chatId, {
      revokedInvites: [],
    }));
  })();
});

addReducer('loadChatInviteImporters', (global, actions, payload) => {
  const {
    chatId, link, offsetDate, offsetUserId, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = selectUser(global, offsetUserId);
  if (!peer || (offsetUserId && !offsetUser)) return;

  (async () => {
    const result = await callApi('fetchChatInviteImporters', {
      peer,
      link,
      offsetDate,
      offsetUser,
      limit,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    const currentInviteInfo = global.management.byChatId[chatId]?.inviteInfo;
    if (!currentInviteInfo?.invite || currentInviteInfo.invite.link !== link) return;
    setGlobal(updateManagement(global, chatId, {
      inviteInfo: {
        ...currentInviteInfo,
        importers: result,
      },
    }));
  })();
});

addReducer('loadChatInviteRequesters', (global, actions, payload) => {
  const {
    chatId, link, offsetDate, offsetUserId, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = selectUser(global, offsetUserId);
  if (!peer || (offsetUserId && !offsetUser)) return;

  (async () => {
    const result = await callApi('fetchChatInviteImporters', {
      peer,
      link,
      offsetDate,
      offsetUser,
      limit,
      isRequested: true,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    const currentInviteInfo = global.management.byChatId[chatId]?.inviteInfo;
    if (!currentInviteInfo?.invite || currentInviteInfo.invite.link !== link) return;
    setGlobal(updateManagement(global, chatId, {
      inviteInfo: {
        ...currentInviteInfo,
        requesters: result,
      },
    }));
  })();
});

addReducer('loadChatJoinRequests', (global, actions, payload) => {
  const {
    chatId, offsetDate, offsetUserId, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = selectUser(global, offsetUserId);
  if (!peer || (offsetUserId && !offsetUser)) return;

  (async () => {
    const result = await callApi('fetchChatInviteImporters', {
      peer,
      offsetDate,
      offsetUser,
      limit,
      isRequested: true,
    });
    if (!result) {
      return;
    }
    global = getGlobal();
    setGlobal(updateChat(global, chatId, { joinRequests: result }));
  })();
});

addReducer('hideChatJoinRequest', (global, actions, payload) => {
  const {
    chatId, userId, isApproved,
  } = payload!;
  const peer = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!peer || !user) return;

  (async () => {
    const result = await callApi('hideChatJoinRequest', {
      peer,
      user,
      isApproved,
    });

    if (!result) return;
    global = getGlobal();
    const targetChat = selectChat(global, chatId);
    if (!targetChat) return;
    setGlobal(updateChat(global, chatId, {
      joinRequests: targetChat.joinRequests?.filter((importer) => importer.userId !== userId),
    }));
  })();
});

addReducer('hideAllChatJoinRequests', (global, actions, payload) => {
  const {
    chatId, isApproved, link,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

  (async () => {
    const result = await callApi('hideAllChatJoinRequests', {
      peer,
      isApproved,
      link,
    });

    if (!result) return;
    global = getGlobal();
    const targetChat = selectChat(global, chatId);
    if (!targetChat) return;

    setGlobal(updateChat(global, chatId, {
      joinRequests: [],
      fullInfo: {
        ...targetChat.fullInfo,
        recentRequesterIds: [],
        requestsPending: 0,
      },
    }));
  })();
});
