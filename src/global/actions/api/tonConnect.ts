import type {
  ApiTonConnectConnectRequest, ApiTonConnectResult, ApiTonConnectSentTransfer, ExportSecretPhraseError,
} from '../../../api/types';
import type { RegularLangFnParameters } from '../../../util/localization';
import type { RequiredGlobalActions } from '../../index';
import type { ActionReturnType, TabState } from '../../types';

import {
  TON_CONNECT_BAD_REQUEST_ERROR_CODE, TON_CONNECT_UNKNOWN_APP_ERROR_CODE, TON_CONNECT_UNSUPPORTED_METHOD_ERROR_CODE,
  TON_CONNECT_USER_DECLINED_ERROR_CODE,
} from '../../../config';
import { bufferFromBase64, bufferToUtf8 } from '../../../util/encoding/buffer';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { pause } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { addPendingWalletTransaction, finishWalletTonConnect, updateWallet } from '../../reducers/wallet';
import { selectTabState } from '../../selectors/tabs';
import { selectWalletAddress, selectWalletPublicKey, selectWalletTransferInFlight } from '../../selectors/wallet';
import { readLocalSecret } from './wallet';

type Flow = NonNullable<TabState['walletTonConnect']>;

// The server fetches the manifest from a host the dApp chooses, which may never answer
const MANIFEST_TIMEOUT = 30000;
type LocalSecret = { words?: string[] } | { error: ExportSecretPhraseError };

addActionHandler('loadWalletTonConnectSessions', async (global): Promise<void> => {
  if (global.wallet?.isLoadingTonConnectSessions) return;

  const address = selectWalletAddress(global);
  global = updateWallet(global, { isLoadingTonConnectSessions: true, hasTonConnectSessionsError: false });
  setGlobal(global);

  const result = await callApi('fetchTonConnectSessions', { currentUserId: global.currentUserId! });
  global = getGlobal();

  if (selectWalletAddress(global) !== address) {
    global = updateWallet(global, { isLoadingTonConnectSessions: false });
    setGlobal(global);
    return;
  }

  global = updateWallet(global, {
    isLoadingTonConnectSessions: false,
    hasTonConnectSessionsError: !result || 'error' in result,
    tonConnectSessions: result && !('error' in result) ? result.sessions : global.wallet?.tonConnectSessions,
  });

  setGlobal(global);
});

addActionHandler('openWalletTonConnect', async (global, actions, payload): Promise<void> => {
  const {
    dappClientId, connectRequest, traceId, tabId = getCurrentTabId(),
  } = payload;
  const tab = selectTabState(global, tabId);
  if (tab.walletModal && tab.walletTonConnect && tab.walletTonConnect.status !== 'done') return;

  const pending: Flow = {
    status: 'pending', ownAddress: selectWalletAddress(global), connectRequest, traceId,
  };

  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);
  actions.openWalletModal({ shouldOpenTonConnect: true, tabId });

  const result = await Promise.race([
    callApi('createTonConnectSession', { dappClientId, manifestUrl: connectRequest.manifestUrl }),
    pause(MANIFEST_TIMEOUT).then(() => ({ error: 'MANIFEST_TIMEOUT' as const })),
  ]);

  if (!result || 'error' in result) {
    finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
    return;
  }

  finishTonConnect(tabId, pending, {
    status: result.session.isClosed || result.session.isClosing ? 'error' : 'ready',
    session: result.session,
    error: result.session.isClosed || result.session.isClosing ? 'SESSION_CLOSED' : undefined,
  });
});

