import { addActionHandler, getGlobal, setGlobal } from '../../index';

import type { ActionReturnType, GlobalState } from '../../types';
import type {
  PrivacyVisibility, InputPrivacyRules, InputPrivacyContact, ApiPrivacySettings,
} from '../../../types';
import type { ApiUser, ApiUsername } from '../../../api/types';
import {
  ProfileEditProgress,
  UPLOADING_WALLPAPER_SLUG,
} from '../../../types';

import { APP_CONFIG_REFETCH_INTERVAL, COUNTRIES_WITH_12H_TIME_FORMAT } from '../../../config';
import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import { subscribe, unsubscribe } from '../../../util/notifications';
import { setTimeFormat } from '../../../util/langProvider';
import requestActionTimeout from '../../../util/requestActionTimeout';
import { getServerTime } from '../../../util/serverTime';
import { selectChat, selectUser, selectTabState } from '../../selectors';
import {
  addUsers, addBlockedContact, updateChats, updateUser, removeBlockedContact, replaceSettings, updateNotifySettings,
  addNotifyExceptions, updateChat,
} from '../../reducers';
import { isUserId } from '../../helpers';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('updateProfile', async (global, actions, payload): Promise<void> => {
  const {
    photo, firstName, lastName, bio: about, username,
    tabId = getCurrentTabId(),
  } = payload;

  const { currentUserId } = global;
  if (!currentUserId) {
    return;
  }

  global = updateTabState(global, {
    profileEdit: {
      progress: ProfileEditProgress.InProgress,
    },
  }, tabId);
  setGlobal(global);

  if (photo) {
    const result = await callApi('uploadProfilePhoto', photo);
    if (result) {
      global = getGlobal();
      global = addUsers(global, buildCollectionByKey(result.users, 'id'));
      setGlobal(global);
      actions.loadProfilePhotos({ profileId: currentUserId });
    }
  }

  if (firstName || lastName || about) {
    const result = await callApi('updateProfile', { firstName, lastName, about });
    if (result) {
      global = getGlobal();
      const currentUser = currentUserId && selectUser(global, currentUserId);

      if (currentUser) {
        global = updateUser(
          global,
          currentUser.id,
          {
            firstName,
            lastName,
            fullInfo: {
              ...currentUser.fullInfo,
              bio: about,
            },
          },
        );
        setGlobal(global);
      }
    }
  }

  if (username !== undefined) {
    const result = await callApi('updateUsername', username);
    global = getGlobal();
    const currentUser = currentUserId && selectUser(global, currentUserId);

    if (result && currentUser) {
      const shouldUsernameUpdate = currentUser.usernames?.find((u) => u.isEditable);
      const usernames = shouldUsernameUpdate
        ? currentUser.usernames?.map((u) => (u.isEditable ? { ...u, username } : u))
        : [{ username, isEditable: true, isActive: true } as ApiUsername, ...currentUser.usernames || []];
      global = updateUser(global, currentUserId, { usernames });
      setGlobal(global);
    }
  }

  global = getGlobal();
  global = updateTabState(global, {
    profileEdit: {
      progress: ProfileEditProgress.Complete,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('updateProfilePhoto', async (global, actions, payload): Promise<void> => {
  const { photo, isFallback } = payload;
  const { currentUserId } = global;
  if (!currentUserId) return;
  const currentUser = selectChat(global, currentUserId);
  if (!currentUser) return;

  global = updateUser(global, currentUserId, {
    avatarHash: undefined,
    fullInfo: {
      ...currentUser.fullInfo,
      profilePhoto: undefined,
    },
  });
  setGlobal(global);

  const result = await callApi('updateProfilePhoto', photo, isFallback);
  if (!result) return;

  const { photo: newPhoto, users } = result;
  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(users, 'id'));

  global = updateUser(global, currentUserId, {
    avatarHash: newPhoto.id,
    fullInfo: {
      ...currentUser.fullInfo,
      profilePhoto: newPhoto,
    },
  });
  setGlobal(global);

  actions.loadFullUser({ userId: currentUserId });
  actions.loadProfilePhotos({ profileId: currentUserId });
});

addActionHandler('deleteProfilePhoto', async (global, actions, payload): Promise<void> => {
  const { photo } = payload;
  const { currentUserId } = global;
  if (!currentUserId) return;
  const currentUser = selectChat(global, currentUserId);
  if (!currentUser) return;
  if (currentUser.avatarHash === photo.id) {
    global = updateUser(global, currentUserId, {
      avatarHash: undefined,
      fullInfo: {
        ...currentUser.fullInfo,
        profilePhoto: undefined,
      },
    });
    setGlobal(global);
  }
  const result = await callApi('deleteProfilePhotos', [photo]);
  if (!result) return;
  actions.loadFullUser({ userId: currentUserId });
  actions.loadProfilePhotos({ profileId: currentUserId });
});

addActionHandler('checkUsername', async (global, actions, payload): Promise<void> => {
  const { username, tabId = getCurrentTabId() } = payload!;

  let tabState = selectTabState(global, tabId);
  // No need to check the username if profile update is already in progress
  if (tabState.profileEdit && tabState.profileEdit.progress === ProfileEditProgress.InProgress) {
    return;
  }

  global = updateTabState(global, {
    profileEdit: {
      progress: tabState.profileEdit ? tabState.profileEdit.progress : ProfileEditProgress.Idle,
      checkedUsername: undefined,
      isUsernameAvailable: undefined,
      error: undefined,
    },
  }, tabId);
  setGlobal(global);

  const { result, error } = (await callApi('checkUsername', username))!;

  global = getGlobal();
  tabState = selectTabState(global, tabId);
  global = updateTabState(global, {
    profileEdit: {
      ...tabState.profileEdit!,
      checkedUsername: username,
      isUsernameAvailable: result === true,
      error,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadWallpapers', async (global): Promise<void> => {
  const result = await callApi('fetchWallpapers');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    settings: {
      ...global.settings,
      loadedWallpapers: result.wallpapers,
    },
  };
  setGlobal(global);
});

addActionHandler('uploadWallpaper', async (global, actions, payload): Promise<void> => {
  const file = payload;
  const previewBlobUrl = URL.createObjectURL(file);

  global = {
    ...global,
    settings: {
      ...global.settings,
      loadedWallpapers: [
        {
          slug: UPLOADING_WALLPAPER_SLUG,
          document: {
            fileName: '',
            size: file.size,
            mimeType: file.type,
            previewBlobUrl,
          },
        },
        ...(global.settings.loadedWallpapers || []),
      ],
    },
  };
  setGlobal(global);

  const result = await callApi('uploadWallpaper', file);
  if (!result) {
    return;
  }

  const { wallpaper } = result;

  global = getGlobal();
  if (!global.settings.loadedWallpapers) {
    return;
  }

  const firstWallpaper = global.settings.loadedWallpapers[0];
  if (!firstWallpaper || firstWallpaper.slug !== UPLOADING_WALLPAPER_SLUG) {
    return;
  }

  const withLocalMedia = {
    ...wallpaper,
    document: {
      ...wallpaper.document,
      previewBlobUrl,
    },
  };

  global = {
    ...global,
    settings: {
      ...global.settings,
      loadedWallpapers: [
        withLocalMedia,
        ...global.settings.loadedWallpapers.slice(1),
      ],
    },
  };
  setGlobal(global);
});

addActionHandler('loadBlockedContacts', async (global): Promise<void> => {
  const result = await callApi('fetchBlockedContacts');
  if (!result) {
    return;
  }

  global = getGlobal();

  if (result.users?.length) {
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  }
  if (result.chats?.length) {
    global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
  }

  global = {
    ...global,
    blocked: {
      ...global.blocked,
      ids: [...(global.blocked.ids || []), ...result.blockedIds],
      totalCount: result.totalCount,
    },
  };

  setGlobal(global);
});

addActionHandler('blockContact', async (global, actions, payload): Promise<void> => {
  const { contactId, accessHash } = payload!;

  const result = await callApi('blockContact', contactId, accessHash);
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addBlockedContact(global, contactId);
  setGlobal(global);
});

addActionHandler('unblockContact', async (global, actions, payload): Promise<void> => {
  const { contactId } = payload!;
  let accessHash: string | undefined;
  const isPrivate = isUserId(contactId);

  if (isPrivate) {
    const user = selectUser(global, contactId);
    if (!user) {
      return;
    }

    accessHash = user.accessHash;
  }

  const result = await callApi('unblockContact', contactId, accessHash);
  if (!result) {
    return;
  }

  global = getGlobal();
  global = removeBlockedContact(global, contactId);
  setGlobal(global);
});

addActionHandler('loadNotificationExceptions', async (global): Promise<void> => {
  const result = await callApi('fetchNotificationExceptions');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addNotifyExceptions(global, result);
  setGlobal(global);
});

addActionHandler('loadNotificationSettings', async (global): Promise<void> => {
  const result = await callApi('fetchNotificationSettings');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = replaceSettings(global, result);
  setGlobal(global);
});

addActionHandler('updateNotificationSettings', async (global, actions, payload): Promise<void> => {
  const { peerType, isSilent, shouldShowPreviews } = payload!;

  const result = await callApi('updateNotificationSettings', peerType, { isSilent, shouldShowPreviews });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateNotifySettings(global, peerType, isSilent, shouldShowPreviews);
  setGlobal(global);
});

addActionHandler('updateWebNotificationSettings', (global, actions, payload): ActionReturnType => {
  global = replaceSettings(global, payload);
  setGlobal(global);

  const { hasPushNotifications, hasWebNotifications } = global.settings.byKey;
  if (hasWebNotifications && hasPushNotifications) {
    void subscribe();
  } else {
    void unsubscribe();
  }
});

addActionHandler('updateContactSignUpNotification', async (global, actions, payload): Promise<void> => {
  const { isSilent } = payload;

  const result = await callApi('updateContactSignUpNotification', isSilent);
  if (!result) {
    return;
  }

  global = getGlobal();
  global = replaceSettings(global, { hasContactJoinedNotifications: !isSilent });
  setGlobal(global);
});

addActionHandler('loadLanguages', async (global): Promise<void> => {
  const result = await callApi('fetchLanguages');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = replaceSettings(global, { languages: result });
  setGlobal(global);
});

addActionHandler('loadPrivacySettings', async (global): Promise<void> => {
  const result = await Promise.all([
    callApi('fetchPrivacySettings', 'phoneNumber'),
    callApi('fetchPrivacySettings', 'lastSeen'),
    callApi('fetchPrivacySettings', 'profilePhoto'),
    callApi('fetchPrivacySettings', 'forwards'),
    callApi('fetchPrivacySettings', 'chatInvite'),
    callApi('fetchPrivacySettings', 'phoneCall'),
    callApi('fetchPrivacySettings', 'phoneP2P'),
    callApi('fetchPrivacySettings', 'voiceMessages'),
  ]);

  if (result.some((e) => e === undefined)) {
    return;
  }

  const [
    phoneNumberSettings,
    lastSeenSettings,
    profilePhotoSettings,
    forwardsSettings,
    chatInviteSettings,
    phoneCallSettings,
    phoneP2PSettings,
    voiceMessagesSettings,
  ] = result as {
    users: ApiUser[];
    rules: ApiPrivacySettings;
  }[];

  const allUsers = result.flatMap((e) => e!.users);

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(allUsers, 'id'));
  global = {
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        phoneNumber: phoneNumberSettings.rules,
        lastSeen: lastSeenSettings.rules,
        profilePhoto: profilePhotoSettings.rules,
        forwards: forwardsSettings.rules,
        chatInvite: chatInviteSettings.rules,
        phoneCall: phoneCallSettings.rules,
        phoneP2P: phoneP2PSettings.rules,
        voiceMessages: voiceMessagesSettings.rules,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('setPrivacyVisibility', async (global, actions, payload): Promise<void> => {
  const { privacyKey, visibility } = payload!;

  const {
    privacy: { [privacyKey]: settings },
  } = global.settings;

  if (!settings) {
    return;
  }

  const rules = buildInputPrivacyRules(global, {
    visibility,
    allowedIds: [...settings.allowUserIds, ...settings.allowChatIds],
    deniedIds: [...settings.blockUserIds, ...settings.blockChatIds],
  });

  const result = await callApi('setPrivacySettings', privacyKey, rules);
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = {
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        [privacyKey]: result.rules,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('setPrivacySettings', async (global, actions, payload): Promise<void> => {
  const { privacyKey, isAllowList, contactsIds } = payload!;
  const {
    privacy: { [privacyKey]: settings },
  } = global.settings;

  if (!settings) {
    return;
  }

  const rules = buildInputPrivacyRules(global, {
    visibility: settings.visibility,
    allowedIds: isAllowList ? contactsIds : [...settings.allowUserIds, ...settings.allowChatIds],
    deniedIds: !isAllowList ? contactsIds : [...settings.blockUserIds, ...settings.blockChatIds],
  });

  const result = await callApi('setPrivacySettings', privacyKey, rules);
  if (!result) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = {
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        [privacyKey]: result.rules,
      },
    },
  };
  setGlobal(global);
});

function buildInputPrivacyRules(global: GlobalState, {
  visibility,
  allowedIds,
  deniedIds,
}: {
  visibility: PrivacyVisibility;
  allowedIds: string[];
  deniedIds: string[];
}): InputPrivacyRules {
  const {
    users: { byId: usersById },
    chats: { byId: chatsById },
  } = global;

  const rules: InputPrivacyRules = {
    visibility,
  };
  let users: InputPrivacyContact[];
  let chats: InputPrivacyContact[];

  const collectUsers = (userId: string) => {
    if (!isUserId(userId)) {
      return undefined;
    }
    const { id, accessHash } = usersById[userId] || {};
    if (!id) {
      return undefined;
    }

    return { id, accessHash };
  };

  const collectChats = (userId: string) => {
    if (isUserId(userId)) {
      return undefined;
    }
    const chat = chatsById[userId];

    return chat ? { id: chat.id } : undefined;
  };

  if (visibility === 'contacts' || visibility === 'nobody') {
    users = allowedIds.map(collectUsers).filter(Boolean) as InputPrivacyContact[];
    chats = allowedIds.map(collectChats).filter(Boolean) as InputPrivacyContact[];

    if (users.length > 0) {
      rules.allowedUsers = users;
    }
    if (chats.length > 0) {
      rules.allowedChats = chats;
    }
  }

  if (visibility === 'everybody' || visibility === 'contacts') {
    users = deniedIds.map(collectUsers).filter(Boolean) as InputPrivacyContact[];
    chats = deniedIds.map(collectChats).filter(Boolean) as InputPrivacyContact[];

    if (users.length > 0) {
      rules.blockedUsers = users;
    }
    if (chats.length > 0) {
      rules.blockedChats = chats;
    }
  }

  return rules;
}

addActionHandler('updateIsOnline', (global, actions, payload): ActionReturnType => {
  callApi('updateIsOnline', payload);
});

addActionHandler('loadContentSettings', async (global): Promise<void> => {
  const result = await callApi('fetchContentSettings');
  if (!result) return;

  global = getGlobal();
  global = replaceSettings(global, result);
  setGlobal(global);
});

addActionHandler('updateContentSettings', async (global, actions, payload): Promise<void> => {
  global = replaceSettings(global, { isSensitiveEnabled: payload });
  setGlobal(global);

  const result = await callApi('updateContentSettings', payload);
  if (!result) {
    global = getGlobal();
    global = replaceSettings(global, { isSensitiveEnabled: !payload });
    setGlobal(global);
  }
});

addActionHandler('loadCountryList', async (global, actions, payload): Promise<void> => {
  let { langCode } = payload;
  if (!langCode) langCode = global.settings.byKey.language;

  const countryList = await callApi('fetchCountryList', { langCode });
  if (!countryList) return;

  global = getGlobal();
  global = {
    ...global,
    countryList,
  };
  setGlobal(global);
});

addActionHandler('ensureTimeFormat', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  if (global.authNearestCountry) {
    const timeFormat = COUNTRIES_WITH_12H_TIME_FORMAT
      .has(global.authNearestCountry.toUpperCase()) ? '12h' : '24h';
    actions.setSettingOption({ timeFormat, tabId });
    setTimeFormat(timeFormat);
  }

  if (global.settings.byKey.wasTimeFormatSetManually) {
    return;
  }

  const nearestCountryCode = await callApi('fetchNearestCountry');
  if (nearestCountryCode) {
    const timeFormat = COUNTRIES_WITH_12H_TIME_FORMAT.has(nearestCountryCode.toUpperCase()) ? '12h' : '24h';
    actions.setSettingOption({ timeFormat, tabId });
    setTimeFormat(timeFormat);
  }
});

addActionHandler('loadAppConfig', async (global): Promise<void> => {
  const appConfig = await callApi('fetchAppConfig');
  if (!appConfig) return;

  requestActionTimeout('loadAppConfig', APP_CONFIG_REFETCH_INTERVAL);

  global = getGlobal();
  global = {
    ...global,
    appConfig,
  };
  setGlobal(global);
});

addActionHandler('loadConfig', async (global): Promise<void> => {
  const config = await callApi('fetchConfig');
  if (!config) return;

  global = getGlobal();
  const timeout = config.expiresAt - getServerTime();
  requestActionTimeout('loadConfig', timeout * 1000);

  global = {
    ...global,
    config,
  };
  setGlobal(global);
});

addActionHandler('loadGlobalPrivacySettings', async (global): Promise<void> => {
  const globalSettings = await callApi('fetchGlobalPrivacySettings');
  if (!globalSettings) {
    return;
  }

  global = getGlobal();
  global = replaceSettings(global, {
    shouldArchiveAndMuteNewNonContact: globalSettings.shouldArchiveAndMuteNewNonContact,
  });
  setGlobal(global);
});

addActionHandler('updateGlobalPrivacySettings', async (global, actions, payload): Promise<void> => {
  const { shouldArchiveAndMuteNewNonContact } = payload;
  global = replaceSettings(global, { shouldArchiveAndMuteNewNonContact });
  setGlobal(global);

  const result = await callApi('updateGlobalPrivacySettings', { shouldArchiveAndMuteNewNonContact });

  global = getGlobal();
  global = replaceSettings(global, {
    shouldArchiveAndMuteNewNonContact: !result
      ? !shouldArchiveAndMuteNewNonContact
      : result.shouldArchiveAndMuteNewNonContact,
  });
  setGlobal(global);
});

addActionHandler('toggleUsername', async (global, actions, payload): Promise<void> => {
  const { username, isActive } = payload;
  const { currentUserId } = global;
  if (!currentUserId) {
    return;
  }

  const currentUser = selectUser(global, currentUserId);
  if (!currentUser?.usernames) {
    return;
  }

  const usernames = currentUser.usernames.map((item) => {
    if (item.username !== username) {
      return item;
    }

    return { ...item, isActive: isActive || undefined };
  });

  global = updateUser(global, currentUserId, { usernames });
  setGlobal(global);

  const result = await callApi('toggleUsername', { username, isActive });

  if (!result) {
    actions.loadFullUser({ userId: currentUserId });
  }
});

addActionHandler('toggleChatUsername', async (global, actions, payload): Promise<void> => {
  const {
    chatId, username, isActive, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat?.usernames) {
    return;
  }

  const usernames = chat.usernames.map((item) => {
    if (item.username !== username) {
      return item;
    }

    return { ...item, isActive: isActive || undefined };
  });

  global = updateChat(global, chatId, { usernames });
  setGlobal(global);

  const result = await callApi('toggleUsername', {
    chatId: chat.id,
    accessHash: chat.accessHash,
    username,
    isActive,
  });

  if (!result) {
    actions.loadFullChat({ chatId, tabId });
  }
});

addActionHandler('sortUsernames', async (global, actions, payload): Promise<void> => {
  const { usernames } = payload;
  const { currentUserId } = global;
  if (!currentUserId) {
    return;
  }

  const result = await callApi('reorderUsernames', { usernames });

  // After saving the order of usernames, server sends an update with the necessary data,
  // so there is no need to update the state in this place
  if (!result) {
    actions.loadUser({ userId: currentUserId });
  }
});

addActionHandler('sortChatUsernames', async (global, actions, payload): Promise<void> => {
  const { chatId, usernames } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const prevUsernames = [...chat.usernames!];
  const sortedUsernames = chat.usernames!.reduce((res, currentUsername) => {
    const idx = usernames.findIndex((username) => username === currentUsername.username);
    res[idx] = currentUsername;

    return res;
  }, [] as ApiUsername[]);

  global = updateChat(global, chatId, { usernames: sortedUsernames });
  setGlobal(global);

  const result = await callApi('reorderUsernames', {
    chatId: chat.id,
    accessHash: chat.accessHash,
    usernames,
  });

  if (!result) {
    global = getGlobal();
    global = updateChat(global, chatId, { usernames: prevUsernames });
    setGlobal(global);
  }
});
