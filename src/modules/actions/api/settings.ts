import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';
import {
  ApiPrivacyKey, PrivacyVisibility, ProfileEditProgress, InputPrivacyRules, InputPrivacyContact,
  UPLOADING_WALLPAPER_SLUG,
} from '../../../types';

import { callApi } from '../../../api/gramjs';
import { buildCollectionByKey } from '../../../util/iteratees';
import { subscribe, unsubscribe } from '../../../util/notifications';
import { selectUser } from '../../selectors';
import {
  addUsers, addBlockedContact, updateChats, updateUser, removeBlockedContact, replaceSettings, updateNotifySettings,
  addNotifyExceptions,
} from '../../reducers';
import { isUserId } from '../../helpers';

addReducer('updateProfile', (global, actions, payload) => {
  const {
    photo, firstName, lastName, bio: about, username,
  } = payload!;

  (async () => {
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
  })();
});

addReducer('checkUsername', (global, actions, payload) => {
  const { username } = payload!;

  (async () => {
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
  })();
});

addReducer('loadWallpapers', () => {
  (async () => {
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
  })();
});

addReducer('uploadWallpaper', (global, actions, payload) => {
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

  (async () => {
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
  })();
});

addReducer('loadBlockedContacts', () => {
  (async () => {
    const result = await callApi('fetchBlockedContacts');

    if (!result) {
      return;
    }

    let newGlobal = getGlobal();

    if (result.users?.length) {
      newGlobal = addUsers(newGlobal, buildCollectionByKey(result.users, 'id'));
    }
    if (result.chats?.length) {
      newGlobal = updateChats(newGlobal, buildCollectionByKey(result.chats, 'id'));
    }

    newGlobal = {
      ...newGlobal,
      blocked: {
        ...newGlobal.blocked,
        ids: [...(newGlobal.blocked.ids || []), ...result.blockedIds],
        totalCount: result.totalCount,
      },
    };

    setGlobal(newGlobal);
  })();
});

addReducer('blockContact', (global, actions, payload) => {
  const { contactId, accessHash } = payload!;

  (async () => {
    const result = await callApi('blockContact', contactId, accessHash);
    if (!result) {
      return;
    }

    const newGlobal = getGlobal();

    setGlobal(addBlockedContact(newGlobal, contactId));
  })();
});

addReducer('unblockContact', (global, actions, payload) => {
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

  (async () => {
    const result = await callApi('unblockContact', contactId, accessHash);
    if (!result) {
      return;
    }

    const newGlobal = getGlobal();

    setGlobal(removeBlockedContact(newGlobal, contactId));
  })();
});

addReducer('loadAuthorizations', () => {
  (async () => {
    const result = await callApi('fetchAuthorizations');
    if (!result) {
      return;
    }

    setGlobal({
      ...getGlobal(),
      activeSessions: result,
    });
  })();
});

addReducer('terminateAuthorization', (global, actions, payload) => {
  const { hash } = payload!;

  (async () => {
    const result = await callApi('terminateAuthorization', hash);
    if (!result) {
      return;
    }

    const newGlobal = getGlobal();

    setGlobal({
      ...newGlobal,
      activeSessions: newGlobal.activeSessions.filter((session) => session.hash !== hash),
    });
  })();
});

addReducer('terminateAllAuthorizations', () => {
  (async () => {
    const result = await callApi('terminateAllAuthorizations');
    if (!result) {
      return;
    }

    const global = getGlobal();

    setGlobal({
      ...global,
      activeSessions: global.activeSessions.filter((session) => session.isCurrent),
    });
  })();
});

addReducer('loadNotificationExceptions', (global) => {
  const { serverTimeOffset } = global;

  (async () => {
    const result = await callApi('fetchNotificationExceptions', { serverTimeOffset });
    if (!result) {
      return;
    }

    setGlobal(addNotifyExceptions(getGlobal(), result));
  })();
});

addReducer('loadNotificationSettings', (global) => {
  const { serverTimeOffset } = global;
  (async () => {
    const result = await callApi('fetchNotificationSettings', {
      serverTimeOffset,
    });
    if (!result) {
      return;
    }

    setGlobal(replaceSettings(getGlobal(), result));
  })();
});

addReducer('updateNotificationSettings', (global, actions, payload) => {
  const { peerType, isSilent, shouldShowPreviews } = payload!;

  (async () => {
    const result = await callApi('updateNotificationSettings', peerType, { isSilent, shouldShowPreviews });

    if (!result) {
      return;
    }

    setGlobal(updateNotifySettings(getGlobal(), peerType, isSilent, shouldShowPreviews));
  })();
});

addReducer('updateWebNotificationSettings', (global, actions, payload) => {
  (async () => {
    setGlobal(replaceSettings(getGlobal(), payload));
    const newGlobal = getGlobal();
    const { hasPushNotifications, hasWebNotifications } = newGlobal.settings.byKey;
    if (hasWebNotifications && hasPushNotifications) {
      await subscribe();
    } else {
      await unsubscribe();
    }
  })();
});

addReducer('updateContactSignUpNotification', (global, actions, payload) => {
  const { isSilent } = payload!;

  (async () => {
    const result = await callApi('updateContactSignUpNotification', isSilent);
    if (!result) {
      return;
    }

    setGlobal(replaceSettings(getGlobal(), { hasContactJoinedNotifications: !isSilent }));
  })();
});

addReducer('loadLanguages', () => {
  (async () => {
    const result = await callApi('fetchLanguages');
    if (!result) {
      return;
    }

    setGlobal(replaceSettings(getGlobal(), { languages: result }));
  })();
});

addReducer('loadPrivacySettings', () => {
  (async () => {
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

    const global = getGlobal();

    global.settings.privacy.phoneNumber = phoneNumberSettings;
    global.settings.privacy.lastSeen = lastSeenSettings;
    global.settings.privacy.profilePhoto = profilePhotoSettings;
    global.settings.privacy.forwards = forwardsSettings;
    global.settings.privacy.chatInvite = chatInviteSettings;

    setGlobal(global);
  })();
});

addReducer('setPrivacyVisibility', (global, actions, payload) => {
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

  (async () => {
    const result = await callApi('setPrivacySettings', privacyKey, rules);

    if (result) {
      const newGlobal = getGlobal();

      newGlobal.settings.privacy[privacyKey as ApiPrivacyKey] = result;

      setGlobal(newGlobal);
    }
  })();
});

addReducer('setPrivacySettings', (global, actions, payload) => {
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

  (async () => {
    const result = await callApi('setPrivacySettings', privacyKey, rules);

    if (result) {
      const newGlobal = getGlobal();

      newGlobal.settings.privacy[privacyKey as ApiPrivacyKey] = result;

      setGlobal(newGlobal);
    }
  })();
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

addReducer('updateIsOnline', (global, actions, payload) => {
  callApi('updateIsOnline', payload);
});

addReducer('loadContentSettings', () => {
  (async () => {
    const result = await callApi('fetchContentSettings');
    if (!result) return;

    setGlobal(replaceSettings(getGlobal(), result));
  })();
});

addReducer('updateContentSettings', (global, actions, payload) => {
  (async () => {
    setGlobal(replaceSettings(getGlobal(), { isSensitiveEnabled: payload }));

    const result = await callApi('updateContentSettings', payload);
    if (!result) {
      setGlobal(replaceSettings(getGlobal(), { isSensitiveEnabled: !payload }));
    }
  })();
});
