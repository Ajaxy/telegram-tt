import type { ApiUser } from '../../../api/types';
import type { ActionReturnType } from '../../types';
import { ManagementProgress } from '../../../types';

import { BOT_VERIFICATION_PEERS_LIMIT } from '../../../config';
import { isUserId } from '../../../util/entities/ids';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, unique } from '../../../util/iteratees';
import * as langProvider from '../../../util/oldLangProvider';
import { throttle } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { isUserBot } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addUserStatuses,
  closeNewContactDialog,
  replaceUserStatuses,
  updateChats,
  updateManagementProgress,
  updatePeerPhotos,
  updatePeerPhotosIsLoading,
  updateUser,
  updateUserCommonChats,
  updateUserFullInfo,
  updateUsers,
  updateUserSearch,
  updateUserSearchFetchingStatus,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatFullInfo,
  selectIsChatRestricted,
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectPeer,
  selectPeerPhotos,
  selectTabState,
  selectUser,
  selectUserCommonChats,
  selectUserFullInfo,
} from '../../selectors';

const PROFILE_PHOTOS_FIRST_LOAD_LIMIT = 10;
const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runThrottledForSearch = throttle((cb) => cb(), 500, false);

addActionHandler('loadFullUser', async (global, actions, payload): Promise<void> => {
  const { userId, withPhotos } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const { id, accessHash } = user;
  const result = await callApi('fetchFullUser', { id, accessHash });
  if (!result?.user) return;

  global = getGlobal();
  const fullInfo = selectUserFullInfo(global, userId);
  const { user: newUser, fullInfo: newFullInfo } = result;
  const profilePhotos = selectPeerPhotos(global, userId);
  const hasChangedAvatar = user.avatarPhotoId !== newUser.avatarPhotoId;
  const hasChangedProfilePhoto = fullInfo?.profilePhoto?.id !== newFullInfo?.profilePhoto?.id;
  const hasChangedFallbackPhoto = fullInfo?.fallbackPhoto?.id !== newFullInfo?.fallbackPhoto?.id;
  const hasChangedPersonalPhoto = fullInfo?.personalPhoto?.id !== newFullInfo?.personalPhoto?.id;
  const hasChangedPhoto = hasChangedAvatar
    || hasChangedProfilePhoto
    || hasChangedFallbackPhoto
    || hasChangedPersonalPhoto;

  global = updateUser(global, userId, result.user);
  global = updateUserFullInfo(global, userId, result.fullInfo);
  global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
  global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addUserStatuses(global, result.userStatusesById);

  setGlobal(global);
  if (withPhotos || (profilePhotos?.count && hasChangedPhoto)) {
    actions.loadMoreProfilePhotos({ peerId: userId, shouldInvalidateCache: true });
  }
});

addActionHandler('loadUser', async (global, actions, payload): Promise<void> => {
  const { userId } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('fetchUsers', { users: [user] });
  if (!result) {
    return;
  }

  const { users, userStatusesById } = result;

  global = getGlobal();
  global = updateUsers(global, buildCollectionByKey(users, 'id'));
  global = replaceUserStatuses(global, {
    ...global.users.statusesById,
    ...userStatusesById,
  });
  setGlobal(global);
});

addActionHandler('loadTopUsers', async (global): Promise<void> => {
  const { topPeers: { lastRequestedAt } } = global;

  if (!(!lastRequestedAt || getServerTime() - lastRequestedAt > TOP_PEERS_REQUEST_COOLDOWN)) {
    return;
  }

  const result = await callApi('fetchTopUsers');
  if (!result) {
    return;
  }

  const { ids } = result;

  global = getGlobal();
  global = {
    ...global,
    topPeers: {
      ...global.topPeers,
      userIds: ids,
      lastRequestedAt: getServerTime(),
    },
  };
  setGlobal(global);
});

