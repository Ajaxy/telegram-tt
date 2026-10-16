import { Api as GramJs } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';
import { generateRandomBigInt } from '../../../lib/gramjs/Helpers';

import type { WalletSeeds } from '../../../lib/ton/bip39';
import type { TonConnectSessionKey } from '../../../lib/ton/tonConnect';
import type {
  ApiTonConnectConnectRequest,
  ApiTonConnectError,
  ApiTonConnectRequest,
  ApiTonConnectRequestPreview,
  ApiTonConnectResult,
  ApiTonConnectSentTransfer,
  ApiTonConnectSession,
  ApiTonConnectTransaction,
} from '../../types';

import {
  DEBUG, GRAM_TRANSFER_FEE_RESERVE, TON_CONNECT_BAD_REQUEST_ERROR_CODE, TON_CONNECT_UNKNOWN_APP_ERROR_CODE,
  TON_CONNECT_UNSUPPORTED_METHOD_ERROR_CODE,
  TON_CONNECT_USER_DECLINED_ERROR_CODE, WALLET_TRANSFER_DATA_MAX_BYTES,
} from '../../../config';
import { parseAddress, toRawAddress } from '../../../lib/ton/address';
import { MAX_BOC_BYTES, parseBoc } from '../../../lib/ton/boc';
import { parseTonConnectConnectRequest } from '../../../lib/ton/connectRequest';
import { getEd25519PublicKey } from '../../../lib/ton/ed25519';
import { signTonConnectData } from '../../../lib/ton/signData';
import {
  answerTonConnectChallenge,
  buildTonConnectConnectError,
  buildTonConnectError,
  buildTonConnectEvent,
  canEncryptTonConnectMessage,
  decryptTonConnectMessage,
  deriveTonConnectSessionKey,
  encryptTonConnectMessage,
  getTonConnectDomain,
  parseTonConnectRequest,
  parseTonConnectSignData,
  parseTonConnectTransaction,
  readTonConnectComment,
  validateProofDomain,
} from '../../../lib/ton/tonConnect';
import {
  buildSignedBatchTransfer, buildSignedInternalBatchTransfer, buildUnsignedBatchTransferBodyBoc, buildWalletInitBocs,
  getBatchTransferSize, TRANSFER_TTL_SECONDS,
} from '../../../lib/ton/wallet';
import { TON_CONNECT_IDB_STORE } from '../../../util/browser/idb';
import { bufferToBase64 } from '../../../util/encoding/buffer';
import { getBigIntMax } from '../../../util/numbers';
import { getServerTime } from '../../../util/serverTime';
import {
  buildApiTonConnectRequest, buildApiTonConnectSession, buildApiWalletSentTransfer,
} from '../apiBuilders/wallet';
import { deserializeBytes, serializeBytes } from '../helpers/misc';
import { invokeRequest } from './client';
import {
  checkIsAddressActive, deriveWalletSeeds, estimateFee, exportWalletSecretPhrase, fetchToncenterWalletState,
  forgetRefusedTransfer, isTransferPending, rememberSentTransfer, runWalletSend, sendTransferData,
} from './wallet';

type TonConnectCredentials = {
  ownAddress: string;
  ownPublicKey: string;
  words?: string[];
  // Only once the server has asked for it with `PASSWORD_MISSING`
  password?: string;
};

type TonConnectRequestParams = TonConnectCredentials & {
  session: ApiTonConnectSession;
  request: ApiTonConnectRequest;
};

type TonConnectRespondParams = TonConnectRequestParams & {
  currentUserId: string;
  isDeclined?: boolean;
  previewFee?: bigint;
  // See `ApiWalletSentTransfer`
  pendingSeqno?: number;
  pendingValidUntil?: number;
};

type TonConnectPendingLookup = { currentUserId: string }
  & ({ dappClientId: string; sessionId?: never } | { sessionId: string; dappClientId?: never });

type TonConnectResponse = { success: true; responseError?: number; sentTransfer?: ApiTonConnectSentTransfer };

type TonConnectKeys = TonConnectSessionKey & { seeds: WalletSeeds; anchorPublicKey: Uint8Array };

type WalletChainState = NonNullable<Awaited<ReturnType<typeof fetchToncenterWalletState>>>;
type TonConnectBatchMessages = Awaited<ReturnType<typeof buildTonConnectTransferMessages>>;

// Only ciphertext survives a request, so retrying publication never needs the wallet's secret
type PendingResponse = {
  // Absent for a record restored from disk that never got its answer, see `StoredResponse`
  body?: string;
  expires: number;
  isPublished?: boolean;
  responseError?: number;
  sentTransfer?: ApiTonConnectSentTransfer;
  shouldCloseSession?: boolean;
};
const pendingResponses = new Map<string, PendingResponse>();
// A claim cannot be taken back, so an answer the page was reloaded before publishing is published
// the next time the sessions are listed
type StoredResponse = {
  // The store is shared by every account slot of the origin
  userId?: string;
  sessionId: string;
  msgId: number;
  traceId?: string;
  // Absent while the transaction is on its way out, so a reload does not take the request up again
  body?: string;
  expires: number;
  shouldCloseSession?: boolean;
};

