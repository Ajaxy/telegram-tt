import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { selectActiveGroupCall, selectGroupCallParticipant, selectPhoneCallUser } from '../../selectors/calls';
import { updateGroupCall, updateGroupCallParticipant } from '../../reducers/calls';
import { omit } from '../../../util/iteratees';
import type { ApiCallProtocol } from '../../../lib/secret-sauce';
import {
  handleUpdateGroupCallConnection,
  handleUpdateGroupCallParticipants,
  joinPhoneCall, processSignalingMessage,
} from '../../../lib/secret-sauce';
import type { ApiPhoneCall } from '../../../api/types';
import { ARE_CALLS_SUPPORTED } from '../../../util/environment';
import { callApi } from '../../../api/gramjs';
import * as langProvider from '../../../util/langProvider';
import { EMOJI_DATA, EMOJI_OFFSETS } from '../../../util/phoneCallEmojiConstants';

addActionHandler('apiUpdate', (global, actions, update) => {
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
        actions.leaveGroupCall({ isFromLibrary: true });
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
        void handleUpdateGroupCallParticipants(participants);
      }
      break;
    }
    case 'updateGroupCallConnection': {
      if (update.data.stream) {
        actions.showNotification({ message: 'Big live streams are not yet supported' });
        actions.leaveGroupCall();
        break;
      }
      void handleUpdateGroupCallConnection(update.data, update.presentation);

      const groupCall = selectActiveGroupCall(global);
      if (groupCall?.participants && Object.keys(groupCall.participants).length > 0) {
        void handleUpdateGroupCallParticipants(Object.values(groupCall.participants));
      }
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

      const call: ApiPhoneCall = {
        ...phoneCall,
        ...update.call,
      };

      const isOutgoing = phoneCall?.adminId === currentUserId;

      global = {
        ...global,
        phoneCall: call,
      };

      if (phoneCall && phoneCall.id && call.id !== phoneCall.id) {
        if (call.state !== 'discarded') {
          callApi('discardCall', {
            call,
            isBusy: true,
          });
        }
        return undefined;
      }

      const {
        accessHash, state, connections, gB,
      } = call;

      if (state === 'active' || state === 'accepted') {
        if (!verifyPhoneCallProtocol(call.protocol)) {
          const user = selectPhoneCallUser(global);
          actions.hangUp();
          actions.showNotification({ message: langProvider.getTranslation('VoipPeerIncompatible', user?.firstName) });
          return undefined;
        }
      }

      if (state === 'discarded') {
        // Discarded from other device
        if (!phoneCall) return undefined;

        return {
          ...global,
          ...(call.needRating && { ratingPhoneCall: call }),
          isCallPanelVisible: undefined,
        };
      } else if (state === 'accepted' && accessHash && gB) {
        (async () => {
          const { gA, keyFingerprint, emojis } = await callApi('confirmPhoneCall', [gB, EMOJI_DATA, EMOJI_OFFSETS])!;

          global = getGlobal();
          const newCall = {
            ...global.phoneCall,
            emojis,
          } as ApiPhoneCall;

          setGlobal({
            ...global,
            phoneCall: newCall,
          });

          callApi('confirmCall', {
            call, gA, keyFingerprint,
          });
        })();
      } else if (state === 'active' && connections && phoneCall?.state !== 'active') {
        if (!isOutgoing) {
          callApi('receivedCall', { call });
          (async () => {
            const { emojis } = await callApi('confirmPhoneCall', [call!.gAOrB!, EMOJI_DATA, EMOJI_OFFSETS])!;

            global = getGlobal();
            const newCall = {
              ...global.phoneCall,
              emojis,
            } as ApiPhoneCall;

            setGlobal({
              ...global,
              phoneCall: newCall,
            });
          })();
        }
        void joinPhoneCall(
          connections, actions.sendSignalingData, isOutgoing, Boolean(call?.isVideo), actions.apiUpdate,
        );
      }

      return global;
    }
    case 'updatePhoneCallConnectionState': {
      const { connectionState } = update;

      if (!global.phoneCall) return global;

      if (connectionState === 'closed' || connectionState === 'disconnected' || connectionState === 'failed') {
        actions.hangUp();
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

      callApi('decodePhoneCallData', [update.data])?.then(processSignalingMessage);
      break;
    }
  }

  return undefined;
});

function verifyPhoneCallProtocol(protocol?: ApiCallProtocol) {
  return protocol?.libraryVersions.some((version) => {
    return version === '4.0.0' || version === '4.0.1';
  });
}
