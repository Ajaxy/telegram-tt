import type { ApiAudio } from '../../../api/types';
import type { GlobalState } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { unique } from '../../../util/iteratees';
import { oldTranslate } from '../../../util/oldLangProvider';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateUserFullInfo, updateUserSavedMusic } from '../../reducers';
import { selectChat, selectUserFullInfo, selectUserSavedMusic } from '../../selectors';

addActionHandler('loadSavedMusicIds', async (global): Promise<void> => {
  if (global.users.savedMusicById || global.users.isSavedMusicLoading) return;

  global = updateSavedMusicState(global, undefined, true);
  setGlobal(global);

  const savedMusicIds = await callApi('fetchSavedMusicIds');
  const savedMusicById: Record<string, true> = {};
  savedMusicIds?.forEach((id) => {
    savedMusicById[id] = true;
  });

  global = getGlobal();
  global = updateSavedMusicState(global, savedMusicById, false);
  setGlobal(global);
});

addActionHandler('toggleMusicInProfile', async (global, actions, payload): Promise<void> => {
  const { audio, tabId = getCurrentTabId() } = payload;
  const { savedMusicById } = global.users;
  if (!savedMusicById || global.users.isSavedMusicLoading) return;

  const shouldRemove = Boolean(savedMusicById[audio.id]);

  global = updateSavedMusicState(global, savedMusicById, true);
  setGlobal(global);

  const result = await callApi('saveMusic', { audio, shouldRemove: shouldRemove || undefined });

  global = getGlobal();
  if (!result) {
    global = updateSavedMusicState(global, global.users.savedMusicById, false);
    setGlobal(global);
    actions.showNotification({ message: { key: 'GeneralError' }, tabId });
    return;
  }

  const updatedSavedMusicById = { ...global.users.savedMusicById };
  if (shouldRemove) {
    delete updatedSavedMusicById[audio.id];
  } else {
    updatedSavedMusicById[audio.id] = true;
  }

  global = updateSavedMusicState(global, updatedSavedMusicById, false);
  global = updateOwnProfileMusic(global, audio, shouldRemove);
  setGlobal(global);
  actions.showNotification({
    message: { key: shouldRemove ? 'AudioSaveToMyProfileUnsaved' : 'AudioSaveToMyProfileSaved' },
    tabId,
  });
});

addActionHandler('reportPeer', async (global, actions, payload): Promise<void> => {
  const {
    chatId,
    reason,
    description,
    tabId = getCurrentTabId(),
  } = payload;
  if (!chatId) {
    return;
  }

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
      ? oldTranslate('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
    tabId,
  });
});

addActionHandler('reportProfilePhoto', async (global, actions, payload): Promise<void> => {
  const {
    chatId,
    reason,
    description,
    photo,
    tabId = getCurrentTabId(),
  } = payload;
  if (!chatId) {
    return;
  }

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
      ? oldTranslate('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
    tabId,
  });
});

addActionHandler('loadAuthorizations', async (global): Promise<void> => {
  const result = await callApi('fetchAuthorizations');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    activeSessions: {
      byHash: result.authorizations,
      orderedHashes: Object.keys(result.authorizations),
      ttlDays: result.ttlDays,
    },
  };
  setGlobal(global);
});

addActionHandler('terminateAuthorization', async (global, actions, payload): Promise<void> => {
  const { hash } = payload;

  const result = await callApi('terminateAuthorization', hash);
  if (!result) {
    return;
  }

  global = getGlobal();

  const { [hash]: removedSessions, ...newSessions } = global.activeSessions.byHash;

  global = {
    ...global,
    activeSessions: {
      byHash: newSessions,
      orderedHashes: global.activeSessions.orderedHashes.filter((el) => el !== hash),
    },
  };
  setGlobal(global);
});

addActionHandler('terminateAllAuthorizations', async (global): Promise<void> => {
  const result = await callApi('terminateAllAuthorizations');
  if (!result) {
    return;
  }

  global = getGlobal();
  const currentSessionHash = global.activeSessions.orderedHashes
    .find((hash) => global.activeSessions.byHash[hash].isCurrent);
  if (!currentSessionHash) {
    return;
  }
  const currentSession = global.activeSessions.byHash[currentSessionHash];

  global = {
    ...global,
    activeSessions: {
      byHash: {
        [currentSessionHash]: currentSession,
      },
      orderedHashes: [currentSessionHash],
    },
  };
  setGlobal(global);
});