// Keeps the preview and the answer to one request from exporting the phrase twice
const sessionKeys = new Map<string, { keys: TonConnectKeys; timeoutId: ReturnType<typeof setTimeout> }>();
const SESSION_KEY_RETENTION_MS = 5 * 60 * 1000;
const respondingRequests = new Set<string>();
const oauthSessions = new Map<string, {
  session: GramJs.InputTonConnectOauthSession; timeoutId: ReturnType<typeof setTimeout>;
}>();
const TON_CONNECT_MANIFEST_FILE = 'tonconnect-manifest.json';
const RESPONSE_RETENTION_SECONDS = 300;
// A signed message blocks the next transfer of this wallet until it expires, so a dApp cannot
// ask for an expiration that locks the wallet for long
const MAX_REQUESTED_TTL_SECONDS = 600;
const TON_CONNECT_ERROR_PREFIX = /^TONCONNECT_/;

const TON_CONNECT_ERRORS: ApiTonConnectError[] = [
  'DAPP_CLIENT_ID_INVALID', 'MANIFEST_URL_INVALID', 'SESSION_NOT_FOUND', 'SESSION_CLOSED', 'SESSION_NOT_ACTIVE',
  'REQUEST_NOT_FOUND', 'REQUEST_EXPIRED', 'REQUEST_ALREADY_CLAIMED', 'BAD_REQUEST_ID',
  'LOOKUP_INVALID', 'TONCONNECT_CLIENT_ID_INVALID', 'TONCONNECT_CLIENT_ID_OCCUPIED', 'CHALLENGE_INVALID',
  'BODY_INVALID', 'WALLET_UNAVAILABLE', 'UNSUPPORTED_WALLET', 'INVALID_REQUEST', 'INSUFFICIENT_FUNDS',
  'TRANSFER_PENDING', 'SEND_FAILED',
];

// Ends a method with the error its caller gets, see `runTonConnect`
class TonConnectError extends Error {
  constructor(readonly code: ApiTonConnectError) {
    super(code);
  }
}

// A second submission for a session that is already active succeeds without publishing anything
// again, so a lost answer or two devices racing on the same link cannot connect the dApp twice
export async function respondTonConnectConnection({
  session, connectRequest, appVersion, isDeclined, traceId, currentUserId, ...credentials
}: TonConnectCredentials & {
  session: ApiTonConnectSession;
  connectRequest: ApiTonConnectConnectRequest;
  appVersion: string;
  isDeclined?: boolean;
  traceId?: string;
  currentUserId: string;
}): Promise<ApiTonConnectResult<TonConnectResponse>> {
  const cacheKey = `connect:${session.id}`;
  if (respondingRequests.has(cacheKey)) return { error: 'TONCONNECT_BUSY' };

  respondingRequests.add(cacheKey);

  try {
    return await runTonConnect(async () => {
      const parsedConnectRequest = parseTonConnectConnectRequest(connectRequest);
      const pending = await invokeTonConnectGetPending({ sessionId: session.id, currentUserId });

      if (!pending.session.isPending || pending.session.isClosed || pending.session.isClosing) {
        throw new TonConnectError('SESSION_CLOSED');
      }

      if (!pending.session.manifest || pending.session.manifestError) {
        throw new TonConnectError('MANIFEST_URL_INVALID');
      }

      // The proof is signed for the host named by the manifest's own `url`. A manifest served from another host
      // must not name it, or the dApp would get a proof for a domain it does not own.
      const domain = getTonConnectDomain(pending.session.manifest.url);

      if (domain !== getTonConnectDomain(parsedConnectRequest.manifestUrl)) {
        throw new TonConnectError('MANIFEST_URL_INVALID');
      }

      if (pending.session.nonce !== session.nonce || pending.session.dappClientId !== session.dappClientId
        || pending.session.manifest.url !== session.manifest?.url
        || pending.session.manifest.name !== session.manifest.name
        || pending.session.manifest.icon?.url !== session.manifest.icon?.url) {
        throw new TonConnectError('SESSION_NOT_ACTIVE');
      }

      const keys = await deriveTonConnectKeys(pending.session, credentials);
      const { challenge, eventId } = await registerTonConnectKey(session.id, keys.clientId);
      let event = isDeclined
        ? buildTonConnectConnectError(eventId, TON_CONNECT_USER_DECLINED_ERROR_CODE, 'User declined the connection')
        : (await buildTonConnectEvent({
          id: eventId, address: credentials.ownAddress, anchorPublicKey: keys.anchorPublicKey,
          signingSeed: keys.seeds.signing, domain,
          items: parsedConnectRequest.items, timestamp: getServerTime(), appVersion,
        })).event;

      // The event repeats the proof payload, so a payload close to the size limit leaves no room for it
      const isTooLarge = !isDeclined && !canEncryptTonConnectMessage(event);

      if (isTooLarge) {
        event = buildTonConnectConnectError(eventId, TON_CONNECT_BAD_REQUEST_ERROR_CODE, 'Request is too large');
      }

      await submitTonConnectConnectResult({
        sessionId: session.id, traceId, isError: isDeclined || isTooLarge,
        challengeAnswer: answerTonConnectChallenge(challenge, keys.secretKey),
        body: encryptTonConnectMessage(event, session.dappClientId, keys.secretKey),
      });

      return { success: true, responseError: getConnectResponseError(isDeclined, isTooLarge) };
    });
  } finally {
    respondingRequests.delete(cacheKey);
  }
}

