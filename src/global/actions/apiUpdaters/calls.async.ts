import type { ApiPhoneCall, ApiPhoneCallCustomParameters } from '../../../api/types';
import type { ApiCallProtocol } from '../../../lib/vibecalls';
import type { ActionReturnType } from '../../types';

import { CALL_PROTOCOL_LIBRARY_VERSIONS, DEBUG_CALLS } from '../../../config';
import {
  handleUpdateGroupCallConnection,
  handleUpdateGroupCallParticipants,
  joinPhoneCall, processSignalingMessage, sanitizePrimitiveRecord,
} from '../../../lib/vibecalls';
import { ARE_CALLS_SUPPORTED } from '../../../util/browser/windowEnvironment';
import { logDebugMessage } from '../../../util/debugConsole';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { omit } from '../../../util/iteratees';
import * as langProvider from '../../../util/oldLangProvider';
import { EMOJI_DATA, EMOJI_OFFSETS } from '../../../util/phoneCallEmojiConstants';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateGroupCall, updateGroupCallParticipant } from '../../reducers/calls';
import { updateTabState } from '../../reducers/tabs';
import { selectActiveGroupCall, selectGroupCallParticipant, selectPhoneCallUser } from '../../selectors/calls';

let phoneCallSignalingDataPromise = Promise.resolve();
let groupCallNegotiationPromise = Promise.resolve();

type QueuedPhoneCallSignalingData = {
  callId?: string;
  data: number[];
};

