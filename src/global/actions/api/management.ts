import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { ManagementProgress } from '../../../types';
import type { ActionReturnType } from '../../types';

import { callApi } from '../../../api/gramjs';
import {
  addUsers, updateChat, updateManagement, updateManagementProgress,
} from '../../reducers';
import {
  selectChat, selectCurrentMessageList, selectTabState, selectUser,
} from '../../selectors';
import { migrateChat } from './chats';
import { getUserFirstOrLastName, isChatBasicGroup } from '../../helpers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import * as langProvider from '../../../util/langProvider';

addActionHandler('checkPublicLink', async (global, actions, payload): Promise<void> => {
  const { username, tabId = getCurrentTabId() } = payload;

  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  if (!chatId) {
    return;
  }

  // No need to check the username if already in progress
  if (selectTabState(global, tabId).management.progress === ManagementProgress.InProgress) {
    return;
  }

  global = updateManagement(
    global, chatId, { isUsernameAvailable: undefined, checkedUsername: undefined }, tabId,
  );
  setGlobal(global);

  const { result, error } = (await callApi('checkChatUsername', { username }))!;

  global = getGlobal();
  global = updateManagementProgress(
    global, result === true ? ManagementProgress.Complete : ManagementProgress.Error, tabId,
  );
  global = updateManagement(global, chatId, {
    isUsernameAvailable: result === true,
    checkedUsername: username,
    error,
  }, tabId);
  setGlobal(global);

  if (result === undefined) {
    actions.openLimitReachedModal({ limit: 'channelsPublic', tabId });
  }
});

addActionHandler('updatePublicLink', async (global, actions, payload): Promise<void> => {
  const { username, tabId = getCurrentTabId() } = payload;

  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  let chat = chatId && selectChat(global, chatId);
  if (!chatId || !chat) {
    return;
  }

  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  if (isChatBasicGroup(chat)) {
    chat = await migrateChat(global, actions, chat, tabId);

    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id, tabId });
  }

  const result = await callApi('setChatUsername', { chat, username });

  global = getGlobal();
  global = updateManagementProgress(global, result ? ManagementProgress.Complete : ManagementProgress.Error, tabId);
  global = updateManagement(global, chatId, {
    isUsernameAvailable: undefined,
    checkedUsername: undefined,
    error: undefined,
  }, tabId);
  setGlobal(global);
});

addActionHandler('updatePrivateLink', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  const chat = chatId && selectChat(global, chatId);
  if (!chatId || !chat) {
    return;
  }

  callApi('updatePrivateLink', { chat });
});

addActionHandler('setEditingExportedInvite', (global, actions, payload): ActionReturnType => {
  const { chatId, invite, tabId = getCurrentTabId() } = payload;

  global = updateManagement(global, chatId, { editingInvite: invite }, tabId);
  setGlobal(global);
});

addActionHandler('setOpenedInviteInfo', (global, actions, payload): ActionReturnType => {
  const { chatId, invite, tabId = getCurrentTabId() } = payload;

  const update = invite ? { inviteInfo: { invite } } : { inviteInfo: undefined };

  global = updateManagement(global, chatId, update, tabId);
  setGlobal(global);
});