// The connection goes to the server with `messages.acceptUrlAuth`, so it is kept in the worker until then
export async function prepareTonConnectOauthSession({
  botId, domain, sessionId, clientId, appVersion, ...credentials
}: TonConnectCredentials & {
  botId: string;
  domain: string;
  sessionId: string;
  clientId: string;
  appVersion: string;
}): Promise<ApiTonConnectResult<{ success: true }>> {
  const cacheKey = `oauth:${sessionId}`;
  if (respondingRequests.has(cacheKey)) return { error: 'TONCONNECT_BUSY' };

  respondingRequests.add(cacheKey);

  try {
    return await runTonConnect(async () => {
      // The server has created the login's session already and returns it again; any other session
      // means the login or the site's key changed meanwhile
      const session = await invokeTonConnectCreateSession({
        dappClientId: clientId, manifestUrl: `https://${domain}/${TON_CONNECT_MANIFEST_FILE}`,
      });

      if (session.id !== sessionId || session.dappClientId !== clientId || session.isClosed || session.isClosing
        || !session.nonce) {
        throw new TonConnectError('SESSION_CHANGED');
      }

      const keys = await deriveTonConnectKeys(session, credentials);
      const { challenge, eventId } = await registerTonConnectKey(sessionId, keys.clientId);

      const timestamp = getServerTime();
      const { event, proofSignature } = await buildTonConnectEvent({
        id: eventId, address: credentials.ownAddress, anchorPublicKey: keys.anchorPublicKey,
        signingSeed: keys.seeds.signing, domain: validateProofDomain(domain), timestamp, appVersion,
        items: [{ name: 'ton_addr' }, { name: 'ton_proof', payload: `tc-login:${botId}:${clientId}:${sessionId}` }],
      });

      rememberOauthSession(sessionId, new GramJs.InputTonConnectOauthSession({
        sessionId: BigInt(sessionId),
        challengeAnswer: answerTonConnectChallenge(challenge, keys.secretKey),
        body: encryptTonConnectMessage(event, clientId, keys.secretKey),
        proof: new GramJs.WalletOwnershipProof({ timestamp, signature: proofSignature! }),
      }));

      return { success: true };
    });
  } finally {
    respondingRequests.delete(cacheKey);
  }
}

// The prepared connection is handed over once: a second login attempt has to prepare it again
export function takeTonConnectOauthSession(sessionId: string) {
  const prepared = oauthSessions.get(sessionId);
  if (!prepared) return undefined;

  clearTimeout(prepared.timeoutId);
  oauthSessions.delete(sessionId);

  return prepared.session;
}

function rememberOauthSession(sessionId: string, session: GramJs.InputTonConnectOauthSession) {
  const previous = oauthSessions.get(sessionId);

  if (previous) {
    clearTimeout(previous.timeoutId);
    previous.session.challengeAnswer.fill(0);
  }

  oauthSessions.set(sessionId, {
    session,
    timeoutId: setTimeout(() => {
      oauthSessions.delete(sessionId);
      session.challengeAnswer.fill(0);
    }, SESSION_KEY_RETENTION_MS),
  });
}

function getConnectResponseError(isDeclined: boolean | undefined, isTooLarge: boolean) {
  if (isDeclined) return TON_CONNECT_USER_DECLINED_ERROR_CODE;

  if (isTooLarge) return TON_CONNECT_BAD_REQUEST_ERROR_CODE;

  return undefined;
}

export async function finishTonConnectKeyRotation(credentials: TonConnectCredentials & {
  words: string[];
}): Promise<void> {
  const sessions = await invokeTonConnectGetSessions().catch(() => undefined);
  if (!sessions) return;

  for (const session of sessions) {
    if (!session.isClosing || session.isClosed) continue;

    // A failed disconnect does not fail a key rotation that has landed on the chain already
    await disconnectTonConnectSession({ session, ...credentials });
  }
}

// The server closes a session only along with a `disconnect` event for the dApp, which takes the
// session key and so the phrase (`TONCONNECT_BODY_INVALID` otherwise)
export function disconnectTonConnectSession({ session, ...credentials }: TonConnectCredentials & {
  session: ApiTonConnectSession;
}): Promise<ApiTonConnectResult<{ success: true }>> {
  return runTonConnect(async () => {
    if (session.isClosed) return { success: true };

    try {
      const keys = await deriveTonConnectKeys(session, credentials);
      const id = await fetchTonConnectNextEventId(session.id);

      await closeTonConnectSession(session.id, encryptTonConnectMessage(
        { event: 'disconnect', id, payload: {} }, session.dappClientId, keys.secretKey,
      ));
    } catch {
      // Without the phrase, or with the event refused, the session is closed without telling the dApp,
      // so it does not stay open forever
      await closeTonConnectSession(session.id);
    }

    return { success: true };
  });
}

