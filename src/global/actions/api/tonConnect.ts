import type {
  ApiTonConnectResult, ApiTonConnectSentTransfer, ExportSecretPhraseError,
} from '../../../api/types';
import type { RegularLangFnParameters } from '../../../util/localization';
import type { RequiredGlobalActions } from '../../index';
import type { ActionReturnType, TabState } from '../../types';

import {
  TON_CONNECT_BAD_REQUEST_ERROR_CODE, TON_CONNECT_UNKNOWN_APP_ERROR_CODE, TON_CONNECT_UNSUPPORTED_METHOD_ERROR_CODE,
  TON_CONNECT_USER_DECLINED_ERROR_CODE,
} from '../../../config';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { pause } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { settleWidgetWalletCall } from '../../../util/widgetWalletCalls';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { addPendingWalletTransaction, finishWalletTonConnect, updateWallet } from '../../reducers/wallet';
import { selectChat } from '../../selectors';
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

addActionHandler('openWalletTonConnectRequest', async (global, actions, payload): Promise<void> => {
  const { sessionId, messageId, tabId = getCurrentTabId() } = payload;
  const tab = selectTabState(global, tabId);
  if (tab.walletModal && tab.walletTonConnect?.status === 'pending') return;

  // A widget's call this request replaces is declined, or its promise would never settle
  const replaced = tab.walletTonConnect?.widget;
  if (replaced && tab.walletTonConnect?.status !== 'done') {
    settleWidgetWalletCall(replaced.callId, { error: 'REJECTED' });
  }

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

addActionHandler('openWidgetWalletCall', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId(), ...widget } = payload;
  const tab = selectTabState(global, tabId);

  // One wallet window at a time: the user is already answering another one
  if (tab.walletModal && tab.walletTonConnect && tab.walletTonConnect.status !== 'done') {
    settleWidgetWalletCall(widget.callId, { error: 'REJECTED' });
    return;
  }

  let ownAddress = selectWalletAddress(global);
  let ownPublicKey = selectWalletPublicKey(global);
  const pending: Flow = { status: 'pending', ownAddress, widget };

  global = updateTabState(global, { walletTonConnect: pending }, tabId);
  setGlobal(global);
  actions.openWalletModal({ shouldOpenTonConnect: true, tabId });

  // A request for the wallet creates it on the server, before this client may have loaded it
  if (!ownAddress || !ownPublicKey) {
    const state = (await callApi('fetchWalletState'))?.state;
    ownAddress = state?.address;
    ownPublicKey = state?.publicKey;
    actions.loadWalletState();
  }

  if (!ownAddress || !ownPublicKey) {
    finishTonConnect(tabId, pending, { status: 'error', error: 'WALLET_UNAVAILABLE' });
    return;
  }

  const result = await callApi('previewWidgetWalletCall', { call: widget.call, ownAddress, ownPublicKey });

  if (result && 'error' in result && (result.error === 'INVALID_REQUEST' || result.error === 'INSUFFICIENT_FUNDS')) {
    refuseWidgetWalletCall(actions, tabId, pending, result.error);
    return;
  }

  finishTonConnect(tabId, pending, result && !('error' in result)
    ? { status: 'ready', ownAddress, preview: result }
    : { status: 'error', ownAddress, error: result?.error || 'TONCONNECT_FAILED' });
});

addActionHandler('respondWidgetWalletCall', async (global, actions, payload): Promise<void> => {
  const { passcode, password, tabId = getCurrentTabId() } = payload;
  const flow = selectTabState(global, tabId).walletTonConnect;
  const widget = flow?.widget;
  const ownAddress = selectWalletAddress(global);
  const ownPublicKey = selectWalletPublicKey(global);
  const chat = widget && selectChat(global, widget.chatId);
  if (!widget || !flow.preview || flow.status === 'pending' || flow.status === 'done'
    || !ownAddress || !ownPublicKey || !chat) return;

  if (flow.ownAddress !== ownAddress) {
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

  global = getGlobal();
  const inFlight = selectWalletTransferInFlight(global);
  const result = await callApi('respondWidgetWalletCall', {
    call: widget.call,
    chat,
    messageId: widget.messageId,
    botId: widget.botId,
    ownAddress,
    ownPublicKey,
    password,
    ...secret,
    previewFee: flow.preview.fee,
    pendingSeqno: inFlight?.seqno,
    pendingValidUntil: inFlight?.validUntil,
  });

  if (result && 'error' in result && (result.error === 'INVALID_REQUEST' || result.error === 'INSUFFICIENT_FUNDS')) {
    refuseWidgetWalletCall(actions, tabId, pending, result.error);
    return;
  }

  // The transfer may be on its way: the call fails and the window closes, with nothing to send again (iOS, tdesktop)
  if (result && 'error' in result && result.error === 'SEND_UNCERTAIN') {
    finishTonConnect(tabId, pending, { status: 'done' });
    settleWidgetWalletCall(widget.callId, { error: 'FAILED' });
    actions.showDialog({ data: { type: 'localized', text: { key: 'WalletSendPending' } }, tabId });
    global = getGlobal();
    if (selectTabState(global, tabId).walletModal?.shouldOpenTonConnect) actions.closeWalletModal({ tabId });
    return;
  }

  // Nothing was sent: the user can try again or close the window
  if (!result || 'error' in result) {
    finishTonConnect(tabId, pending, { status: 'error', error: result?.error || 'TONCONNECT_FAILED' });
    return;
  }

  finishTonConnect(tabId, pending, { status: 'done' });
  settleWidgetWalletCall(widget.callId, result.answer);

  global = getGlobal();

  if (selectTabState(global, tabId).walletModal?.shouldOpenTonConnect) {
    actions.closeWalletModal({ tabId });
  }

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

    actions.loadWalletState();
    actions.loadWalletTransactions({ shouldRefresh: true });
  }
});

addActionHandler('declineWidgetWalletCall', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  const flow = selectTabState(global, tabId).walletTonConnect;
  if (!flow?.widget || flow.status === 'pending') return;

  // A window closed on its error is a call that failed, not one the user declined (tdesktop does the same)
  settleWidgetWalletCall(flow.widget.callId, { error: flow.status === 'error' ? 'FAILED' : 'REJECTED' });
  actions.closeWalletModal({ tabId });
});

// The wallet refuses a transaction or a payload it cannot take (another network or sender, an expired
// `valid_until`, cells it cannot parse) or cannot pay for, which the widget gets as `BAD_REQUEST`. A short balance
// offers the top-up over the chat; the call has ended by then, so the user pays with a new tap (sdk-v1 §5.13).
function refuseWidgetWalletCall(
  actions: RequiredGlobalActions, tabId: number, pending: Flow, error: 'INVALID_REQUEST' | 'INSUFFICIENT_FUNDS',
) {
  finishTonConnect(tabId, pending, { status: 'done' });
  settleWidgetWalletCall(pending.widget!.callId, { error: 'BAD_REQUEST' });
  actions.showNotification(error === 'INSUFFICIENT_FUNDS' ? {
    containerSelector: '#portals',
    message: { key: 'WalletSendInsufficientFunds' },
    actionText: { key: 'WalletAddFunds' },
    action: { action: 'openWalletModal', payload: { shouldOpenReceive: true, tabId } },
    tabId,
  } : { containerSelector: '#portals', message: { key: 'WalletConnectInvalid' }, tabId });

  const global = getGlobal();

  if (selectTabState(global, tabId).walletModal?.shouldOpenTonConnect) {
    actions.closeWalletModal({ tabId });
  }
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