addActionHandler('loadExportedChatInvites', async (global, actions, payload): Promise<void> => {
  const {
    chatId, adminId, isRevoked, limit, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  const admin = selectUser(global, adminId || global.currentUserId!);
  if (!peer || !admin) return;

  const result = await callApi('fetchExportedChatInvites', {
    peer, admin, isRevoked, limit,
  });
  if (!result) {
    return;
  }
  global = getGlobal();
  const { invites, users } = result;

  global = addUsers(global, buildCollectionByKey(users, 'id'));

  const update = isRevoked ? { revokedInvites: invites } : { invites };
  global = updateManagement(global, chatId, update, tabId);
  setGlobal(global);
});

addActionHandler('editExportedChatInvite', async (global, actions, payload): Promise<void> => {
  const {
    chatId, link, isRevoked, expireDate, usageLimit, isRequestNeeded, title, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

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

  const { oldInvite, newInvite, users } = result;

  global = getGlobal();
  const { management } = selectTabState(global, tabId);
  const invites = (management.byChatId[chatId].invites || [])
    .filter((current) => current.link !== oldInvite.link);
  const revokedInvites = [...(management.byChatId[chatId].revokedInvites || [])];

  if (newInvite.isRevoked) {
    revokedInvites.unshift(newInvite);
  } else {
    invites.push(newInvite);
  }

  global = addUsers(global, buildCollectionByKey(users, 'id'));

  global = updateManagement(global, chatId, {
    invites,
    revokedInvites,
  }, tabId);
  setGlobal(global);
});

addActionHandler('exportChatInvite', async (global, actions, payload): Promise<void> => {
  const {
    chatId, expireDate, usageLimit, isRequestNeeded, title, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

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
  const invites = selectTabState(global, tabId).management.byChatId[chatId].invites || [];
  global = updateManagement(global, chatId, {
    invites: [...invites, result],
  }, tabId);
  setGlobal(global);
});

addActionHandler('deleteExportedChatInvite', async (global, actions, payload): Promise<void> => {
  const {
    chatId, link, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

  const result = await callApi('deleteExportedChatInvite', {
    peer,
    link,
  });
  if (!result) {
    return;
  }

  global = getGlobal();
  const managementState = selectTabState(global, tabId).management.byChatId[chatId];
  global = updateManagement(global, chatId, {
    invites: managementState?.invites?.filter((invite) => invite.link !== link),
    revokedInvites: managementState?.revokedInvites?.filter((invite) => invite.link !== link),
  }, tabId);
  setGlobal(global);
});

addActionHandler('deleteRevokedExportedChatInvites', async (global, actions, payload): Promise<void> => {
  const {
    chatId, adminId, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  const admin = selectUser(global, adminId || global.currentUserId!);
  if (!peer || !admin) return;

  const result = await callApi('deleteRevokedExportedChatInvites', {
    peer,
    admin,
  });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateManagement(global, chatId, {
    revokedInvites: [],
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadChatInviteImporters', async (
  global, actions, payload,
): Promise<void> => {
  const {
    chatId, link, offsetDate, offsetUserId, limit, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = offsetUserId ? selectUser(global, offsetUserId) : undefined;
  if (!peer || (offsetUserId && !offsetUser)) return;

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
  const { importers, users } = result;

  global = getGlobal();
  const currentInviteInfo = selectTabState(global, tabId).management.byChatId[chatId]?.inviteInfo;
  if (!currentInviteInfo?.invite || currentInviteInfo.invite.link !== link) {
    return;
  }

  global = updateManagement(global, chatId, {
    inviteInfo: {
      ...currentInviteInfo,
      importers,
    },
  }, tabId);
  global = addUsers(global, users);
  setGlobal(global);
});

addActionHandler('loadChatInviteRequesters', async (
  global, actions, payload,
): Promise<void> => {
  const {
    chatId, link, offsetDate, offsetUserId, limit, tabId = getCurrentTabId(),
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = offsetUserId ? selectUser(global, offsetUserId) : undefined;
  if (!peer || (offsetUserId && !offsetUser)) return;

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
  const { importers, users } = result;

  global = getGlobal();
  const currentInviteInfo = selectTabState(global, tabId).management.byChatId[chatId]?.inviteInfo;
  if (!currentInviteInfo?.invite || currentInviteInfo.invite.link !== link) {
    return;
  }
  global = updateManagement(global, chatId, {
    inviteInfo: {
      ...currentInviteInfo,
      requesters: importers,
    },
  }, tabId);
  global = addUsers(global, users);
  setGlobal(global);
});

addActionHandler('loadChatJoinRequests', async (global, actions, payload): Promise<void> => {
  const {
    chatId, offsetDate = 0, offsetUserId, limit = 0,
  } = payload!;
  const peer = selectChat(global, chatId);
  const offsetUser = offsetUserId ? selectUser(global, offsetUserId) : undefined;
  if (!peer || (offsetUserId && !offsetUser)) return;

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
  const { importers, users } = result;

  global = getGlobal();
  global = updateChat(global, chatId, { joinRequests: importers });
  global = addUsers(global, users);
  setGlobal(global);
});

addActionHandler('hideChatJoinRequest', async (global, actions, payload): Promise<void> => {
  const {
    chatId, userId, isApproved,
  } = payload!;
  const peer = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!peer || !user) return;

  const result = await callApi('hideChatJoinRequest', {
    peer,
    user,
    isApproved,
  });
  if (!result) return;

  global = getGlobal();
  const targetChat = selectChat(global, chatId);
  if (!targetChat) return;

  global = updateChat(global, chatId, {
    joinRequests: targetChat.joinRequests?.filter((importer) => importer.userId !== userId),
  });
  setGlobal(global);
});

addActionHandler('hideAllChatJoinRequests', async (global, actions, payload): Promise<void> => {
  const {
    chatId, isApproved, link,
  } = payload!;
  const peer = selectChat(global, chatId);
  if (!peer) return;

  const result = await callApi('hideAllChatJoinRequests', {
    peer,
    isApproved,
    link,
  });
  if (!result) return;

  global = getGlobal();
  const targetChat = selectChat(global, chatId);
  if (!targetChat) return;

  global = updateChat(global, chatId, {
    joinRequests: [],
    fullInfo: {
      ...targetChat.fullInfo,
      recentRequesterIds: [],
      requestsPending: 0,
    },
  });
  setGlobal(global);
});

addActionHandler('hideChatReportPanel', async (global, actions, payload): Promise<void> => {
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('hideChatReportPanel', chat);
  if (!result) return;

  global = getGlobal();
  global = updateChat(global, chatId, {
    settings: undefined,
  });
  setGlobal(global);
});

addActionHandler('uploadContactProfilePhoto', async (global, actions, payload): Promise<void> => {
  const {
    userId, file, isSuggest, tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);
  if (!user) return;

  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  const result = await callApi('uploadContactProfilePhoto', {
    user,
    file,
    isSuggest,
  });

  if (!result) {
    global = getGlobal();
    global = updateManagementProgress(global, ManagementProgress.Error, tabId);
    setGlobal(global);

    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);

  const { id, accessHash } = user;
  const newUser = await callApi('fetchFullUser', { id, accessHash });
  if (!newUser) {
    global = getGlobal();
    global = updateManagementProgress(global, ManagementProgress.Error, tabId);
    setGlobal(global);
    return;
  }

  actions.loadProfilePhotos({ profileId: userId });

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);

  if (file && !isSuggest) {
    actions.showNotification({
      message: langProvider.translate('UserInfo.SetCustomPhoto.SuccessPhotoText', getUserFirstOrLastName(user)),
      tabId,
    });
  }
});
