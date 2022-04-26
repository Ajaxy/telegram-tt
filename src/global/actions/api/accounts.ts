import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { selectChat } from '../../selectors';
import { callApi } from '../../../api/gramjs';
import { getTranslation } from '../../../util/langProvider';

addActionHandler('reportPeer', async (global, actions, payload) => {
  const {
    chatId,
    reason,
    description,
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
      ? getTranslation('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
  });
});

addActionHandler('reportProfilePhoto', async (global, actions, payload) => {
  const {
    chatId,
    reason,
    description,
    photo,
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
      ? getTranslation('ReportPeer.AlertSuccess')
      : 'An error occurred while submitting your report. Please, try again later.',
  });
});

addActionHandler('loadAuthorizations', async () => {
  const result = await callApi('fetchAuthorizations');
  if (!result) {
    return;
  }

  setGlobal({
    ...getGlobal(),
    activeSessions: {
      byHash: result.authorizations,
      orderedHashes: Object.keys(result.authorizations),
      ttlDays: result.ttlDays,
    },
  });
});

addActionHandler('terminateAuthorization', async (global, actions, payload) => {
  const { hash } = payload!;

  const result = await callApi('terminateAuthorization', hash);
  if (!result) {
    return;
  }

  global = getGlobal();

  const { [hash]: removedSessions, ...newSessions } = global.activeSessions.byHash;

  setGlobal({
    ...global,
    activeSessions: {
      byHash: newSessions,
      orderedHashes: global.activeSessions.orderedHashes.filter((el) => el !== hash),
    },
  });
});

addActionHandler('terminateAllAuthorizations', async (global) => {
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

  setGlobal({
    ...global,
    activeSessions: {
      byHash: {
        [currentSessionHash]: currentSession,
      },
      orderedHashes: [currentSessionHash],
    },
  });
});

addActionHandler('changeSessionSettings', async (global, actions, payload) => {
  const { hash, areCallsEnabled } = payload;
  const result = await callApi('changeSessionSettings', {
    hash,
    areCallsEnabled,
  });

  if (!result) {
    return;
  }

  global = getGlobal();
  setGlobal({
    ...global,
    activeSessions: {
      ...global.activeSessions,
      byHash: {
        ...global.activeSessions.byHash,
        [hash]: {
          ...global.activeSessions.byHash[hash],
          areCallsEnabled,
        },
      },
    },
  });
});

addActionHandler('changeSessionTtl', async (global, actions, payload) => {
  const { days } = payload;

  const result = await callApi('changeSessionTtl', { days });

  if (!result) {
    return;
  }

  global = getGlobal();
  setGlobal({
    ...global,
    activeSessions: {
      ...global.activeSessions,
      ttlDays: days,
    },
  });
});
