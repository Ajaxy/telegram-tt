import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { oldTranslate } from '../../../util/oldLangProvider';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
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

addActionHandler('loadPasskeys', async (global): Promise<void> => {
  const result = await callApi('fetchPasskeys');
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    passkeys: result,
  };
  setGlobal(global);
});

addActionHandler('createPasskey', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};

  if (!window.PublicKeyCredential) {
    actions.showNotification({
      message: oldTranslate('PasskeyRegistrationFailed'),
      tabId,
    });
    return;
  }

  const optionsJson = await callApi('initPasskeyRegistration');
  if (!optionsJson) {
    actions.showNotification({
      message: oldTranslate('PasskeyRegistrationFailed'),
      tabId,
    });
    return;
  }

  try {
    const options = JSON.parse(optionsJson);
    const publicKeyOptions = options.publicKey || options;

    const createOptions: CredentialCreationOptions = {
      publicKey: {
        challenge: base64UrlToBuffer(publicKeyOptions.challenge),
        rp: publicKeyOptions.rp,
        user: {
          ...publicKeyOptions.user,
          id: base64UrlToBuffer(publicKeyOptions.user.id),
        },
        pubKeyCredParams: publicKeyOptions.pubKeyCredParams,
        timeout: publicKeyOptions.timeout || 60000,
        attestation: publicKeyOptions.attestation || 'none',
        authenticatorSelection: publicKeyOptions.authenticatorSelection,
        excludeCredentials: publicKeyOptions.excludeCredentials?.map((cred: { id: string; type: string }) => ({
          type: cred.type,
          id: base64UrlToBuffer(cred.id),
        })),
      },
    };

    const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential | undefined;

    if (!credential) {
      return;
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    const passkey = await callApi('registerPasskey', {
      id: credential.id,
      rawId: bufferToBase64Url(credential.rawId),
      clientDataJSON: new TextDecoder().decode(response.clientDataJSON),
      attestationObject: response.attestationObject,
    });

    if (!passkey) {
      actions.showNotification({
        message: oldTranslate('PasskeyRegistrationFailed'),
        tabId,
      });
      return;
    }

    global = getGlobal();
    global = {
      ...global,
      passkeys: [...global.passkeys, passkey],
    };
    setGlobal(global);

    actions.showNotification({
      message: oldTranslate('PasskeyAdded'),
      tabId,
    });
  } catch (err) {
    // NotAllowedError means user cancelled - don't show notification
    if ((err as Error).name === 'NotAllowedError') {
      return;
    }

    actions.showNotification({
      message: oldTranslate('PasskeyRegistrationFailed'),
      tabId,
    });
  }
});

addActionHandler('deletePasskey', async (global, actions, payload): Promise<void> => {
  const { id } = payload;

  const result = await callApi('deletePasskey', { id });
  if (!result) {
    return;
  }

  global = getGlobal();
  global = {
    ...global,
    passkeys: global.passkeys.filter((p) => p.id !== id),
  };
  setGlobal(global);
});

function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(paddedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
