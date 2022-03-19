import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { ManagementProgress } from '../../../types';
import { callApi } from '../../../api/gramjs';
import { updateChat, updateManagement, updateManagementProgress } from '../../reducers';
import { selectChat, selectCurrentMessageList, selectUser } from '../../selectors';
import { isChatBasicGroup } from '../../helpers';

addActionHandler('checkPublicLink', async (global, actions, payload) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  if (!chatId) {
    return undefined;
  }

  // No need to check the username if already in progress
  if (global.management.progress === ManagementProgress.InProgress) {
    return undefined;
  }

  const { username } = payload!;

  global = updateManagementProgress(global, ManagementProgress.InProgress);
  global = updateManagement(global, chatId, { isUsernameAvailable: undefined });
  setGlobal(global);

  const isUsernameAvailable = await callApi('checkChatUsername', { username })!;

  global = getGlobal();
  global = updateManagementProgress(
    global, isUsernameAvailable ? ManagementProgress.Complete : ManagementProgress.Error,
  );
  global = updateManagement(global, chatId, { isUsernameAvailable });
  return global;
});

addActionHandler('updatePublicLink', async (global, actions, payload) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  let chat = chatId && selectChat(global, chatId);
  if (!chatId || !chat) {
    return undefined;
  }

  const { username } = payload!;

  global = updateManagementProgress(global, ManagementProgress.InProgress);
  setGlobal(global);

  if (isChatBasicGroup(chat)) {
    chat = await callApi('migrateChat', chat);

    if (!chat) {
      return undefined;
    }

    actions.openChat({ id: chat.id });
  }

  const result = await callApi('setChatUsername', { chat, username });

  global = getGlobal();
  global = updateManagementProgress(global, result ? ManagementProgress.Complete : ManagementProgress.Error);
  global = updateManagement(global, chatId, { isUsernameAvailable: undefined });
  return global;
});

addActionHandler('updatePrivateLink', (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  const chat = chatId && selectChat(global, chatId);
  if (!chatId || !chat) {
    return;
  }

  callApi('updatePrivateLink', { chat });
});

addActionHandler('setEditingExportedInvite', (global, actions, payload) => {
  const { chatId, invite } = payload;

  setGlobal(updateManagement(global, chatId, { editingInvite: invite }));
});

addActionHandler('setOpenedInviteInfo', (global, actions, payload) => {
  const { chatId, invite } = payload;

  const update = invite ? { inviteInfo: { invite } } : { inviteInfo: undefined };

  setGlobal(updateManagement(global, chatId, update));
});