export function decryptTonConnectRequest({
  session, request, ...credentials
}: TonConnectRequestParams): Promise<ApiTonConnectResult<ApiTonConnectRequestPreview>> {
  return runTonConnect(async () => {
    if (request.sessionId !== session.id) throw new TonConnectError('INVALID_REQUEST');

    if (request.expires <= getServerTime()) throw new TonConnectError('REQUEST_EXPIRED');

    const keys = await deriveTonConnectKeys(session, credentials);
    const appRequest = parseTonConnectRequest(decryptTonConnectMessage(
      deserializeBytes(request.body), session.dappClientId, keys.secretKey,
    ));
    const preview: ApiTonConnectRequestPreview = { request: appRequest, expires: request.expires };

    if (appRequest.method === 'signData') {
      try {
        return {
          ...preview, signData: await parseTonConnectSignData(JSON.parse(appRequest.params[0]), credentials.ownAddress),
        };
      } catch {
        return { ...preview, isInvalid: true };
      }
    }

    const isSignMessage = appRequest.method === 'signMessage';

    if (appRequest.method !== 'sendTransaction' && !isSignMessage) return preview;

    try {
      preview.transaction = await parseTonConnectTransaction(
        JSON.parse(appRequest.params[0]), credentials.ownAddress, getServerTime(),
      );
    } catch {
      return { ...preview, isInvalid: true };
    }

    preview.transaction.messages = await Promise.all(preview.transaction.messages.map(async (message) => ({
      ...message, comment: message.payload ? await readTonConnectComment(message.payload) : undefined,
    })));

    // The dApp sends a signed message through its own relayer, which pays the gas
    if (isSignMessage) return preview;

    const state = await fetchToncenterWalletState(credentials.ownAddress);
    if (!state?.isSupportedContract) throw new TonConnectError('UNSUPPORTED_WALLET');

    const body = await buildUnsignedBatchTransferBodyBoc({
      messages: await buildTonConnectTransferMessages(preview.transaction),
      seqno: state.seqno, now: getServerTime(), validUntil: preview.transaction.validUntil,
    });

    preview.fee = await estimateFee(credentials.ownAddress, body,
      state.isDeployed ? undefined : await buildWalletInitBocs(keys.anchorPublicKey));

    return preview;
  });
}

export async function respondTonConnectRequest(
  params: TonConnectRespondParams,
): Promise<ApiTonConnectResult<TonConnectResponse>> {
  const { session, request, currentUserId } = params;
  const cacheKey = `${session.id}:${request.msgId}`;
  const now = getServerTime();

  for (const [key, response] of pendingResponses) {
    if (response.expires < now && !respondingRequests.has(key)) pendingResponses.delete(key);
  }

  if (respondingRequests.has(cacheKey)) return { error: 'TONCONNECT_BUSY' };

  // Publishing a cached response takes the same lock, so a second call cannot send the answer twice
  respondingRequests.add(cacheKey);

  try {
    return await runTonConnect(async () => {
      // A claim survives a reload: the server lists the request again, and the answer made for it is on
      // disk. It is published as is, since making it again could send the transaction a second time.
      const previous = pendingResponses.get(cacheKey) ?? await restoreStoredResponse(cacheKey, currentUserId);

      if (previous?.isPublished) return { success: true, responseError: previous.responseError };

      // The transaction went out before a reload and its answer was never kept: the request must not be
      // taken up again, and the dApp is left without an answer
      if (previous && !previous.body) throw new TonConnectError('REQUEST_ALREADY_CLAIMED');

      if (previous?.body) return publishTonConnectCachedResponse(params, cacheKey, previous.body);

      return processTonConnectRequest(params, cacheKey);
    });
  } finally {
    respondingRequests.delete(cacheKey);
  }
}

