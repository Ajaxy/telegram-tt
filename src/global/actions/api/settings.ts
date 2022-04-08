import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { GlobalState } from '../../types';
import {
  ApiPrivacyKey, PrivacyVisibility, ProfileEditProgress, InputPrivacyRules, InputPrivacyContact,
  UPLOADING_WALLPAPER_SLUG,
} from '../../../types';

import { COUNTRIES_WITH_12H_TIME_FORMAT } from '../../../config';
import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import { subscribe, unsubscribe } from '../../../util/notifications';
import { setTimeFormat } from '../../../util/langProvider';
import { selectUser } from '../../selectors';
import {
  addUsers, addBlockedContact, updateChats, updateUser, removeBlockedContact, replaceSettings, updateNotifySettings,
  addNotifyExceptions,
} from '../../reducers';
import { isUserId } from '../../helpers';

addActionHandler('updateProfile', async (global, actions, payload) => {
  const {
    photo, firstName, lastName, bio: about, username,
  } = payload!;

  const { currentUserId } = global;
  if (!currentUserId) {
    return;
  }

  setGlobal({
    ...getGlobal(),
    profileEdit: {
      progress: ProfileEditProgress.InProgress,
    },
  });

  if (photo) {
    await callApi('updateProfilePhoto', photo);
  }

  if (firstName || lastName || about) {
    const result = await callApi('updateProfile', { firstName, lastName, about });
    if (result) {
      global = getGlobal();
      const currentUser = currentUserId && selectUser(global, currentUserId);

      if (currentUser) {
        setGlobal(updateUser(
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
        ));
      }
    }
  }

  if (username) {
    const result = await callApi('updateUsername', username);
    if (result && currentUserId) {
      setGlobal(updateUser(getGlobal(), currentUserId, { username }));
    }
  }

  setGlobal({
    ...getGlobal(),
    profileEdit: {
      progress: ProfileEditProgress.Complete,
    },
  });
});

addActionHandler('checkUsername', async (global, actions, payload) => {
  const { username } = payload!;

  // No need to check the username if profile update is already in progress
  if (global.profileEdit && global.profileEdit.progress === ProfileEditProgress.InProgress) {
    return;
  }

  setGlobal({
    ...global,
    profileEdit: {
      progress: global.profileEdit ? global.profileEdit.progress : ProfileEditProgress.Idle,
      isUsernameAvailable: undefined,
    },
  });

  const isUsernameAvailable = await callApi('checkUsername', username);

  global = getGlobal();
  setGlobal({
    ...global,
    profileEdit: {
      ...global.profileEdit!,
      isUsernameAvailable,
    },
  });
});

addActionHandler('loadWallpapers', async () => {
  const result = await callApi('fetchWallpapers');
  if (!result) {
    return;
  }

  const global = getGlobal();
  setGlobal({
    ...global,
    settings: {
      ...global.settings,
      loadedWallpapers: result.wallpapers,
    },
  });
});

addActionHandler('uploadWallpaper', async (global, actions, payload) => {
  const file = payload;
  const previewBlobUrl = URL.createObjectURL(file);

  setGlobal({
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
  });

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

  setGlobal({
    ...global,
    settings: {
      ...global.settings,
      loadedWallpapers: [
        withLocalMedia,
        ...global.settings.loadedWallpapers.slice(1),
      ],
    },
  });
});