addActionHandler('loadExportedChatInvites', async (global, actions, payload) => {
  const {
    chatId, adminId, isRevoked, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const admin = selectUser(global, adminId || global.currentUserId);
  if (!peer || !admin) return undefined;

  const result = await callApi('fetchExportedChatInvites', {
    peer, admin, isRevoked, limit,
  });
  if (!result) {
    return undefined;
  }

  const update = isRevoked ? { revokedInvites: result } : { invites: result };

  return updateManagement(getGlobal(), chatId, update);
});

addActionHandler('editExportedChatInvite', async (global, actions, payload) => {
  const {
    chatId, link, isRevoked, expireDate, usageLimit, isRequestNeeded, title,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return undefined;

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
    return undefined;
  }

  const { oldInvite, newInvite } = result;

  global = getGlobal();
  const invites = (global.management.byChatId[chatId].invites || [])
    .filter((current) => current.link !== oldInvite.link);
  const revokedInvites = [...(global.management.byChatId[chatId].revokedInvites || [])];

  if (newInvite.isRevoked) {
    revokedInvites.unshift(newInvite);
  } else {
    invites.push(newInvite);
  }

  return updateManagement(global, chatId, {
    invites,
    revokedInvites,
  });
});

addActionHandler('exportChatInvite', async (global, actions, payload) => {
  const {
    chatId, expireDate, usageLimit, isRequestNeeded, title,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return undefined;

  const result = await callApi('exportChatInvite', {
    peer,
    expireDate,
    usageLimit,
    isRequestNeeded,
    title,
  });
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  const invites = global.management.byChatId[chatId].invites || [];
  return updateManagement(global, chatId, {
    invites: [...invites, result],
  });
});

addActionHandler('deleteExportedChatInvite', async (global, actions, payload) => {
  const {
    chatId, link,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return undefined;

  const result = await callApi('deleteExportedChatInvite', {
    peer,
    link,
  });
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  const managementState = global.management.byChatId[chatId];
  return updateManagement(global, chatId, {
    invites: managementState?.invites?.filter((invite) => invite.link !== link),
    revokedInvites: managementState?.revokedInvites?.filter((invite) => invite.link !== link),
  });
});

addActionHandler('deleteRevokedExportedChatInvites', async (global, actions, payload) => {
  const {
    chatId, adminId,
  } = payload!;
  const peer = selectChat(global, chatId);
  const admin = selectUser(global, adminId || global.currentUserId);
  if (!peer || !admin) return undefined;

  const result = await callApi('deleteRevokedExportedChatInvites', {
    peer,
    admin,
  });
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  return updateManagement(global, chatId, {
    revokedInvites: [],
  });
});

addActionHandler('loadChatInviteImporters', async (global, actions, payload) => {
  const {
    chatId, link, offsetDate, offsetUserId, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = selectUser(global, offsetUserId);
  if (!peer || (offsetUserId && !offsetUser)) return undefined;

  const result = await callApi('fetchChatInviteImporters', {
    peer,
    link,
    offsetDate,
    offsetUser,
    limit,
  });
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  const currentInviteInfo = global.management.byChatId[chatId]?.inviteInfo;
  if (!currentInviteInfo?.invite || currentInviteInfo.invite.link !== link) {
    return undefined;
  }

  return updateManagement(global, chatId, {
    inviteInfo: {
      ...currentInviteInfo,
      importers: result,
    },
  });
});

addActionHandler('loadChatInviteRequesters', async (global, actions, payload) => {
  const {
    chatId, link, offsetDate, offsetUserId, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = selectUser(global, offsetUserId);
  if (!peer || (offsetUserId && !offsetUser)) return undefined;

  const result = await callApi('fetchChatInviteImporters', {
    peer,
    link,
    offsetDate,
    offsetUser,
    limit,
    isRequested: true,
  });
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  const currentInviteInfo = global.management.byChatId[chatId]?.inviteInfo;
  if (!currentInviteInfo?.invite || currentInviteInfo.invite.link !== link) {
    return undefined;
  }

  return updateManagement(global, chatId, {
    inviteInfo: {
      ...currentInviteInfo,
      requesters: result,
    },
  });
});

addActionHandler('loadChatJoinRequests', async (global, actions, payload) => {
  const {
    chatId, offsetDate, offsetUserId, limit,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = selectUser(global, offsetUserId);
  if (!peer || (offsetUserId && !offsetUser)) return undefined;

  const result = await callApi('fetchChatInviteImporters', {
    peer,
    offsetDate,
    offsetUser,
    limit,
    isRequested: true,
  });
  if (!result) {
    return undefined;
  }

  global = getGlobal();
  return updateChat(global, chatId, { joinRequests: result });
});

addActionHandler('hideChatJoinRequest', async (global, actions, payload) => {
  const {
    chatId, userId, isApproved,
  } = payload!;
  const peer = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!peer || !user) return undefined;

  const result = await callApi('hideChatJoinRequest', {
    peer,
    user,
    isApproved,
  });
  if (!result) return undefined;

  global = getGlobal();
  const targetChat = selectChat(global, chatId);
  if (!targetChat) return undefined;

  return updateChat(global, chatId, {
    joinRequests: targetChat.joinRequests?.filter((importer) => importer.userId !== userId),
  });
});

addActionHandler('hideAllChatJoinRequests', async (global, actions, payload) => {
  const {
    chatId, isApproved, link,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return undefined;

  const result = await callApi('hideAllChatJoinRequests', {
    peer,
    isApproved,
    link,
  });
  if (!result) return undefined;

  global = getGlobal();
  const targetChat = selectChat(global, chatId);
  if (!targetChat) return undefined;

  return updateChat(global, chatId, {
    joinRequests: [],
    fullInfo: {
      ...targetChat.fullInfo,
      recentRequesterIds: [],
      requestsPending: 0,
    },
  });
});

addActionHandler('hideChatReportPanel', async (global, actions, payload) => {
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) return undefined;

  const result = await callApi('hideChatReportPanel', chat);
  if (!result) return undefined;

  return updateChat(getGlobal(), chatId, {
    settings: undefined,
  });
});