function enqueueGroupCallNegotiation(callback: () => Promise<void>) {
  groupCallNegotiationPromise = groupCallNegotiationPromise
    .catch(() => undefined)
    .then(callback)
    .catch((err) => {
      logPhoneCallDebug('Failed to process group call negotiation update', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  const { activeGroupCallId } = global.groupCalls;

  switch (update['@type']) {
    case 'updateGroupCallLeavePresentation': {
      actions.toggleGroupCallPresentation({ value: false });
      break;
    }
    case 'updateGroupCallStreams': {
      if (!update.userId || !activeGroupCallId) break;
      if (!selectGroupCallParticipant(global, activeGroupCallId, update.userId)) break;

      return updateGroupCallParticipant(global, activeGroupCallId, update.userId, omit(update, ['@type', 'userId']));
    }
    case 'updateGroupCallConnectionState': {
      if (!activeGroupCallId) break;

      if (update.connectionState === 'disconnected') {
        if ('leaveGroupCall' in actions) actions.leaveGroupCall({ isFromLibrary: true, tabId: getCurrentTabId() });
        break;
      }

      return updateGroupCall(global, activeGroupCallId, {
        connectionState: update.connectionState,
        isSpeakerDisabled: update.isSpeakerDisabled,
      });
    }
    case 'updateGroupCallParticipants': {
      const { groupCallId, participants } = update;
      if (activeGroupCallId === groupCallId) {
        enqueueGroupCallNegotiation(() => handleUpdateGroupCallParticipants(participants));
      }
      break;
    }
    case 'updateGroupCallConnection': {
      if (update.data.stream) {
        actions.showNotification({ message: 'Big live streams are not yet supported', tabId: getCurrentTabId() });
        if ('leaveGroupCall' in actions) actions.leaveGroupCall({ tabId: getCurrentTabId() });
        break;
      }
      enqueueGroupCallNegotiation(async () => {
        await handleUpdateGroupCallConnection(update.data, update.presentation);

        global = getGlobal();
        const groupCall = selectActiveGroupCall(global);
        if (groupCall?.participants && Object.keys(groupCall.participants).length > 0) {
          await handleUpdateGroupCallParticipants(Object.values(groupCall.participants));
        }
      });
      break;
    }
    case 'updatePhoneCallMediaState':
      return {
        ...global,
        phoneCall: {
          ...global.phoneCall,
          ...omit(update, ['@type']),
        } as ApiPhoneCall,
      };
    case 'updatePhoneCall': {
      if (!ARE_CALLS_SUPPORTED) return undefined;
      const { phoneCall, currentUserId } = global;

      // Another call (P2P or group) is already active - ignore here so we don't show the popup;
      // the non-async handler discards the new call as busy.
      const isInOtherPhoneCall = Boolean(phoneCall?.id) && update.call.id !== phoneCall?.id;
      const isInGroupCall = Boolean(global.groupCalls.activeGroupCallId) && !phoneCall;
      if (isInOtherPhoneCall || isInGroupCall) {
        return undefined;
      }

      const call: ApiPhoneCall = {
        ...phoneCall,
        ...update.call,
      };

      const isOutgoing = phoneCall?.adminId === currentUserId;

      global = {
        ...global,
        phoneCall: call,
      };
      setGlobal(global);
      global = getGlobal();

      const {
        accessHash, state, connections, gB,
      } = call;

      if (state === 'active' || state === 'accepted') {
        if (!verifyPhoneCallProtocol(call.protocol)) {
          const user = selectPhoneCallUser(global);
          if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });
          actions.showNotification({
            message: langProvider.oldTranslate('VoipPeerIncompatible', user?.firstName),
            tabId: getCurrentTabId(),
          });
          return undefined;
        }
      }

      if (state === 'discarded') {
        // Discarded from other device
        if (!phoneCall) return undefined;

        return updateTabState(global, {
          ...(call.needRating && { ratingPhoneCall: call }),
          isCallPanelVisible: undefined,
        }, getCurrentTabId());
      } else if (state === 'accepted' && accessHash && gB) {
        (async () => {
          try {
            const activeCallId = call.id;
            const result = await callApi('confirmPhoneCall', {
              gAOrB: gB,
              emojiData: EMOJI_DATA,
              emojiOffsets: EMOJI_OFFSETS,
            });
            if (!result) {
              logPhoneCallDebug('Failed to confirm accepted phone call', {
                callId: activeCallId,
              });
              return;
            }
            const { gA, keyFingerprint, emojis } = result;

            global = getGlobal();
            if (global.phoneCall?.id !== activeCallId) {
              return;
            }

            await callApi('confirmCall', {
              call, gA, keyFingerprint,
            });

            global = getGlobal();
            if (global.phoneCall?.id !== activeCallId) {
              return;
            }

            const newCall = {
              ...global.phoneCall,
              emojis,
            };

            global = {
              ...global,
              phoneCall: newCall,
            };
            setGlobal(global);
          } catch (err) {
            logPhoneCallDebug('Failed to confirm accepted phone call', {
              callId: call.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();
      } else if (state === 'active' && connections && phoneCall?.state !== 'active') {
        (async () => {
          try {
            const activeCallId = call.id;
            let callConfigResult: Record<string, unknown> | undefined;
            try {
              callConfigResult = await callApi('fetchCallConfig');
            } catch (err) {
              logPhoneCallDebug('Failed to fetch phone call config', {
                error: err instanceof Error ? err.message : String(err),
              });
            }

            const callConfig = sanitizePrimitiveRecord(callConfigResult) || {};
            const customParameters: ApiPhoneCallCustomParameters = Object.assign(
              {},
              callConfig,
              call.customParameters,
            );
            call.customParameters = customParameters;
            global = getGlobal();
            if (global.phoneCall?.id === call.id) {
              global = {
                ...global,
                phoneCall: {
                  ...global.phoneCall,
                  customParameters,
                },
              };
              setGlobal(global);
            }

            global = getGlobal();
            if (global.phoneCall?.id === call.id) {
              await callApi('setPhoneCallSctpEnabled', !customParameters.network_signaling_nosctp);
            }

            if (isOutgoing) {
              if (!call.keyFingerprint) {
                throw new Error('Missing phone call key fingerprint');
              }

              await callApi('verifyPhoneCallKeyFingerprint', {
                expectedKeyFingerprint: call.keyFingerprint,
              });
            }

            if (!isOutgoing) {
              await callApi('receivedCall', { call });
              global = getGlobal();
              if (global.phoneCall?.id !== activeCallId) {
                return;
              }

              if (!call.gAHash) {
                throw new Error('Missing phone call gA hash');
              }

              if (!call.keyFingerprint) {
                throw new Error('Missing phone call key fingerprint');
              }

              const result = await callApi(
                'confirmPhoneCall',
                {
                  gAOrB: call.gAOrB!,
                  emojiData: EMOJI_DATA,
                  emojiOffsets: EMOJI_OFFSETS,
                  gAHash: call.gAHash,
                  expectedKeyFingerprint: call.keyFingerprint,
                },
              );
              if (!result) {
                logPhoneCallDebug('Failed to confirm phone call', {
                  callId: activeCallId,
                });
                return;
              }
              const { emojis } = result;

              global = getGlobal();
              if (global.phoneCall?.id !== activeCallId) {
                return;
              }

              const newCall = {
                ...global.phoneCall,
                emojis,
              };

              global = {
                ...global,
                phoneCall: newCall,
              };
              setGlobal(global);
            }

            global = getGlobal();
            if (global.phoneCall?.id !== activeCallId) {
              return;
            }

            await joinPhoneCall(
              connections,
              actions.sendSignalingData,
              isOutgoing,
              Boolean(call?.isVideo),
              Boolean(call.isP2pAllowed),
              actions.apiUpdate,
            );
          } catch (err) {
            logPhoneCallDebug('Failed to start phone call', {
              error: err instanceof Error ? err.message : String(err),
              callId: call.id,
            });
          }
        })();
      }

      return global;
    }
    case 'updatePhoneCallConnectionState': {
      const { connectionState } = update;

      if (!global.phoneCall) return global;

      if (connectionState === 'closed' || connectionState === 'disconnected' || connectionState === 'failed') {
        if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });
        return undefined;
      }

      return {
        ...global,
        phoneCall: {
          ...global.phoneCall,
          isConnected: connectionState === 'connected',
        },
      };
    }
    case 'updatePhoneCallSignalingData': {
      const { phoneCall } = global;

      if (!phoneCall) {
        break;
      }

      const queued: QueuedPhoneCallSignalingData = {
        callId: phoneCall.id,
        data: update.data,
      };

      phoneCallSignalingDataPromise = phoneCallSignalingDataPromise
        .then(() => processPhoneCallSignalingData(queued))
        .catch((err) => {
          logPhoneCallDebug('Failed to process phone call signaling data', {
            error: err instanceof Error ? err.message : String(err),
            isSctp: isSctpSignalingData(queued.data),
            length: queued.data.length,
          });
        });
      break;
    }
  }

  return undefined;
});

function verifyPhoneCallProtocol(protocol?: ApiCallProtocol) {
  return Boolean(
    protocol
    && CALL_PROTOCOL_LIBRARY_VERSIONS.some((version) => protocol.libraryVersions.includes(version)),
  );
}

async function processPhoneCallSignalingData(queued: QueuedPhoneCallSignalingData) {
  const { data } = queued;
  let global = getGlobal();
  if (global.phoneCall?.id !== queued.callId) {
    return;
  }

  let message;
  try {
    message = await callApi('decodePhoneCallData', { data });
  } catch (err) {
    logPhoneCallDebug('Failed to decode phone call signaling data', {
      error: err instanceof Error ? err.message : String(err),
      isSctp: isSctpSignalingData(data),
      length: data.length,
    });
    return;
  }

  global = getGlobal();
  const activeCall = global.phoneCall;
  if (activeCall?.id !== queued.callId) {
    return;
  }

  let packetCount = 0;
  if (activeCall) {
    try {
      const packets = await callApi('drainPhoneCallSignalingData');
      packetCount = packets?.length || 0;
      if (packets) {
        for (const packetData of packets) {
          await callApi('sendSignalingData', { data: packetData, call: activeCall });
        }
      }
    } catch (err) {
      logPhoneCallDebug('Failed to drain phone call signaling data', {
        error: err instanceof Error ? err.message : String(err),
        isSctp: isSctpSignalingData(data),
        length: data.length,
      });
    }
  }

  if (Array.isArray(message)) {
    for (const item of message) {
      await processSignalingMessage(item);
    }
  } else if (message) {
    await processSignalingMessage(message);
  } else if (!packetCount && !isSctpSignalingData(data)) {
    logPhoneCallDebug('Failed to decode phone call signaling data', {
      length: data.length,
    });
  }
}

function logPhoneCallDebug(message: string, data: Record<string, unknown>) {
  if (!DEBUG_CALLS) return;

  logDebugMessage('warn', `[PhoneCall] ${message}`, data);
}

function isSctpSignalingData(data: number[]) {
  return data.length >= 12
    && data[0] === 0x13
    && data[1] === 0x88
    && data[2] === 0x13
    && data[3] === 0x88;
}