async function processTonConnectRequest({
  session, request, currentUserId, isDeclined, previewFee, pendingSeqno, pendingValidUntil, ...credentials
}: TonConnectRespondParams, cacheKey: string): Promise<TonConnectResponse> {
  if (request.sessionId !== session.id) throw new TonConnectError('INVALID_REQUEST');

  if (request.expires <= getServerTime()) throw new TonConnectError('REQUEST_EXPIRED');

  const keys = await deriveTonConnectKeys(session, credentials);
  const appRequest = parseTonConnectRequest(decryptTonConnectMessage(
    deserializeBytes(request.body), session.dappClientId, keys.secretKey,
  ));
  let transaction: ApiTonConnectTransaction | undefined;
  let messages: TonConnectBatchMessages | undefined;
  let state: WalletChainState | undefined;
  const isSignMessage = appRequest.method === 'signMessage';
  let shouldCloseSession = false;
  let response: ReturnType<typeof buildTonConnectError> | { id: string; result: string | object } | undefined;

  if (session.isClosed || session.isClosing) {
    response = buildTonConnectError(appRequest.id, TON_CONNECT_UNKNOWN_APP_ERROR_CODE, 'Unknown app');
  } else if (isDeclined) {
    response = buildTonConnectError(appRequest.id, TON_CONNECT_USER_DECLINED_ERROR_CODE, 'User declined the request');
  } else if (appRequest.method === 'sendTransaction' || isSignMessage) {
    try {
      transaction = await parseTonConnectTransaction(JSON.parse(appRequest.params[0]), credentials.ownAddress,
        getServerTime());
    } catch {
      response = buildTonConnectError(appRequest.id, TON_CONNECT_BAD_REQUEST_ERROR_CODE, 'Invalid transaction');
    }

    // The wallet's own limits are checked before the claim: a claim marks the request as handled for every
    // device, while a low balance or a foreign contract is something the user can fix and confirm again
    if (transaction) {
      state = await fetchToncenterWalletState(credentials.ownAddress);

      if (!state?.isSupportedContract) throw new TonConnectError('UNSUPPORTED_WALLET');

      if (isTransferPending(credentials.ownAddress, state.seqno, pendingSeqno, pendingValidUntil)) {
        throw new TonConnectError('TRANSFER_PENDING');
      }
    }

    // The signed message wraps the payloads in the wallet's cells, so the whole batch is measured before the claim.
    // Once claimed as accepted, it could fail only when sent. An external message is bound by what
    // `wallet.sendTransfer` takes in one data field, an internal one for the relayer by the chain limit.
    if (transaction && state) {
      messages = await buildTonConnectTransferMessages(transaction);

      const params = buildBatchParams(credentials.ownAddress, keys, state, messages, transaction.validUntil);

      // An expired transaction cannot be built at all. It is answered as expired after the claim below.
      const isExpired = params.validUntil <= params.now;

      // A signed message is not checked against the balance: the relayer that sends it can attach the value
      if (!isSignMessage) {
        const total = transaction.messages.reduce((sum, message) => sum + BigInt(message.amount), 0n);

        // The balance is checked against the fee the user saw in the preview, and the reserve serves as the minimum
        // threshold. The claim cannot be undone, so a transfer the wallet cannot pay for has to be refused here.
        const reserve = getBigIntMax(previewFee ?? 0n, GRAM_TRANSFER_FEE_RESERVE * BigInt(params.messages.length));

        if (total + reserve > state.balance) throw new TonConnectError('INSUFFICIENT_FUNDS');

        // A bounceable message to an account with no code comes straight back with the fees spent, unless
        // the message brings the code along as its state init
        for (const message of transaction.messages) {
          const to = parseAddress(message.address)!;

          if (to.isBounceable && !message.stateInit && await checkIsAddressActive(message.address) === false) {
            throw new TonConnectError('INACTIVE_ADDRESS');
          }
        }
      }

      const maxBytes = isSignMessage ? MAX_BOC_BYTES : WALLET_TRANSFER_DATA_MAX_BYTES;

      if (!isExpired && await getBatchTransferSize({ ...params, isInternal: isSignMessage }) > maxBytes) {
        transaction = undefined;
        response = buildTonConnectError(appRequest.id, TON_CONNECT_BAD_REQUEST_ERROR_CODE, 'Transaction is too large');
      }
    }
  } else if (appRequest.method === 'signData') {
    // The answer carries the payload back together with the signature, so a payload close to the size
    // limit is refused before the claim: after it, the dApp could no longer receive any answer
    try {
      response = {
        id: appRequest.id,
        result: await signTonConnectRequestData(appRequest.params[0], session, keys, credentials.ownAddress),
      };

      if (!canEncryptTonConnectMessage(response)) {
        response = buildTonConnectError(appRequest.id, TON_CONNECT_BAD_REQUEST_ERROR_CODE, 'Data is too large');
      }
    } catch {
      response = buildTonConnectError(appRequest.id, TON_CONNECT_BAD_REQUEST_ERROR_CODE, 'Invalid data');
    }
  } else if (appRequest.method === 'disconnect') {
    response = { id: appRequest.id, result: {} };
    shouldCloseSession = !session.isClosed && !session.isClosing;
  } else {
    response = buildTonConnectError(appRequest.id, TON_CONNECT_UNSUPPORTED_METHOD_ERROR_CODE, 'Method not supported');
  }

  // A request that arrived after the session was closed is claimed without a challenge: there is no
  // active session key left on the server to prove
  const isSessionClosed = session.isClosed || session.isClosing;
  let challengeAnswer: Uint8Array<ArrayBuffer> | undefined;

  if (!isSessionClosed) {
    const { challenge } = await registerTonConnectKey(session.id, keys.clientId);
    challengeAnswer = answerTonConnectChallenge(challenge, keys.secretKey);
  }

  if (request.expires <= getServerTime()) throw new TonConnectError('REQUEST_EXPIRED');

  if (transaction?.validUntil !== undefined && transaction.validUntil <= getServerTime()) {
    transaction = undefined;
    response = buildTonConnectError(appRequest.id, TON_CONNECT_BAD_REQUEST_ERROR_CODE, 'Transaction expired');
  }

  // The claim is idempotent on the server: claiming the same request again from this device succeeds,
  // and a device that failed to claim must not answer the dApp at all
  await claimTonConnectRequest({
    sessionId: session.id, msgId: request.msgId, appRequestId: appRequest.id,
    isDeclined: isDeclined || (response !== undefined && 'error' in response),
    challengeAnswer,
  });

  let sentTransfer: ApiTonConnectSentTransfer | undefined;
  const expires = request.expires + RESPONSE_RETENTION_SECONDS;

  if (transaction && isSignMessage) {
    try {
      const internalBoc = await signTonConnectMessage(
        messages!, transaction.validUntil, keys, credentials.ownAddress, pendingSeqno, pendingValidUntil,
      );

      response = { id: appRequest.id, result: { internalBoc: bufferToBase64(internalBoc) } };
    } catch {
      response = buildTonConnectError(appRequest.id, 0, 'Could not sign the message');
    }
  } else if (transaction) {
    try {
      // The record goes to disk before anything is broadcast: a reload that finds it does not send the
      // transaction again, and when the disk is not there nothing is sent at all
      await TON_CONNECT_IDB_STORE.set(cacheKey, {
        userId: currentUserId, sessionId: session.id, msgId: request.msgId, traceId: request.traceId, expires,
      } satisfies StoredResponse);

      const { validUntil: requestedUntil, messages: [firstMessage] } = transaction;
      const total = transaction.messages.reduce((sum, message) => sum + BigInt(message.amount), 0n);
      const data = await runWalletSend(credentials.ownAddress, async () => {
        // The seqno and the balance are read again under the lock: a transfer sent meanwhile has moved
        // the seqno on, or is still on its way, or has spent what this batch needs
        const current = await fetchToncenterWalletState(credentials.ownAddress);

        if (!current || isTransferPending(credentials.ownAddress, current.seqno, pendingSeqno, pendingValidUntil)) {
          throw new Error('Transfer pending');
        }

        const params = buildBatchParams(credentials.ownAddress, keys, current, messages!, requestedUntil);
        const { validUntil } = params;

        // A heavy payload or state init can cost more than the fixed reserve, which stays as the floor
        const fee = await estimateFee(
          credentials.ownAddress,
          await buildUnsignedBatchTransferBodyBoc(params),
          current.isDeployed ? undefined : await buildWalletInitBocs(keys.anchorPublicKey),
        );
        const reserve = getBigIntMax(fee ?? 0n, GRAM_TRANSFER_FEE_RESERVE * BigInt(params.messages.length));

        if (total + reserve > current.balance) {
          throw new Error('Insufficient funds');
        }

        const signed = await buildSignedBatchTransfer({ ...params, secretSeed: keys.seeds.signing });
        await rememberSentTransfer(credentials.ownAddress, current.seqno, validUntil);

        const updates = await sendTransferData(signed, undefined, generateRandomBigInt()).catch((err: unknown) => {
          forgetRefusedTransfer(credentials.ownAddress, current.seqno, err);
          throw err;
        });
        const sent = buildApiWalletSentTransfer(updates, { seqno: current.seqno, validUntil });

        if (sent) {
          sentTransfer = {
            msgHash: sent.msgHash, seqno: current.seqno, validUntil, amount: total, toAddress: firstMessage.address,
          };
        }

        return signed;
      });

      response = { id: appRequest.id, result: bufferToBase64(data) };
    } catch {
      // The request is claimed as accepted by now, so the failure is reported to the dApp as an unknown error
      response = buildTonConnectError(appRequest.id, 0, 'Could not send the transaction');
    }
  }

  const finalResponse = response!;
  const body = serializeBytes(encryptTonConnectMessage(finalResponse, session.dappClientId, keys.secretKey));

  pendingResponses.set(cacheKey, {
    body, expires,
    responseError: 'error' in finalResponse ? finalResponse.error.code : undefined,
    sentTransfer,
    shouldCloseSession,
  });

  await TON_CONNECT_IDB_STORE.set(cacheKey, {
    userId: currentUserId,
    sessionId: session.id,
    msgId: request.msgId,
    traceId: request.traceId,
    body,
    expires,
    shouldCloseSession,
  } satisfies StoredResponse).catch(() => undefined);

  return publishTonConnectCachedResponse({ session, request, ...credentials }, cacheKey, body);
}

