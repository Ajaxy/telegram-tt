import type { ApiPrivacySettings, ApiUsername } from '../../../api/types';
import type { ActionReturnType } from '../../types';
import {
  ProfileEditProgress,
  UPLOADING_WALLPAPER_SLUG,
} from '../../../types';

import {
  APP_CONFIG_REFETCH_INTERVAL,
  COUNTRIES_WITH_12H_TIME_FORMAT,
  MUTE_INDEFINITE_TIMESTAMP,
  UNMUTE_TIMESTAMP,
} from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { requestPermission, subscribe, unsubscribe } from '../../../util/notifications';
import { setTimeFormat } from '../../../util/oldLangProvider';
import requestActionTimeout from '../../../util/requestActionTimeout';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { buildApiInputPrivacyRules } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addBlockedUser, addNotifyExceptions, deletePeerPhoto,
  removeBlockedUser, replaceSettings, updateChat,
  updateNotifyDefaults, updateSharedSettings, updateUser, updateUserFullInfo,
} from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat, selectIsCurrentUserFrozen,
  selectTabState, selectUser,
} from '../../selectors';
import { selectSharedSettings } from '../../selectors/sharedState';

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
    await callApi('uploadProfilePhoto', photo);
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
          },
        );
        global = updateUserFullInfo(global, currentUser.id, { bio: about });
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

  if (photo) {
    actions.loadFullUser({ userId: currentUserId, withPhotos: true });
  }
});

addActionHandler('updateProfilePhoto', async (global, actions, payload): Promise<void> => {
  const { photo, isFallback } = payload;
  const { currentUserId } = global;
  if (!currentUserId) return;
  const currentUser = selectUser(global, currentUserId);
  if (!currentUser) return;

  global = updateUser(global, currentUserId, { avatarPhotoId: undefined });
  global = updateUserFullInfo(global, currentUserId, { profilePhoto: undefined });

  setGlobal(global);

  const result = await callApi('updateProfilePhoto', photo, isFallback);
  if (!result) return;

  actions.loadFullUser({ userId: currentUserId, withPhotos: true });
});

addActionHandler('deleteProfilePhoto', async (global, actions, payload): Promise<void> => {
  const { photo } = payload;
  const { currentUserId } = global;
  if (!currentUserId) return;

  const isDeleted = await callApi('deleteProfilePhotos', [photo]);
  if (!isDeleted) return;

  global = getGlobal();
  global = deletePeerPhoto(global, currentUserId, photo.id);
  setGlobal(global);

  actions.loadFullUser({ userId: currentUserId, withPhotos: true });
});