addActionHandler('loadContactList', async (global): Promise<void> => {
  const contactList = await callApi('fetchContactList');
  if (!contactList) {
    return;
  }

  global = getGlobal();
  global = addUserStatuses(global, contactList.userStatusesById);

  // Sort contact list by Last Name (or First Name), with latin names being placed first
  const getCompareString = (user: ApiUser) => (user.lastName || user.firstName || '');
  const collator = new Intl.Collator('en-US');

  const sortedUsers = contactList.users.sort((a, b) => (
    collator.compare(getCompareString(a), getCompareString(b))
  )).filter((user) => !user.isSelf);

  global = {
    ...global,
    contactList: {
      userIds: sortedUsers.map((user) => user.id),
    },
  };
  setGlobal(global);
});

addActionHandler('loadCurrentUser', (): ActionReturnType => {
  void callApi('fetchCurrentUser');
});

addActionHandler('loadCommonChats', async (global, actions, payload): Promise<void> => {
  const { userId } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    return;
  }

  const user = selectUser(global, userId);
  const commonChats = selectUserCommonChats(global, userId);
  if (!user || isUserBot(user) || commonChats?.isFullyLoaded) {
    return;
  }

  const result = await callApi('fetchCommonChats', {
    user,
    maxId: commonChats?.maxId,
  });
  if (!result) {
    return;
  }

  const { chatIds, count } = result;

  const ids = unique((commonChats?.ids || []).concat(chatIds));

  global = getGlobal();
  global = updateUserCommonChats(global, user.id, {
    maxId: chatIds.length ? chatIds[chatIds.length - 1] : undefined,
    ids,
    isFullyLoaded: ids.length >= count,
  });

  setGlobal(global);
});

addActionHandler('toggleNoPaidMessagesException', async (global, actions, payload): Promise<void> => {
  const { userId, shouldRefundCharged } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('toggleNoPaidMessagesException',
    { user, shouldRefundCharged });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateUserFullInfo(global, userId, {
    settings: undefined,
  });
  setGlobal(global);
});

addActionHandler('openChatRefundModal', async (global, actions, payload): Promise<void> => {
  const { userId, tabId = getCurrentTabId() } = payload;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const starsAmount = await callApi('fetchPaidMessagesRevenue', { user });
  if (starsAmount === undefined) return;

  global = getGlobal();
  global = updateTabState(global, {
    chatRefundModal: {
      userId,
      starsToRefund: starsAmount,
    },
  }, tabId);

  setGlobal(global);
});