// The dApp's `ConnectRequest` is looked for among the pending requests; without it only the address is shared
addActionHandler('openWalletTonConnectSession', async (global, actions, payload): Promise<void> => {
  const { session, tabId = getCurrentTabId() } = payload;
  const tab = selectTabState(global, tabId);

  // The update for a session created from a link lands while `createSession` is on its way
  if (tab.walletTonConnect && tab.walletTonConnect.status !== 'done' && tab.walletTonConnect.status !== 'error') {
    return;
  }

  const pending: Flow = { status: 'pending', ownAddress: selectWalletAddress(global), session };
  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);
  actions.openWalletModal({ shouldOpenTonConnect: true, tabId });

  const result = await callApi('fetchTonConnectPending', {
    dappClientId: session.dappClientId, currentUserId: global.currentUserId!,
  });

  if (!result || 'error' in result) {
    finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
    return;
  }

  const manifest = result.session.manifest;

  if (!manifest || result.session.isClosed || result.session.isClosing) {
    finishTonConnect(tabId, pending, { status: 'error', error: 'SESSION_CLOSED', session: result.session });
    return;
  }

  const connectRequest = await findConnectRequest(result.requests, manifest.url);
  finishTonConnect(tabId, pending, { status: 'ready', session: result.session, connectRequest });
});

addActionHandler('openWalletTonConnectRequest', async (global, actions, payload): Promise<void> => {
  const { sessionId, messageId, tabId = getCurrentTabId() } = payload;
  const tab = selectTabState(global, tabId);
  if (tab.walletModal && tab.walletTonConnect?.status === 'pending') return;

  const pending: Flow = { status: 'pending', ownAddress: selectWalletAddress(global) };
  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);
  actions.openWalletModal({ shouldOpenTonConnect: true, tabId });

  const result = await callApi('fetchTonConnectPending', { sessionId, currentUserId: global.currentUserId! });

  if (!result || 'error' in result) {
    finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
    return;
  }

  // The server uses the service message id as the pending request's `msg_id`
  const request = result.requests.find(({ msgId }) => msgId === messageId);
  const error = !request ? 'REQUEST_NOT_FOUND'
    : request.expires <= getServerTime() ? 'REQUEST_EXPIRED'
      : result.session.isClosed || result.session.isClosing ? 'SESSION_CLOSED' : undefined;

  finishTonConnect(tabId, pending, {
    status: error ? 'error' : 'ready', session: result.session, request, error,
  });
});

addActionHandler('unlockWalletTonConnectRequest', async (global, actions, payload): Promise<void> => {
  const {
    passcode, password, sessionId, requestMsgId, tabId = getCurrentTabId(),
  } = payload;
  const flow = selectTabState(global, tabId).walletTonConnect;
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);
  if (!flow?.session || !flow.request || flow.status === 'pending' || !ownAddress || !ownPublicKey) return;

  if (flow.session.id !== sessionId || flow.request.msgId !== requestMsgId) return;

  const pending: Flow = { ...flow, status: 'pending', error: undefined };
  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);

  const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

  if ('error' in secret) {
    finishTonConnect(tabId, pending, { status: 'error', error: secret.error });
    return;
  }

  const result = await callApi('decryptTonConnectRequest', {
    session: flow.session, request: flow.request, ownAddress, ownPublicKey, password, ...secret,
  });

  if (result && !('error' in result)
    && ((!result.transaction && !result.signData) || result.isInvalid
      || flow.session.isClosed || flow.session.isClosing)) {
    // Unsupported methods and `disconnect` are answered without a confirmation
    const response = await callApi('respondTonConnectRequest', {
      session: flow.session,
      request: flow.request,
      currentUserId: global.currentUserId!,
      ownAddress,
      ownPublicKey,
      password,
      ...secret,
    });

    if (!response || 'error' in response) {
      finishTonConnect(tabId, pending, {
        status: 'error', error: response?.error || 'TONCONNECT_FAILED', preview: result,
      });
    } else {
      finishTonConnectResponse(actions, tabId, pending, response.responseError, result.request.method);
    }

    actions.loadWalletTonConnectSessions();
    return;
  }

  finishTonConnect(tabId, pending, result && !('error' in result)
    ? { status: 'ready', preview: result }
    : { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
});

