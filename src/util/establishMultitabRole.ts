import { ESTABLISH_BROADCAST_CHANNEL_NAME } from '../config';
import { createCallbackManager } from './callbacks';
import { getPasscodeHash, setPasscodeHash } from './passcode';
import { IS_MULTITAB_SUPPORTED } from './windowEnvironment';

const ESTABLISH_TIMEOUT = 100;

const { addCallback, runCallbacks } = createCallbackManager();
const { addCallback: addCallbackTokenDied, runCallbacks: runCallbacksTokenDied } = createCallbackManager();
const token = Number(Math.random().toString().substring(2));
const collectedTokens = new Set([token]);
let channel = IS_MULTITAB_SUPPORTED ? new BroadcastChannel(ESTABLISH_BROADCAST_CHANNEL_NAME) : undefined;

let isEstablished = false;
let masterToken: number | undefined;
let isWaitingForMaster = false;
let reestablishToken: number | undefined;

type EstablishMessage = {
  collectedTokens: Set<number>;
  masterToken?: number;
  tokenDied?: number;
  currentPasscodeHash?: ArrayBuffer;
  reestablishToken?: number;
  shouldGiveUpMaster?: boolean;
  hasGaveUpMaster?: boolean;
};

const handleMessage = ({ data }: { data: EstablishMessage }) => {
  if (!channel || !data) return;

  if (data.currentPasscodeHash) {
    setPasscodeHash(data.currentPasscodeHash);
  }

  if (data.hasGaveUpMaster && isWaitingForMaster) {
    masterToken = token;
    isWaitingForMaster = false;
    runCallbacks(true);
    return;
  }

  if (data.shouldGiveUpMaster) {
    if (masterToken === token) {
      runCallbacks(false);
      channel.postMessage({ currentPasscodeHash: getPasscodeHash(), hasGaveUpMaster: true });
    }
    masterToken = data.masterToken;
    return;
  }

  if (data.tokenDied) {
    runCallbacksTokenDied(data.tokenDied);
    collectedTokens.delete(data.tokenDied);
    if (data.tokenDied === masterToken) {
      collectedTokens.delete(data.tokenDied);
      masterToken = undefined;
      isEstablished = false;
      reestablishToken = data.tokenDied;

      channel.postMessage({
        collectedTokens,
        masterToken,
        reestablishToken,
      });
      if (collectedTokens.size === 1) {
        isEstablished = true;
        masterToken = token;
        reestablishToken = undefined;
        runCallbacks(true);
      }
    }
  }

  if (data.collectedTokens) {
    if (!data.reestablishToken && reestablishToken) {
      return;
    }
    if (data.reestablishToken && reestablishToken !== data.reestablishToken) {
      data.collectedTokens.delete(data.reestablishToken);

      reestablishToken = data.reestablishToken;
    }
    const prevLength = collectedTokens.size;
    data.collectedTokens.forEach((l) => collectedTokens.add(l));
    if (reestablishToken) data.collectedTokens.delete(reestablishToken);

    if (!isEstablished) {
      if (data.masterToken) {
        reestablishToken = undefined;
        masterToken = data.masterToken;
        runCallbacks(masterToken === token);

        if (!isEstablished) {
          channel.postMessage({
            collectedTokens,
            masterToken,
            reestablishToken,
          });
        }
        isEstablished = true;
      } else if (prevLength !== collectedTokens.size) {
        channel.postMessage({
          collectedTokens,
          masterToken,
          reestablishToken,
        });
      } else {
        reestablishToken = undefined;
        masterToken = Math.max(...Array.from(collectedTokens));
        runCallbacks(masterToken === token);

        if (!isEstablished) {
          channel.postMessage({
            collectedTokens,
            masterToken,
            reestablishToken,
          });
        }
        isEstablished = true;
      }
    } else if (!data.masterToken) {
      channel.postMessage({
        collectedTokens,
        masterToken,
        reestablishToken,
      });
    }
  }
};

export function establishMultitabRole() {
  if (!channel) return;

  channel.addEventListener('message', handleMessage);

  channel.postMessage({ collectedTokens });

  // To make the connection faster, we can ignore the waiting and connect right away,
  // and then if we realize we're not master, drop the connection
  setTimeout(() => {
    if (masterToken === undefined) {
      masterToken = token;
      runCallbacks(true);
    }
  }, ESTABLISH_TIMEOUT);

  window.addEventListener('beforeunload', signalTokenDead);
}

export function signalTokenDead() {
  if (!channel) return;

  runCallbacksTokenDied(token);
  channel.removeEventListener('message', handleMessage);
  channel.postMessage({ tokenDied: token, currentPasscodeHash: getPasscodeHash() });
  channel.close();
  channel = undefined;
}

export function signalPasscodeHash() {
  if (!channel) return;
  channel.postMessage({ currentPasscodeHash: getPasscodeHash() });
}

export function getCurrentTabId() {
  return token;
}

export function getAllMultitabTokens() {
  return Array.from(collectedTokens);
}

export function reestablishMasterToSelf() {
  if (!channel) return;

  isWaitingForMaster = true;
  channel.postMessage({
    collectedTokens, masterToken: token, shouldGiveUpMaster: true,
  });
}

export const subscribeToTokenDied = addCallbackTokenDied;
export const subscribeToMasterChange = addCallback;

export function isMasterTab() {
  return masterToken === token;
}