addActionHandler('updateContact', async (global, actions, payload): Promise<void> => {
  const {
    userId, firstName, lastName, shouldSharePhoneNumber, note,
    tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  let result;
  if (!user.isContact && user.phoneNumber && !note) {
    result = await callApi('importContact', { phone: user.phoneNumber, firstName, lastName });
  } else {
    const { id, accessHash } = user;
    result = await callApi('updateContact', {
      id,
      accessHash,
      phoneNumber: '',
      firstName,
      lastName,
      shouldSharePhoneNumber,
      note,
    });
  }

  if (result) {
    actions.loadPeerSettings({ peerId: userId });
    actions.loadPeerStories({ peerId: userId });

    global = getGlobal();
    global = updateUser(
      global,
      user.id,
      {
        firstName,
        lastName,
      },
    );
    setGlobal(global);
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  global = closeNewContactDialog(global, tabId);
  setGlobal(global);
});

addActionHandler('updateContactNote', async (global, actions, payload): Promise<void> => {
  const {
    userId, note,
    tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  const result = await callApi('updateContactNote', user, note);

  global = getGlobal();
  if (result) global = updateUserFullInfo(global, userId, { note });
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);
});

addActionHandler('deleteContact', async (global, actions, payload): Promise<void> => {
  const { userId } = payload;

  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  const { id, accessHash } = user;

  await callApi('deleteContact', { id, accessHash });
});

addActionHandler('loadMoreProfilePhotos', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;

  const { peerId, shouldInvalidateCache, isPreload } = payload;
  const isPrivate = isUserId(peerId);

  const user = isPrivate ? selectUser(global, peerId) : undefined;
  const chat = !isPrivate ? selectChat(global, peerId) : undefined;
  const peer = user || chat;

  if (chat && selectIsChatRestricted(global, peerId)) {
    return;
  }
  const profilePhotos = selectPeerPhotos(global, peerId);
  if (!peer?.avatarPhotoId) {
    return;
  }

  if (profilePhotos && !shouldInvalidateCache && (isPreload || !profilePhotos.nextOffset)) return;

  global = updatePeerPhotosIsLoading(global, peerId, true);
  setGlobal(global);

  global = getGlobal();

  let userFullInfo = selectUserFullInfo(global, peerId);
  let chatFullInfo = selectChatFullInfo(global, peerId);
  if (user && !userFullInfo) {
    const { id, accessHash } = user;
    const result = await callApi('fetchFullUser', { id, accessHash });
    if (!result?.user) {
      return;
    }
    userFullInfo = result.fullInfo;
  }

  if (chat && !chatFullInfo) {
    const result = await callApi('fetchFullChat', chat);
    if (!result?.fullInfo) {
      return;
    }

    chatFullInfo = result.fullInfo;
  }

  const peerFullInfo = userFullInfo || chatFullInfo;
  if (!peerFullInfo) return;

  const offset = profilePhotos?.nextOffset;
  const limit = !offset || isPreload || shouldInvalidateCache ? PROFILE_PHOTOS_FIRST_LOAD_LIMIT : undefined;

  const result = await callApi('fetchProfilePhotos', {
    peer,
    offset,
    limit,
  });
  if (!result || !result.photos) {
    return;
  }

  global = getGlobal();

  const {
    photos, count, nextOffsetId,
  } = result;

  global = updatePeerPhotos(global, peerId, {
    newPhotos: photos,
    count,
    nextOffset: nextOffsetId,
    fullInfo: peerFullInfo,
    shouldInvalidateCache,
  });

  setGlobal(global);
});

addActionHandler('setUserSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload;

  if (!query) return;

  void runThrottledForSearch(async () => {
    const result = await callApi('searchChats', { query });

    global = getGlobal();
    const currentSearchQuery = selectTabState(global, tabId).userSearch.query;

    if (!result || !currentSearchQuery || (query !== currentSearchQuery)) {
      global = updateUserSearchFetchingStatus(global, false, tabId);
      setGlobal(global);
      return;
    }

    const {
      accountResultIds, globalResultIds,
    } = result;

    const localUserIds = accountResultIds.filter(isUserId);
    const globalUserIds = globalResultIds.filter(isUserId);

    global = updateUserSearchFetchingStatus(global, false, tabId);
    global = updateUserSearch(global, { localUserIds, globalUserIds }, tabId);

    setGlobal(global);
  });
});

addActionHandler('importContact', async (global, actions, payload): Promise<void> => {
  const {
    phoneNumber: phone, firstName, lastName,
    tabId = getCurrentTabId(),
  } = payload;

  const result = await callApi('importContact', { phone, firstName, lastName });
  if (!result) {
    actions.showNotification({
      message: langProvider.oldTranslate('Contacts.PhoneNumber.NotRegistred'),
      tabId,
    });

    return;
  }

  actions.openChat({ id: result, tabId });

  global = getGlobal();
  global = closeNewContactDialog(global, tabId);
  setGlobal(global);
});

addActionHandler('reportSpam', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;
  const peer = selectPeer(global, chatId);
  if (!peer) {
    return;
  }

  void callApi('reportSpam', peer);
});