addActionHandler('respondWalletTonConnect', async (global, actions, payload): Promise<void> => {
  const {
    passcode, password, isDeclined, sessionId, requestMsgId, tabId = getCurrentTabId(),
  } = payload;
  const flow = selectTabState(global, tabId).walletTonConnect;
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);
  if (!flow?.session || flow.status === 'pending' || flow.status === 'done' || !ownAddress || !ownPublicKey) return;

  if (flow.session.id !== sessionId || flow.request?.msgId !== requestMsgId) return;

  if (!flow.connectRequest && !flow.request) return;

  if (flow.request && !isDeclined && !flow.preview) return;

  // A flow opened before the wallet existed is answered with the address it got meanwhile
  if (flow.ownAddress && flow.ownAddress !== ownAddress) {
    global = updateTabState(global, { walletTonConnect: { ...flow, status: 'error', error: 'WALLET_CHANGED' } }, tabId);
    setGlobal(global);
    return;
  }

  const pending: Flow = {
    ...flow, status: 'pending', error: undefined, isDeclining: isDeclined || undefined,
  };

  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);

  const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

  if ('error' in secret) {
    finishTonConnect(tabId, pending, { status: 'error', error: secret.error });
    return;
  }

  const credentials = {
    ownAddress, ownPublicKey, password, ...secret, isDeclined, session: flow.session,
  };

  global = getGlobal();

  const inFlight = selectWalletTransferInFlight(global);
  const currentUserId = global.currentUserId!;
  const result: ApiTonConnectResult<{
    success: true; responseError?: number; sentTransfer?: ApiTonConnectSentTransfer;
  }> | undefined = flow.connectRequest
    ? await callApi('respondTonConnectConnection', {
      ...credentials, connectRequest: flow.connectRequest, appVersion: APP_VERSION, traceId: flow.traceId,
      currentUserId,
    })
    : await callApi('respondTonConnectRequest', {
      ...credentials,
      request: flow.request!,
      currentUserId,
      previewFee: flow.preview?.fee,
      pendingSeqno: inFlight?.seqno,
      pendingValidUntil: inFlight?.validUntil,
    });

  if (!result || 'error' in result) {
    finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
    return;
  }

  finishTonConnectResponse(actions, tabId, pending, result.responseError);

  // The batch takes a seqno like a plain transfer, so nothing else is signed on it
  if (result.sentTransfer) {
    const { msgHash, seqno, validUntil, amount, toAddress } = result.sentTransfer;
    global = getGlobal();

    if (selectWalletAddress(global) === ownAddress) {
      global = addPendingWalletTransaction(global, {
        id: msgHash,
        msgHash,
        seqno,
        validUntil,
        isIncoming: false,
        isPending: true,
        peer: { type: 'address', address: toAddress },
        amount,
        timestamp: getServerTime(),
      });

      setGlobal(global);
    }
  }

  actions.loadWalletTonConnectSessions();
  actions.loadWalletState();
  actions.loadWalletTransactions({ shouldRefresh: true });
});

// The session is created on Connect, since the server has prepared it for the login
addActionHandler('openWalletTonConnectOauth', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const tab = selectTabState(global, tabId);
  const request = tab.urlAuth?.request;
  if (!request?.walletRequest) return;

  if (tab.walletModal && tab.walletTonConnect && tab.walletTonConnect.status !== 'done') {
    actions.closeUrlAuthModal({ tabId });
    return;
  }

  const ownAddress = selectWalletAddress(global);

  global = updateTabState(global, {
    walletTonConnect: {
      status: 'ready',
      ownAddress,
      oauth: { botId: request.botId, domain: request.domain, ...request.walletRequest },
    },
  }, tabId);

  setGlobal(global);

  if (!ownAddress) {
    actions.loadWalletState();
  }

  actions.openWalletModal({ shouldOpenTonConnect: true, tabId });
});