addActionHandler('loadBlockedContacts', async (global) => {
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

addActionHandler('blockContact', async (global, actions, payload) => {
  const { contactId, accessHash } = payload!;

  const result = await callApi('blockContact', contactId, accessHash);
  if (!result) {
    return;
  }

  setGlobal(addBlockedContact(getGlobal(), contactId));
});

addActionHandler('unblockContact', async (global, actions, payload) => {
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

  setGlobal(removeBlockedContact(getGlobal(), contactId));
});

addActionHandler('loadAuthorizations', async () => {
  const result = await callApi('fetchAuthorizations');
  if (!result) {
    return;
  }

  setGlobal({
    ...getGlobal(),
    activeSessions: result,
  });
});

addActionHandler('terminateAuthorization', async (global, actions, payload) => {
  const { hash } = payload!;

  const result = await callApi('terminateAuthorization', hash);
  if (!result) {
    return;
  }

  global = getGlobal();

  setGlobal({
    ...global,
    activeSessions: global.activeSessions.filter((session) => session.hash !== hash),
  });
});

addActionHandler('terminateAllAuthorizations', async (global) => {
  const result = await callApi('terminateAllAuthorizations');
  if (!result) {
    return;
  }

  global = getGlobal();

  setGlobal({
    ...global,
    activeSessions: global.activeSessions.filter((session) => session.isCurrent),
  });
});

addActionHandler('loadNotificationExceptions', async (global) => {
  const { serverTimeOffset } = global;

  const result = await callApi('fetchNotificationExceptions', { serverTimeOffset });
  if (!result) {
    return;
  }

  setGlobal(addNotifyExceptions(getGlobal(), result));
});

addActionHandler('loadNotificationSettings', async (global) => {
  const { serverTimeOffset } = global;
  const result = await callApi('fetchNotificationSettings', {
    serverTimeOffset,
  });
  if (!result) {
    return;
  }

  setGlobal(replaceSettings(getGlobal(), result));
});

addActionHandler('updateNotificationSettings', async (global, actions, payload) => {
  const { peerType, isSilent, shouldShowPreviews } = payload!;

  const result = await callApi('updateNotificationSettings', peerType, { isSilent, shouldShowPreviews });
  if (!result) {
    return;
  }

  setGlobal(updateNotifySettings(getGlobal(), peerType, isSilent, shouldShowPreviews));
});

addActionHandler('updateWebNotificationSettings', (global, actions, payload) => {
  setGlobal(replaceSettings(global, payload));

  const { hasPushNotifications, hasWebNotifications } = global.settings.byKey;
  if (hasWebNotifications && hasPushNotifications) {
    void subscribe();
  } else {
    void unsubscribe();
  }
});

addActionHandler('updateContactSignUpNotification', async (global, actions, payload) => {
  const { isSilent } = payload!;

  const result = await callApi('updateContactSignUpNotification', isSilent);
  if (!result) {
    return;
  }

  setGlobal(replaceSettings(getGlobal(), { hasContactJoinedNotifications: !isSilent }));
});

addActionHandler('loadLanguages', async () => {
  const result = await callApi('fetchLanguages');
  if (!result) {
    return;
  }

  setGlobal(replaceSettings(getGlobal(), { languages: result }));
});

addActionHandler('loadPrivacySettings', async (global) => {
  const [
    phoneNumberSettings, lastSeenSettings, profilePhotoSettings, forwardsSettings, chatInviteSettings,
  ] = await Promise.all([
    callApi('fetchPrivacySettings', 'phoneNumber'),
    callApi('fetchPrivacySettings', 'lastSeen'),
    callApi('fetchPrivacySettings', 'profilePhoto'),
    callApi('fetchPrivacySettings', 'forwards'),
    callApi('fetchPrivacySettings', 'chatInvite'),
  ]);

  if (
    !phoneNumberSettings || !lastSeenSettings || !profilePhotoSettings || !forwardsSettings || !chatInviteSettings
  ) {
    return;
  }

  global = getGlobal();
  setGlobal({
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        phoneNumber: phoneNumberSettings,
        lastSeen: lastSeenSettings,
        profilePhoto: profilePhotoSettings,
        forwards: forwardsSettings,
        chatInvite: chatInviteSettings,
      },
    },
  });
});

addActionHandler('setPrivacyVisibility', async (global, actions, payload) => {
  const { privacyKey, visibility } = payload!;

  const {
    privacy: { [privacyKey as ApiPrivacyKey]: settings },
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

  setGlobal({
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        [privacyKey]: result,
      },
    },
  });
});

addActionHandler('setPrivacySettings', async (global, actions, payload) => {
  const { privacyKey, isAllowList, contactsIds } = payload!;
  const {
    privacy: { [privacyKey as ApiPrivacyKey]: settings },
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

  setGlobal({
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        [privacyKey]: result,
      },
    },
  });
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

addActionHandler('updateIsOnline', (global, actions, payload) => {
  callApi('updateIsOnline', payload);
});

addActionHandler('loadContentSettings', async () => {
  const result = await callApi('fetchContentSettings');
  if (!result) return;

  setGlobal(replaceSettings(getGlobal(), result));
});

addActionHandler('updateContentSettings', async (global, actions, payload) => {
  setGlobal(replaceSettings(getGlobal(), { isSensitiveEnabled: payload }));

  const result = await callApi('updateContentSettings', payload);
  if (!result) {
    setGlobal(replaceSettings(getGlobal(), { isSensitiveEnabled: !payload }));
  }
});

addActionHandler('loadCountryList', async (global, actions, payload = {}) => {
  let { langCode } = payload;
  if (!langCode) langCode = global.settings.byKey.language;

  const countryList = await callApi('fetchCountryList', { langCode });
  if (!countryList) return;

  setGlobal({
    ...getGlobal(),
    countryList,
  });
});

addActionHandler('ensureTimeFormat', async (global, actions) => {
  if (global.authNearestCountry) {
    const timeFormat = COUNTRIES_WITH_12H_TIME_FORMAT.has(global.authNearestCountry.toUpperCase()) ? '12h' : '24h';
    actions.setSettingOption({ timeFormat });
    setTimeFormat(timeFormat);
  }

  if (global.settings.byKey.wasTimeFormatSetManually) {
    return;
  }

  const nearestCountryCode = await callApi('fetchNearestCountry');
  if (nearestCountryCode) {
    const timeFormat = COUNTRIES_WITH_12H_TIME_FORMAT.has(nearestCountryCode.toUpperCase()) ? '12h' : '24h';
    actions.setSettingOption({ timeFormat });
    setTimeFormat(timeFormat);
  }
});

addActionHandler('loadAppConfig', async () => {
  const appConfig = await callApi('fetchAppConfig');
  if (!appConfig) return;

  setGlobal({
    ...getGlobal(),
    appConfig,
  });
});