// The relayer can send the signed message at any moment until it expires, and it takes the current
// seqno, so the seqno is recorded like a transfer in flight
async function signTonConnectMessage(
  messages: TonConnectBatchMessages, requestedUntil: number | undefined, keys: TonConnectKeys, ownAddress: string,
  pendingSeqno?: number, pendingValidUntil?: number,
) {
  return runWalletSend(ownAddress, async () => {
    const current = await fetchToncenterWalletState(ownAddress);

    if (!current?.isSupportedContract
      || isTransferPending(ownAddress, current.seqno, pendingSeqno, pendingValidUntil)) {
      throw new Error('Transfer pending');
    }

    const params = buildBatchParams(ownAddress, keys, current, messages, requestedUntil);
    const signed = await buildSignedInternalBatchTransfer({ ...params, secretSeed: keys.seeds.signing });
    await rememberSentTransfer(ownAddress, current.seqno, params.validUntil);

    return signed;
  });
}

async function signTonConnectRequestData(
  params: string, session: ApiTonConnectSession, keys: TonConnectKeys, ownAddress: string,
) {
  const payload = JSON.parse(params);
  const data = await parseTonConnectSignData(payload, ownAddress);
  const domain = getTonConnectDomain(session.manifest!.url);
  const timestamp = getServerTime();
  const signature = await signTonConnectData({
    data, address: parseAddress(ownAddress)!, domain, timestamp, seed: keys.seeds.signing,
  });

  return {
    signature: bufferToBase64(signature), address: toRawAddress(ownAddress), timestamp, domain, payload,
  };
}

export async function republishTonConnectResponses(currentUserId: string): Promise<void> {
  const entries = await TON_CONNECT_IDB_STORE.entries().catch(() => []) as [string, StoredResponse][];
  const now = getServerTime();

  for (const [key, stored] of entries) {
    // The store is shared by every account slot, so an expired record goes whoever it belongs to
    if (stored.expires <= now) {
      await TON_CONNECT_IDB_STORE.del(key).catch(() => undefined);
      continue;
    }

    if (stored.userId !== currentUserId || !stored.body) continue;

    let isPublished = false;

    try {
      await submitTonConnectResponse({ ...stored, body: stored.body });
      isPublished = true;

      if (stored.shouldCloseSession) await closeTonConnectSession(stored.sessionId);
    } catch (err: unknown) {
      // Only an answer that did not reach the server is worth another try: a refusal means the request
      // is gone or answered already. A close that failed is tried again along with the answer.
      if (isPublished || getTonConnectErrorCode(err) === 'TONCONNECT_FAILED') continue;
    }

    await TON_CONNECT_IDB_STORE.del(key).catch(() => undefined);
  }
}