addActionHandler('connectWalletTonConnectOauth', async (global, actions, payload): Promise<void> => {
  const { passcode, password, tabId = getCurrentTabId() } = payload;
  const { walletTonConnect: flow, urlAuth } = selectTabState(global, tabId);
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);
  const oauth = flow?.oauth;
  if (!oauth || flow.status === 'pending' || flow.status === 'done' || !ownAddress || !ownPublicKey) return;

  if (urlAuth?.request?.walletRequest?.sessionId !== oauth.sessionId) return;

  if (flow.ownAddress && flow.ownAddress !== ownAddress) {
    global = updateTabState(global, { walletTonConnect: { ...flow, status: 'error', error: 'WALLET_CHANGED' } }, tabId);
    setGlobal(global);
    return;
  }

  const pending: Flow = { ...flow, status: 'pending', error: undefined };
  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);

  const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

  if ('error' in secret) {
    finishTonConnect(tabId, pending, { status: 'error', error: secret.error });
    return;
  }

  const result = await callApi('prepareTonConnectOauthSession', {
    ownAddress, ownPublicKey, password, ...secret, ...oauth, appVersion: APP_VERSION,
  });

  if (!result || 'error' in result) {
    finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
    return;
  }

  finishTonConnect(tabId, pending, { status: 'done' });

  global = getGlobal();

  const currentUrlAuth = selectTabState(global, tabId).urlAuth;
  if (!currentUrlAuth?.request || currentUrlAuth.request.walletRequest?.sessionId !== oauth.sessionId) return;

  global = updateTabState(global, { urlAuth: { ...currentUrlAuth, isWalletConnected: true } }, tabId);
  setGlobal(global);
  actions.closeWalletModal({ tabId });

  // As in the Android app, the login dialog comes back only when it has something left to ask
  const { request, matchCode } = currentUrlAuth;
  const isDialogNeeded = request.shouldRequestWriteAccess || request.shouldRequestPhoneNumber
    || Boolean(request.matchCodes?.length && !matchCode);
  if (isDialogNeeded) return;

  if (currentUrlAuth.button) {
    actions.acceptBotUrlAuth({ tabId });
  } else {
    actions.acceptLinkUrlAuth({ tabId });
  }
});

addActionHandler('disconnectWalletTonConnect', async (global, actions, payload): Promise<void> => {
  const {
    sessionId, passcode, password, tabId = getCurrentTabId(),
  } = payload;
  const session = global.wallet?.tonConnectSessions?.find(({ id }) => id === sessionId);
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);

  if (!session || !ownAddress || !ownPublicKey
    || selectTabState(global, tabId).walletTonConnect?.status === 'pending') return;

  const pending: Flow = { status: 'pending', session };
  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);

  const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

  if ('error' in secret) {
    finishTonConnect(tabId, pending, { status: 'error', error: secret.error });
    return;
  }

  const result = await callApi('disconnectTonConnectSession', {
    session, ownAddress, ownPublicKey, password, ...secret,
  });

  finishTonConnect(tabId, pending, result && !('error' in result)
    ? { status: 'done' }
    : { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });

  if (result && !('error' in result)) {
    actions.showNotification({
      message: {
        key: 'WalletConnectDisconnected',
        variables: { name: session.manifest?.name || session.dappClientId },
      },
      tabId,
    });
  }

  actions.loadWalletTonConnectSessions();
});

addActionHandler('disconnectAllWalletTonConnect', async (global, actions, payload): Promise<void> => {
  const { passcode, password, tabId = getCurrentTabId() } = payload;
  const sessions = global.wallet?.tonConnectSessions?.filter(({ isClosed, isPending }) => !isClosed && !isPending);
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);

  if (!sessions?.length || !ownAddress || !ownPublicKey
    || selectTabState(global, tabId).walletTonConnect?.status === 'pending') return;

  const pending: Flow = { status: 'pending' };
  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);

  const secret: LocalSecret = passcode ? await readLocalSecret(passcode, ownAddress) : {};

  if ('error' in secret) {
    finishTonConnect(tabId, pending, { status: 'error', error: secret.error });
    return;
  }

  for (const session of sessions) {
    const result = await callApi('disconnectTonConnectSession', {
      session, ownAddress, ownPublicKey, password, ...secret,
    });

    if (!result || 'error' in result) {
      finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
      actions.loadWalletTonConnectSessions();
      return;
    }
  }

  finishTonConnect(tabId, pending, { status: 'done' });
  actions.showNotification({ message: { key: 'WalletConnectDisconnectedAll' }, tabId });
  actions.loadWalletTonConnectSessions();
});