addActionHandler('checkUsername', async (global, actions, payload): Promise<void> => {
  const { username, tabId = getCurrentTabId() } = payload;

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

  const { result, error } = (await callApi('checkUsername', username));

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
            mediaType: 'document',
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

addActionHandler('loadBlockedUsers', async (global): Promise<void> => {
  const result = await callApi('fetchBlockedUsers', {});
  if (!result) return;

  global = getGlobal();

  global = {
    ...global,
    blocked: {
      ids: result.blockedIds,
      totalCount: result.totalCount,
    },
  };

  setGlobal(global);
});

addActionHandler('blockUser', async (global, actions, payload): Promise<void> => {
  const { userId, isOnlyStories } = payload;

  const user = selectUser(global, userId);
  if (!user) return;

  const result = await callApi('blockUser', {
    user,
    isOnlyStories: isOnlyStories || undefined,
  });
  if (!result) return;

  global = getGlobal();
  global = addBlockedUser(global, userId);
  setGlobal(global);
});

addActionHandler('unblockUser', async (global, actions, payload): Promise<void> => {
  const { userId, isOnlyStories } = payload;

  const user = selectUser(global, userId);
  if (!user) return;

  const result = await callApi('unblockUser', {
    user,
    isOnlyStories: isOnlyStories || undefined,
  });
  if (!result) return;

  global = getGlobal();
  global = removeBlockedUser(global, userId);
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
  const [signUpNotification, notifyDefaults] = await Promise.all([
    callApi('fetchContactSignUpSetting'),
    callApi('fetchNotifyDefaultSettings'),
  ]);

  if (!notifyDefaults) return;

  global = getGlobal();
  global = replaceSettings(global, {
    hasContactJoinedNotifications: signUpNotification,
  });
  global = {
    ...global,
    settings: {
      ...global.settings,
      notifyDefaults,
    },
  };
  setGlobal(global);
});

addActionHandler('updateNotificationSettings', async (global, actions, payload): Promise<void> => {
  const { peerType, isMuted, shouldShowPreviews } = payload;

  const result = await callApi('updateNotificationSettings', peerType, { isMuted, shouldShowPreviews });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateNotifyDefaults(global, peerType, {
    mutedUntil: isMuted ? MUTE_INDEFINITE_TIMESTAMP : UNMUTE_TIMESTAMP,
    shouldShowPreviews,
  });
  setGlobal(global);
});

addActionHandler('updateWebNotificationSettings', async (global, actions, payload): Promise<void> => {
  const oldSettings = global.settings.byKey;
  global = replaceSettings(global, payload);
  setGlobal(global);
  const { hasWebNotifications, hasPushNotifications } = global.settings.byKey;
  if (!oldSettings.hasPushNotifications && hasPushNotifications) {
    await subscribe();
  }
  if (oldSettings.hasPushNotifications && !hasPushNotifications) {
    await unsubscribe();
  }
  if (!oldSettings.hasWebNotifications && hasWebNotifications) {
    const isGranted = await requestPermission();
    if (!isGranted) {
      global = getGlobal();
      global = replaceSettings(global, { hasWebNotifications: false });
      setGlobal(global);
    }
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
  global = updateSharedSettings(global, { languages: result });
  setGlobal(global);
});

addActionHandler('loadPrivacySettings', async (global): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;

  const result = await Promise.all([
    callApi('fetchPrivacySettings', 'phoneNumber'),
    callApi('fetchPrivacySettings', 'addByPhone'),
    callApi('fetchPrivacySettings', 'lastSeen'),
    callApi('fetchPrivacySettings', 'profilePhoto'),
    callApi('fetchPrivacySettings', 'forwards'),
    callApi('fetchPrivacySettings', 'chatInvite'),
    callApi('fetchPrivacySettings', 'phoneCall'),
    callApi('fetchPrivacySettings', 'phoneP2P'),
    callApi('fetchPrivacySettings', 'voiceMessages'),
    callApi('fetchPrivacySettings', 'bio'),
    callApi('fetchPrivacySettings', 'birthday'),
    callApi('fetchPrivacySettings', 'gifts'),
    callApi('fetchPrivacySettings', 'noPaidMessages'),
  ]);

  if (result.some((e) => e === undefined)) {
    return;
  }

  const [
    phoneNumberSettings,
    addByPhoneSettings,
    lastSeenSettings,
    profilePhotoSettings,
    forwardsSettings,
    chatInviteSettings,
    phoneCallSettings,
    phoneP2PSettings,
    voiceMessagesSettings,
    bioSettings,
    birthdaySettings,
    giftsSettings,
    noPaidMessagesSettings,
  ] = result as {
    rules: ApiPrivacySettings;
  }[];

  global = getGlobal();
  global = {
    ...global,
    settings: {
      ...global.settings,
      privacy: {
        ...global.settings.privacy,
        phoneNumber: phoneNumberSettings.rules,
        addByPhone: addByPhoneSettings.rules,
        lastSeen: lastSeenSettings.rules,
        profilePhoto: profilePhotoSettings.rules,
        forwards: forwardsSettings.rules,
        chatInvite: chatInviteSettings.rules,
        phoneCall: phoneCallSettings.rules,
        phoneP2P: phoneP2PSettings.rules,
        voiceMessages: voiceMessagesSettings.rules,
        bio: bioSettings.rules,
        birthday: birthdaySettings.rules,
        gifts: giftsSettings.rules,
        noPaidMessages: noPaidMessagesSettings.rules,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('setPrivacyVisibility', async (global, actions, payload): Promise<void> => {
  const { privacyKey, visibility, onSuccess } = payload;

  if (!global.settings.privacy[privacyKey]) {
    const result = await callApi('fetchPrivacySettings', privacyKey);
    if (!result) {
      return;
    }

    global = getGlobal();
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
  }

  const {
    privacy: { [privacyKey]: settings },
  } = global.settings;

  if (!settings) {
    return;
  }

  const rules = buildApiInputPrivacyRules(global, {
    visibility,
    allowedIds: [...settings.allowUserIds, ...settings.allowChatIds],
    blockedIds: [...settings.blockUserIds, ...settings.blockChatIds],
    botsPrivacy: settings.botsPrivacy,
  });

  const result = await callApi('setPrivacySettings', privacyKey, rules);
  if (!result) {
    return;
  }

  onSuccess?.();

  global = getGlobal();
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
  const {
    privacyKey, isAllowList, updatedIds, isPremiumAllowed, botsPrivacy,
  } = payload;
  const {
    privacy: { [privacyKey]: settings },
  } = global.settings;

  if (!settings) {
    return;
  }

  if (privacyKey === 'noPaidMessages') {
    global = getGlobal();
    const idsForUpdate = [
      ...updatedIds.filter((id) => !settings.allowUserIds.includes(id)),
      ...settings.allowUserIds.filter((id) => !updatedIds.includes(id)),
    ];

    idsForUpdate.forEach((userId) => {
      global = updateUserFullInfo(global, userId, {
        settings: undefined,
      });
    });
    setGlobal(global);
  }

  const rules = buildApiInputPrivacyRules(global, {
    visibility: settings.visibility,
    isUnspecified: settings.isUnspecified,
    shouldAllowPremium: isPremiumAllowed,
    allowedIds: isAllowList ? updatedIds : [...settings.allowUserIds, ...settings.allowChatIds],
    blockedIds: !isAllowList ? updatedIds : [...settings.blockUserIds, ...settings.blockChatIds],
    botsPrivacy,
  });

  const result = await callApi('setPrivacySettings', privacyKey, rules);
  if (!result) {
    return;
  }

  global = getGlobal();
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

addActionHandler('updateIsOnline', (global, actions, payload): ActionReturnType => {
  if (global.connectionState !== 'connectionStateReady') return;
  callApi('updateIsOnline', payload.isOnline);
});

addActionHandler('loadContentSettings', async (global): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;

  const result = await callApi('fetchContentSettings');
  if (!result) return;

  global = getGlobal();
  global = replaceSettings(global, result);
  setGlobal(global);
});

addActionHandler('updateContentSettings', async (global, actions, payload): Promise<void> => {
  global = replaceSettings(global, { isSensitiveEnabled: payload.isSensitiveEnabled });
  setGlobal(global);

  const result = await callApi('updateContentSettings', payload.isSensitiveEnabled);
  if (!result) {
    global = getGlobal();
    global = replaceSettings(global, { isSensitiveEnabled: !payload.isSensitiveEnabled });
    setGlobal(global);
  }
});

addActionHandler('loadCountryList', async (global, actions, payload): Promise<void> => {
  let { langCode } = payload;
  if (!langCode) langCode = selectSharedSettings(global).language;

  const countryList = await callApi('fetchCountryList', { langCode });
  if (!countryList) return;

  global = getGlobal();
  global = {
    ...global,
    countryList,
  };
  setGlobal(global);
});

addActionHandler('ensureTimeFormat', async (global, actions): Promise<void> => {
  if (global.authNearestCountry) {
    const timeFormat = COUNTRIES_WITH_12H_TIME_FORMAT
      .has(global.authNearestCountry.toUpperCase()) ? '12h' : '24h';
    actions.setSharedSettingOption({ timeFormat });
    setTimeFormat(timeFormat);
  }

  if (selectSharedSettings(global).wasTimeFormatSetManually) {
    return;
  }

  const nearestCountryCode = await callApi('fetchNearestCountry');
  if (nearestCountryCode) {
    const timeFormat = COUNTRIES_WITH_12H_TIME_FORMAT.has(nearestCountryCode.toUpperCase()) ? '12h' : '24h';
    actions.setSharedSettingOption({ timeFormat });
    setTimeFormat(timeFormat);
  }
});

addActionHandler('loadAppConfig', async (global, actions, payload): Promise<void> => {
  const hash = payload?.hash;

  const appConfig = await callApi('fetchAppConfig', hash);
  if (!appConfig) return;

  requestActionTimeout({
    action: 'loadAppConfig',
    payload: { hash: appConfig.hash },
  }, APP_CONFIG_REFETCH_INTERVAL);

  global = getGlobal();
  global = {
    ...global,
    appConfig,
    isAppConfigLoaded: true,
  };
  setGlobal(global);
});

addActionHandler('loadConfig', async (global): Promise<void> => {
  const config = await callApi('fetchConfig');
  if (!config) return;

  global = getGlobal();
  const timeout = config.expiresAt - getServerTime();
  requestActionTimeout({
    action: 'loadConfig',
    payload: undefined,
  }, timeout * 1000);

  global = {
    ...global,
    config,
  };
  setGlobal(global);
});

addActionHandler('loadPeerColors', async (global): Promise<void> => {
  const generalHash = global.peerColors?.generalHash;
  const profileHash = global.peerColors?.profileHash;
  const [generalResult, profileResult] = await Promise.all([
    callApi('fetchPeerColors', generalHash),
    callApi('fetchPeerProfileColors', profileHash),
  ]);

  if (!generalResult && !profileResult) return;

  global = getGlobal();

  const currentPeerColors = global.peerColors! || {};

  global = {
    ...global,
    peerColors: {
      ...currentPeerColors,
      general: generalResult?.colors || currentPeerColors.general,
      generalHash: generalResult?.hash || currentPeerColors.generalHash,
      profile: profileResult?.colors || currentPeerColors.profile,
      profileHash: profileResult?.hash || currentPeerColors.profileHash,
    },
  };
  setGlobal(global);
});

addActionHandler('loadTimezones', async (global): Promise<void> => {
  const hash = global.timezones?.hash;
  const result = await callApi('fetchTimezones', hash);
  if (!result) return;

  global = getGlobal();
  global = {
    ...global,
    timezones: {
      byId: buildCollectionByKey(result.timezones, 'id'),
      hash: result.hash,
    },
  };
  setGlobal(global);
});

addActionHandler('loadGlobalPrivacySettings', async (global): Promise<void> => {
  const globalSettings = await callApi('fetchGlobalPrivacySettings');
  if (!globalSettings) {
    return;
  }

  global = getGlobal();
  global = replaceSettings(global, { ...globalSettings });
  setGlobal(global);
});

addActionHandler('updateGlobalPrivacySettings', async (global, actions, payload): Promise<void> => {
  const shouldArchiveAndMuteNewNonContact = payload.shouldArchiveAndMuteNewNonContact
    ?? Boolean(global.settings.byKey.shouldArchiveAndMuteNewNonContact);
  const shouldHideReadMarks = payload.shouldHideReadMarks ?? Boolean(global.settings.byKey.shouldHideReadMarks);
  const shouldNewNonContactPeersRequirePremium = payload.shouldNewNonContactPeersRequirePremium
    ?? Boolean(global.settings.byKey.shouldNewNonContactPeersRequirePremium);
    // eslint-disable-next-line no-null/no-null
  const nonContactPeersPaidStars = payload.nonContactPeersPaidStars === null ? undefined
    : payload.nonContactPeersPaidStars || global.settings.byKey.nonContactPeersPaidStars;
  const shouldDisplayGiftsButton = payload.shouldDisplayGiftsButton
    ?? Boolean(global.settings.byKey.shouldDisplayGiftsButton);
  const disallowedGifts = payload.disallowedGifts
    ?? global.settings.byKey.disallowedGifts;

  // eslint-disable-next-line no-null/no-null
  const shouldUpdateUsersSettings = (payload.nonContactPeersPaidStars === null)
    || payload.nonContactPeersPaidStars;

  global = getGlobal();
  global = replaceSettings(global, {
    shouldArchiveAndMuteNewNonContact,
    shouldHideReadMarks,
    shouldNewNonContactPeersRequirePremium,
    nonContactPeersPaidStars,
    shouldDisplayGiftsButton,
    disallowedGifts,
  });
  setGlobal(global);

  const result = await callApi('updateGlobalPrivacySettings', {
    shouldArchiveAndMuteNewNonContact,
    shouldHideReadMarks,
    shouldNewNonContactPeersRequirePremium,
    nonContactPeersPaidStars,
    shouldDisplayGiftsButton,
    disallowedGifts,
  });

  global = getGlobal();
  global = replaceSettings(global, {
    shouldArchiveAndMuteNewNonContact: !result
      ? !shouldArchiveAndMuteNewNonContact
      : result.shouldArchiveAndMuteNewNonContact,
    shouldHideReadMarks: !result ? !shouldHideReadMarks : result.shouldHideReadMarks,
    shouldNewNonContactPeersRequirePremium: !result
      ? !shouldNewNonContactPeersRequirePremium
      : result.shouldNewNonContactPeersRequirePremium,
    nonContactPeersPaidStars: !result
      ? undefined
      : result.nonContactPeersPaidStars,
    shouldDisplayGiftsButton: !result ? !shouldDisplayGiftsButton : result.shouldDisplayGiftsButton,
    disallowedGifts: !result ? disallowedGifts : result.disallowedGifts,
  });

  if (shouldUpdateUsersSettings) {
    Object.keys(global.users.fullInfoById).forEach((userId) => {
      global = updateUserFullInfo(global, userId, {
        settings: undefined,
      });
    });
  }

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
    chatId, username, isActive,
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
    actions.loadFullChat({ chatId });
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