async function restoreStoredResponse(cacheKey: string, currentUserId: string) {
  const stored = await TON_CONNECT_IDB_STORE.get<StoredResponse>(cacheKey).catch(() => undefined);
  if (!stored || stored.userId !== currentUserId || stored.expires <= getServerTime()) return undefined;

  const response: PendingResponse = {
    body: stored.body, expires: stored.expires, shouldCloseSession: stored.shouldCloseSession,
  };

  pendingResponses.set(cacheKey, response);

  return response;
}

async function publishTonConnectCachedResponse(
  { session, request }: TonConnectRequestParams, cacheKey: string, body: string,
): Promise<TonConnectResponse> {
  await submitTonConnectResponse({ sessionId: session.id, msgId: request.msgId, body, traceId: request.traceId });

  const response = pendingResponses.get(cacheKey);

  // A `disconnect` request is answered with `{}` and a plain close: the server takes no `disconnect` event
  // in return for one. A close that fails keeps the record, so the next attempt publishes and closes again.
  if (response?.shouldCloseSession) await closeTonConnectSession(session.id);

  if (response) response.isPublished = true;

  await TON_CONNECT_IDB_STORE.del(cacheKey).catch(() => undefined);

  return { success: true, responseError: response?.responseError, sentTransfer: response?.sentTransfer };
}

async function deriveTonConnectKeys(
  session: ApiTonConnectSession, credentials: TonConnectCredentials,
): Promise<TonConnectKeys> {
  // A swapped wallet keeps the session ids of the account, a re-registered session issues a fresh nonce,
  // and a key rotation keeps the address, so all of them are part of the key
  const cacheKey = `${session.id}:${credentials.ownAddress}:${credentials.ownPublicKey}`
    + `:${session.dappClientId}:${session.nonce}`;
  let keys = sessionKeys.get(cacheKey)?.keys;

  if (!keys) {
    const exported = await exportWalletSecretPhrase(credentials);
    if ('error' in exported) throw new TonConnectError(exported.error);

    const seeds = await deriveWalletSeeds(exported.words, credentials.ownAddress, credentials.ownPublicKey);
    if (!seeds) throw new TonConnectError('UNSUPPORTED_WALLET');

    const sessionKey = await deriveTonConnectSessionKey(
      seeds.anchor, session.dappClientId, deserializeBytes(session.nonce),
    );

    keys = { ...sessionKey, seeds, anchorPublicKey: await getEd25519PublicKey(seeds.anchor) };
    rememberTonConnectKeys(cacheKey, keys);
  }

  if (session.clientId && session.clientId.toLowerCase() !== keys.clientId) {
    throw new TonConnectError('TONCONNECT_CLIENT_ID_INVALID');
  }

  return keys;
}

function rememberTonConnectKeys(cacheKey: string, keys: TonConnectKeys) {
  const cached = sessionKeys.get(cacheKey);
  if (cached) clearTimeout(cached.timeoutId);

  sessionKeys.set(cacheKey, {
    keys, timeoutId: setTimeout(() => sessionKeys.delete(cacheKey), SESSION_KEY_RETENTION_MS),
  });
}

function forgetTonConnectKeys(sessionId: string) {
  for (const [cacheKey, cached] of sessionKeys) {
    if (!cacheKey.startsWith(`${sessionId}:`)) continue;

    clearTimeout(cached.timeoutId);
    sessionKeys.delete(cacheKey);
  }
}

// The size check, the fee estimate and the signed message all use the same parameters, so they
// describe the same message
function buildBatchParams(
  ownAddress: string, keys: TonConnectKeys, state: WalletChainState, messages: TonConnectBatchMessages,
  requestedUntil: number | undefined,
) {
  const now = getServerTime();

  return {
    ownAddress: parseAddress(ownAddress)!,
    anchorPublicKey: keys.anchorPublicKey,
    shouldDeploy: !state.isDeployed,
    messages,
    seqno: state.seqno,
    now,
    validUntil: Math.min(requestedUntil ?? now + TRANSFER_TTL_SECONDS, now + MAX_REQUESTED_TTL_SECONDS),
  };
}

async function buildTonConnectTransferMessages(transaction: ApiTonConnectTransaction) {
  return Promise.all(transaction.messages.map(async (message) => ({
    to: parseAddress(message.address)!, amount: BigInt(message.amount),
    payload: message.payload ? await parseBoc(message.payload) : undefined,
    stateInit: message.stateInit ? await parseBoc(message.stateInit) : undefined,
  })));
}

export function createTonConnectSession(params: {
  dappClientId: string; manifestUrl: string;
}): Promise<ApiTonConnectResult<{ session: ApiTonConnectSession }>> {
  return runTonConnect(async () => ({ session: await invokeTonConnectCreateSession(params) }));
}

export function fetchTonConnectPending(lookup: TonConnectPendingLookup): Promise<ApiTonConnectResult<{
  session: ApiTonConnectSession; requests: ApiTonConnectRequest[];
}>> {
  return runTonConnect(() => invokeTonConnectGetPending(lookup));
}

