import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { translate } from '../../../util/langProvider';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { addUsers } from '../../reducers';
import { selectChat } from '../../selectors';

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
      ? translate('ReportPeer.AlertSuccess')
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
      ? translate('ReportPeer.AlertSuccess')
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
  const { hash } = payload!;

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
  const { users, webAuthorizations } = result;
  global = getGlobal();

  global = addUsers(global, buildCollectionByKey(users, 'id'));

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
  const { hash } = payload!;

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