addActionHandler('changeSessionSettings', async (global, actions, payload): Promise<void> => {
  const {
    hash, areCallsEnabled, areSecretChatsEnabled, isConfirmed,
  } = payload;
  const result = await callApi('changeSessionSettings', {
    hash,
    areCallsEnabled,
    areSecretChatsEnabled,
    isConfirmed,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    activeSessions: {
      ...global.activeSessions,
      byHash: {
        ...global.activeSessions.byHash,
        [hash]: {
          ...global.activeSessions.byHash[hash],
          ...(areCallsEnabled !== undefined ? { areCallsEnabled } : undefined),
          ...(areSecretChatsEnabled !== undefined ? { areSecretChatsEnabled } : undefined),
          ...(isConfirmed && { isUnconfirmed: undefined }),
        },
      },
    },
  };
  setGlobal(global);
});

addActionHandler('changeSessionTtl', async (global, actions, payload): Promise<void> => {
  const { days } = payload;

  const result = await callApi('changeSessionTtl', { days });

  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    activeSessions: {
      ...global.activeSessions,
      ttlDays: days,
    },
  };
  setGlobal(global);
});

addActionHandler('loadWebAuthorizations', async (global): Promise<void> => {
  const result = await callApi('fetchWebAuthorizations');
  if (!result) {
    return;
  }
  const { webAuthorizations } = result;
  global = getGlobal();

  global = {
    ...global,
    activeWebSessions: {
      byHash: webAuthorizations,
      orderedHashes: Object.keys(webAuthorizations),
    },
  };
  setGlobal(global);
});

addActionHandler('terminateWebAuthorization', async (global, actions, payload): Promise<void> => {
  const { hash } = payload;

  const result = await callApi('terminateWebAuthorization', hash);
  if (!result) {
    return;
  }

  global = getGlobal();

  const { [hash]: removedSessions, ...newSessions } = global.activeWebSessions.byHash;

  global = {
    ...global,
    activeWebSessions: {
      byHash: newSessions,
      orderedHashes: global.activeWebSessions.orderedHashes.filter((el) => el !== hash),
    },
  };
  setGlobal(global);
});

addActionHandler('terminateAllWebAuthorizations', async (global): Promise<void> => {
  const result = await callApi('terminateAllWebAuthorizations');
  if (!result) {
    return;
  }

  global = getGlobal();

  global = {
    ...global,
    activeWebSessions: {
      byHash: {},
      orderedHashes: [],
    },
  };
  setGlobal(global);
});

addActionHandler('loadAccountDaysTtl', async (global, actions, payload): Promise<void> => {
  const result = await callApi('fetchAccountTTL');
  if (!result) return;

  global = getGlobal();
  global = {
    ...global,
    settings: {
      ...global.settings,
      accountDaysTtl: result.days,
    },
  };
  setGlobal(global);
});

addActionHandler('setAccountTTL', async (global, actions, payload): Promise<void> => {
  const { days, tabId = getCurrentTabId() } = payload || {};
  if (!days) return;

  const result = await callApi('setAccountTTL', { days });
  if (!result) return;

  global = getGlobal();
  global = {
    ...global,
    settings: {
      ...global.settings,
      accountDaysTtl: days,
    },
  };
  setGlobal(global);
  actions.closeDeleteAccountModal({ tabId });
});

// Keeps the current user's own profile playlist in step with the toggle, so it does not need a refetch
function updateOwnProfileMusic<T extends GlobalState>(global: T, audio: ApiAudio, shouldRemove?: boolean): T {
  const { currentUserId } = global;
  if (!currentUserId || !selectUserFullInfo(global, currentUserId)) return global;

  const savedMusic = selectUserSavedMusic(global, currentUserId);
  if (savedMusic) {
    const byId = { ...savedMusic.byId, [audio.id]: audio };
    let ids: string[];
    if (shouldRemove) {
      delete byId[audio.id];
      ids = savedMusic.ids.filter((id) => id !== audio.id);
    } else {
      ids = unique([audio.id, ...savedMusic.ids]);
    }

    global = updateUserSavedMusic(global, currentUserId, {
      ...savedMusic,
      byId,
      ids,
      count: Math.max(shouldRemove ? savedMusic.count - 1 : savedMusic.count + 1, ids.length),
    });
  }

  if (!shouldRemove) {
    // Newly saved music is put on top of the playlist
    return updateUserFullInfo(global, currentUserId, { savedMusic: audio });
  }

  const remainingIds = selectUserSavedMusic(global, currentUserId)?.ids;
  if (!remainingIds) return global;

  return updateUserFullInfo(global, currentUserId, {
    savedMusic: remainingIds.length
      ? selectUserSavedMusic(global, currentUserId)!.byId[remainingIds[0]]
      : undefined,
  });
}

function updateSavedMusicState<T extends GlobalState>(
  global: T,
  savedMusicById: Record<string, true> | undefined,
  isSavedMusicLoading: boolean,
): T {
  return {
    ...global,
    users: {
      ...global.users,
      savedMusicById,
      isSavedMusicLoading,
    },
  };
}
