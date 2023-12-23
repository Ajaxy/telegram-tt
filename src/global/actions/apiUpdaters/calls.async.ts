import type { ApiPhoneCall } from '../../../api/types';
import type { ApiCallProtocol } from '../../../lib/secret-sauce';
import type { ActionReturnType } from '../../types';

import {
  handleUpdateGroupCallConnection,
  handleUpdateGroupCallParticipants,
  joinPhoneCall, processSignalingMessage,
} from '../../../lib/secret-sauce';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import * as langProvider from '../../../util/langProvider';
import { EMOJI_DATA, EMOJI_OFFSETS } from '../../../util/phoneCallEmojiConstants';
import { ARE_CALLS_SUPPORTED } from '../../../util/windowEnvironment';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { addUsers } from '../../reducers';
import { updateGroupCall, updateGroupCallParticipant } from '../../reducers/calls';
import { updateTabState } from '../../reducers/tabs';
import { selectActiveGroupCall, selectGroupCallParticipant, selectPhoneCallUser } from '../../selectors/calls';

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
        void handleUpdateGroupCallParticipants(participants);
      }
      break;
    }
    case 'updateGroupCallConnection': {
      if (update.data.stream) {
        actions.showNotification({ message: 'Big live streams are not yet supported', tabId: getCurrentTabId() });
        if ('leaveGroupCall' in actions) actions.leaveGroupCall({ tabId: getCurrentTabId() });
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
      setGlobal(global);
      global = getGlobal();

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
          if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });
          actions.showNotification({
            message: langProvider.translate('VoipPeerIncompatible', user?.firstName),
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
          const { gA, keyFingerprint, emojis } = await callApi('confirmPhoneCall', [gB, EMOJI_DATA, EMOJI_OFFSETS])!;

          global = getGlobal();
          const newCall = {
            ...global.phoneCall,
            emojis,
          } as ApiPhoneCall;

          global = {
            ...global,
            phoneCall: newCall,
          };
          setGlobal(global);

          const result = await callApi('confirmCall', {
            call, gA, keyFingerprint,
          });
          if (result) {
            global = getGlobal();
            global = addUsers(global, buildCollectionByKey(result.users, 'id'));
            setGlobal(global);
          }
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

            global = {
              ...global,
              phoneCall: newCall,
            };
            setGlobal(global);
          })();
        }
        void joinPhoneCall(
          connections,
          actions.sendSignalingData,
          isOutgoing,
          Boolean(call?.isVideo),
          Boolean(call.isP2pAllowed),
          actions.apiUpdate,
        );
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