export function fetchTonConnectSessions({ currentUserId }: {
  currentUserId: string;
}): Promise<ApiTonConnectResult<{ sessions: ApiTonConnectSession[] }>> {
  void republishTonConnectResponses(currentUserId);

  return runTonConnect(async () => ({ sessions: await invokeTonConnectGetSessions() }));
}

async function invokeTonConnectCreateSession({ dappClientId, manifestUrl }: {
  dappClientId: string; manifestUrl: string;
}) {
  const result = await invokeRequest(new GramJs.wallet.TonConnectCreateSession({ dappClientId, manifestUrl }), {
    shouldThrow: true,
  });

  return buildApiTonConnectSession(result!);
}

async function invokeTonConnectGetPending({ currentUserId, dappClientId, sessionId }: TonConnectPendingLookup) {
  // An answer made before a reload is published first, or the server would list its request again
  // as one still waiting for the user
  await republishTonConnectResponses(currentUserId);

  const result = await invokeRequest(new GramJs.wallet.TonConnectGetPending({
    dappClientId, sessionId: sessionId ? BigInt(sessionId) : undefined,
  }), { shouldThrow: true });

  return {
    session: buildApiTonConnectSession(result!.session), requests: result!.requests.map(buildApiTonConnectRequest),
  };
}

async function invokeTonConnectGetSessions() {
  const result = await invokeRequest(new GramJs.wallet.TonConnectGetSessions(), { shouldThrow: true });

  return result!.sessions.map(buildApiTonConnectSession);
}

async function registerTonConnectKey(sessionId: string, clientId: string) {
  const result = await invokeRequest(new GramJs.wallet.TonConnectRegisterKey({
    sessionId: BigInt(sessionId), clientId,
  }), { shouldThrow: true });

  return { challenge: result!.challenge, eventId: parseEventId(result!.eventId) };
}

async function submitTonConnectConnectResult({ sessionId, challengeAnswer, body, isError, traceId }: {
  sessionId: string;
  challengeAnswer: Uint8Array<ArrayBuffer>;
  body: Uint8Array<ArrayBuffer>;
  isError?: boolean;
  traceId?: string;
}) {
  await invokeRequest(new GramJs.wallet.TonConnectSubmitConnectResult({
    sessionId: BigInt(sessionId), challengeAnswer, body, error: isError || undefined, traceId,
  }), { shouldThrow: true });
}

async function claimTonConnectRequest({ sessionId, msgId, appRequestId, challengeAnswer, isDeclined }: {
  sessionId: string;
  msgId: number;
  appRequestId: string;
  challengeAnswer?: Uint8Array<ArrayBuffer>;
  isDeclined?: boolean;
}) {
  await invokeRequest(new GramJs.wallet.TonConnectClaimRequest({
    sessionId: BigInt(sessionId), msgId, appRequestId, challengeAnswer, declined: isDeclined || undefined,
  }), { shouldThrow: true });
}

// The server keeps the first response it receives: submitting again from the same device succeeds
// without publishing anything, so a retry after a lost answer is safe
async function submitTonConnectResponse({ sessionId, msgId, body, traceId }: {
  sessionId: string; msgId: number; body: string; traceId?: string;
}) {
  await invokeRequest(new GramJs.wallet.TonConnectSubmitResponse({
    sessionId: BigInt(sessionId), msgId, body: deserializeBytes(body), traceId,
  }), { shouldThrow: true });
}

async function fetchTonConnectNextEventId(sessionId: string) {
  const result = await invokeRequest(new GramJs.wallet.TonConnectNextEventId({ sessionId: BigInt(sessionId) }), {
    shouldThrow: true,
  });

  return parseEventId(result!.eventId);
}

// With a `body`, the encrypted `disconnect` event, the server tells the dApp the wallet is leaving;
// without one it only closes the session, which is what answers a `disconnect` the dApp sent itself
async function closeTonConnectSession(sessionId: string, body?: Uint8Array<ArrayBuffer>) {
  await invokeRequest(new GramJs.wallet.TonConnectCloseSession({ sessionId: BigInt(sessionId), body }), {
    shouldThrow: true,
  });

  forgetTonConnectKeys(sessionId);
}

function parseEventId(eventId: bigint) {
  const id = Number(eventId);
  if (!Number.isSafeInteger(id)) throw new TonConnectError('BAD_REQUEST_ID');

  return id;
}

async function runTonConnect<T>(callback: () => Promise<T>): Promise<ApiTonConnectResult<T>> {
  try {
    return await callback();
  } catch (err: unknown) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[tonConnect] Request failed:', err);
    }

    return { error: getTonConnectErrorCode(err) };
  }
}

function getTonConnectErrorCode(err: unknown): ApiTonConnectError {
  if (err instanceof TonConnectError) return err.code;

  const message = err instanceof RPCError ? err.errorMessage : err instanceof Error ? err.message : undefined;

  // The server names its errors `TONCONNECT_…`; the list keeps the prefix only where the bare name
  // would clash with another error
  const name = message?.replace(TON_CONNECT_ERROR_PREFIX, '');

  return TON_CONNECT_ERRORS.find((error) => error === message || error === name) || 'TONCONNECT_FAILED';
}