addActionHandler('finishWalletTonConnectDisconnects', async (global, actions, payload): Promise<void> => {
  const { sessionIds } = payload;
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);

  // A phrase kept only on this device is behind the passcode, so those sessions wait for the Connected Apps screen
  if (!ownAddress || !ownPublicKey || !global.wallet?.state?.canExportPhrase) return;

  const result = await callApi('fetchTonConnectSessions', { currentUserId: global.currentUserId! });
  if (!result || 'error' in result) return;

  for (const session of result.sessions) {
    if (!sessionIds.includes(session.id) || session.isClosed || !session.isClosing) continue;

    global = getGlobal();

    if (selectWalletAddress(global) !== ownAddress) return;

    await callApi('disconnectTonConnectSession', { session, ownAddress, ownPublicKey });
  }

  actions.loadWalletTonConnectSessions();
});

// A connect request is listed as plain JSON; any other body is an encrypted app request
async function findConnectRequest(
  requests: { body: string }[], manifestUrl: string,
): Promise<ApiTonConnectConnectRequest> {
  const { parseTonConnectConnectRequest } = await import('../../../lib/ton/connectRequest');

  for (const { body } of requests) {
    try {
      return parseTonConnectConnectRequest(JSON.parse(bufferToUtf8(bufferFromBase64(body))));
    } catch {
      // Not a connect request
    }
  }

  return { manifestUrl, items: [{ name: 'ton_addr' }] };
}

// A refusal settles the request as an approval does, so only an answer that failed stays on the screen
function finishTonConnectResponse(
  actions: RequiredGlobalActions, tabId: number, pending: Flow, responseError?: number, method?: string,
) {
  finishTonConnect(tabId, pending, { status: 'done' });

  const message = getResponseNotification(pending, responseError, method);

  if (message) {
    // The toast goes to the page, not into the closing dialog
    actions.showNotification({ containerSelector: '#portals', message, tabId });
  }

  // A link may have swapped the dialog for the transfer form while the answer was out
  const global = getGlobal();

  if (selectTabState(global, tabId).walletModal?.shouldOpenTonConnect) {
    actions.closeWalletModal({ tabId });
  }
}

function getResponseNotification(
  pending: Flow, responseError?: number, method?: string,
): RegularLangFnParameters | undefined {
  const variables = { name: pending.session!.manifest?.name || pending.session!.dappClientId };

  switch (responseError) {
    case undefined:
      return pending.connectRequest ? { key: 'WalletConnectSuccess', variables }
        : method === 'disconnect' ? { key: 'WalletConnectDisconnected', variables }
          : { key: 'WalletConnectRequestAppProcessed', variables };
    case TON_CONNECT_USER_DECLINED_ERROR_CODE:
    case TON_CONNECT_UNSUPPORTED_METHOD_ERROR_CODE:
      return pending.connectRequest ? undefined : { key: 'WalletConnectRequestAppDeclined', variables };
    case TON_CONNECT_BAD_REQUEST_ERROR_CODE:
      return { key: 'WalletConnectInvalid' };
    case TON_CONNECT_UNKNOWN_APP_ERROR_CODE:
      return { key: 'WalletConnectSessionClosed' };
    default:
      return { key: 'WalletSendError' };
  }
}

function finishTonConnect(tabId: number, pending: Flow, update: Partial<Flow>) {
  let global = getGlobal();
  global = finishWalletTonConnect(global, tabId, pending, update);
  setGlobal(global);
}