addActionHandler('setEmojiStatus', async (global, actions, payload): Promise<void> => {
  const {
    emojiStatus, referrerWebAppKey, tabId = getCurrentTabId(),
  } = payload;

  const isCurrentUserPremium = selectIsCurrentUserPremium(global);
  if (!isCurrentUserPremium) {
    if (referrerWebAppKey) {
      actions.sendWebAppEvent({
        webAppKey: referrerWebAppKey,
        event: {
          eventType: 'emoji_status_failed',
          eventData: {
            error: 'USER_DECLINED',
          },
        },
        tabId,
      });
    }

    actions.openPremiumModal({ initialSection: 'emoji_status', tabId });
    return;
  }

  const result = await callApi('updateEmojiStatus', emojiStatus);

  if (referrerWebAppKey) {
    if (!result) {
      actions.sendWebAppEvent({
        webAppKey: referrerWebAppKey,
        event: {
          eventType: 'emoji_status_failed',
          eventData: {
            error: 'SERVER_ERROR',
          },
        },
        tabId,
      });
      return;
    }

    actions.sendWebAppEvent({
      webAppKey: referrerWebAppKey,
      event: {
        eventType: 'emoji_status_set',
      },
      tabId,
    });
    actions.showNotification({
      message: {
        key: 'BotSuggestedStatusUpdated',
      },
      customEmojiIconId: emojiStatus.documentId,
      tabId,
    });
  }
});

addActionHandler('saveCloseFriends', async (global, actions, payload): Promise<void> => {
  const { userIds } = payload;

  const result = await callApi('saveCloseFriends', userIds);
  if (!result) {
    return;
  }

  global = getGlobal();
  global.contactList?.userIds.forEach((userId) => {
    const { isCloseFriend } = global.users.byId[userId] || {};
    if (isCloseFriend && !userIds.includes(userId)) {
      global = updateUser(global, userId, {
        isCloseFriend: undefined,
      });
    }
  });
  userIds.forEach((userId) => {
    global = updateUser(global, userId, {
      isCloseFriend: true,
    });
  });
  setGlobal(global);
});

addActionHandler('openSuggestedStatusModal', async (global, actions, payload): Promise<void> => {
  const {
    customEmojiId, duration, botId, webAppKey, tabId = getCurrentTabId(),
  } = payload;

  const customEmoji = await callApi('fetchCustomEmoji', {
    documentId: [customEmojiId],
  });
  if (!customEmoji?.[0]) {
    if (webAppKey) {
      actions.sendWebAppEvent({
        webAppKey,
        event: {
          eventType: 'emoji_status_failed',
          eventData: {
            error: 'SUGGESTED_EMOJI_INVALID',
          },
        },
        tabId,
      });
    }
    return;
  }

  global = getGlobal();
  global = updateTabState(global, {
    suggestedStatusModal: {
      customEmojiId,
      duration,
      webAppKey,
      botId,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadPeerSettings', async (global, actions, payload): Promise<void> => {
  const { peerId } = payload;

  if (selectIsCurrentUserFrozen(global)) return;

  const userFullInfo = selectUserFullInfo(global, peerId);
  if (!userFullInfo) {
    actions.loadFullUser({ userId: peerId });
    return;
  }

  const user = selectUser(global, peerId);
  if (!user) {
    return;
  }

  const result = await callApi('fetchPeerSettings', user);
  if (!result) return;

  const { settings } = result;

  global = getGlobal();
  global = updateUserFullInfo(global, peerId, { settings });
  setGlobal(global);
});

addActionHandler('markBotVerificationInfoShown', (global, actions, payload): ActionReturnType => {
  const { peerId } = payload;

  const currentPeerIds = global.settings.botVerificationShownPeerIds;
  const newPeerIds = unique([peerId, ...currentPeerIds]).slice(0, BOT_VERIFICATION_PEERS_LIMIT);

  global = {
    ...global,
    settings: {
      ...global.settings,
      botVerificationShownPeerIds: newPeerIds,
    },
  };

  setGlobal(global);
});
