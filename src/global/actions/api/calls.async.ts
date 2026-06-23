import type { ActionReturnType } from '../../types';

import { DEBUG_CALLS, GROUP_CALL_VOLUME_MULTIPLIER } from '../../../config';
import {
  isStreamEnabled,
  joinGroupCall,
  leaveGroupCall,
  setVolume, startSharingScreen,
  stopPhoneCall,
  toggleStream,
} from '../../../lib/vibecalls';
import { logDebugMessage } from '../../../util/debugConsole';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  removeGroupCall,
  updateActiveGroupCall,
} from '../../reducers/calls';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat, selectPeer, selectTabState, selectUser,
} from '../../selectors';
import {
  selectActiveGroupCall, selectPhoneCallUser,
} from '../../selectors/calls';
import { getGroupCallAudioContext, getGroupCallAudioElement, removeGroupCallAudioElement } from '../ui/calls';
import { loadFullChat } from './chats';

const HANG_UP_UI_DELAY = 500;

addActionHandler('leaveGroupCall', async (global, actions, payload): Promise<void> => {
  const {
    isFromLibrary, shouldDiscard, shouldRemove, rejoin,
    isPageUnload, tabId = getCurrentTabId(),
  } = payload || {};

  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) {
    return;
  }

  global = updateActiveGroupCall(global, { connectionState: 'disconnected' }, groupCall.participantsCount - 1);
  global = {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      activeGroupCallId: undefined,
    },
  };
  setGlobal(global);

  const localParticipantId = groupCall.localJoinAsId ?? global.currentUserId;
  const source = groupCall.localSource
    ?? (localParticipantId ? groupCall.participants[localParticipantId]?.source : undefined);
  await callApi('leaveGroupCall', {
    call: groupCall, isPageUnload, source,
  });
  await callApi('abortRequestGroup', 'call');

  if (shouldDiscard) {
    await callApi('discardGroupCall', {
      call: groupCall,
    });
  }

  global = getGlobal();
  if (shouldRemove) {
    global = removeGroupCall(global, groupCall.id);
  }

  removeGroupCallAudioElement();

  setGlobal(global);

  actions.toggleGroupCallPanel({ force: undefined, tabId });

  if (!isFromLibrary) {
    leaveGroupCall();
  }

  actions.afterHangUp();

  if (rejoin) {
    actions.requestMasterAndJoinGroupCall({
      ...rejoin,
      tabId,
    });
  }
});

addActionHandler('toggleGroupCallVideo', async (global): Promise<void> => {
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  await toggleStream('video');

  await callApi('editGroupCallParticipant', {
    call: groupCall,
    videoStopped: !isStreamEnabled('video'),
    participant: user,
  });
});

addActionHandler('requestToSpeak', (global, actions, payload): ActionReturnType => {
  const { value } = payload || { value: true };
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  void callApi('editGroupCallParticipant', {
    call: groupCall,
    raiseHand: value,
    participant: user,
  });
});

addActionHandler('setGroupCallParticipantVolume', (global, actions, payload): ActionReturnType => {
  const { participantId, volume } = payload;

  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, participantId);
  if (!user || !groupCall) {
    return;
  }

  setVolume(participantId, Math.floor(volume / GROUP_CALL_VOLUME_MULTIPLIER) / 100);

  void callApi('editGroupCallParticipant', {
    call: groupCall,
    volume: Number(volume),
    participant: user,
  });
});

addActionHandler('toggleGroupCallMute', async (global, actions, payload): Promise<void> => {
  const { participantId, value } = payload || {};
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, participantId || global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  const muted = value === undefined ? isStreamEnabled('audio', user.id) : value;

  if (!participantId) {
    await toggleStream('audio');
  } else {
    setVolume(participantId, muted ? 0 : 1);
  }

  await callApi('editGroupCallParticipant', {
    call: groupCall,
    muted,
    participant: user,
  });
});

addActionHandler('toggleGroupCallPresentation', async (global, actions, payload): Promise<void> => {
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  const value = payload?.value !== undefined ? payload?.value : !isStreamEnabled('presentation');
  if (value) {
    const params = await startSharingScreen();
    if (!params) {
      return;
    }

    await callApi('joinGroupCallPresentation', {
      call: groupCall,
      params,
    });
  } else {
    await toggleStream('presentation', false);
    await callApi('leaveGroupCallPresentation', {
      call: groupCall,
    });
  }

  await callApi('editGroupCallParticipant', {
    call: groupCall,
    presentationPaused: !isStreamEnabled('presentation'),
    participant: user,
  });
});

addActionHandler('connectToActiveGroupCall', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) return;

  if (groupCall.connectionState === 'discarded') {
    actions.showNotification({ message: 'This voice chat is not active', tabId });
    return;
  }

  const audioElement = getGroupCallAudioElement();
  const audioContext = getGroupCallAudioContext();

  if (!audioElement || !audioContext) {
    return;
  }

  const { currentUserId } = global;

  if (!currentUserId) return;

  const localParticipantId = groupCall.localJoinAsId ?? currentUserId;
  const joinAs = groupCall.localJoinAsId ? selectPeer(global, groupCall.localJoinAsId) : undefined;
  if (groupCall.localJoinAsId && !joinAs) return;

  const params = await joinGroupCall(localParticipantId, audioContext, audioElement, actions.apiUpdate);
  if (!params) {
    actions.showNotification({
      // TODO[lang] Localize error message
      message: 'Failed to join voice chat',
      tabId,
    });
    actions.leaveGroupCall({ tabId });
    return;
  }

  const result = await callApi('joinGroupCall', {
    call: groupCall,
    params,
    inviteHash: groupCall.inviteHash,
    joinAs,
  });

  global = getGlobal();

  if (!result) {
    actions.showNotification({
      // TODO[lang] Localize error message
      message: 'Failed to join voice chat',
      tabId,
    });
    actions.leaveGroupCall({ tabId });
    return;
  }

  if (params.ssrc !== undefined) {
    global = updateActiveGroupCall(global, { localSource: params.ssrc });
    setGlobal(global);
  }

  actions.loadMoreGroupCallParticipants();

  if (groupCall.chatId) {
    const chat = selectChat(global, groupCall.chatId);
    if (!chat) return;
    await loadFullChat(global, actions, chat);
  }
});

addActionHandler('connectToActivePhoneCall', async (global, actions): Promise<void> => {
  const { phoneCall } = global;

  if (!phoneCall) return;

  const user = selectPhoneCallUser(global);

  if (!user) return;

  const dhConfig = await callApi('fetchDhConfig');

  if (!dhConfig) return;

  await callApi('createPhoneCallState', {
    isOutgoing: true,
    shouldUseSctp: !phoneCall.customParameters?.network_signaling_nosctp,
  });

  const gAHash = await callApi('requestPhoneCall', dhConfig);

  const result = await callApi('requestCall', { user, gAHash, isVideo: phoneCall.isVideo });

  if (!result) {
    if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });
  }
});

addActionHandler('acceptCall', async (global): Promise<void> => {
  const { phoneCall } = global;

  if (!phoneCall) return;

  const dhConfig = await callApi('fetchDhConfig');
  if (!dhConfig) return;

  await callApi('createPhoneCallState', {
    isOutgoing: false,
    shouldUseSctp: !phoneCall.customParameters?.network_signaling_nosctp,
  });

  const gB = await callApi('acceptPhoneCall', dhConfig);
  await callApi('acceptCall', { call: phoneCall, gB });
});

addActionHandler('sendSignalingData', (global, actions, payload): ActionReturnType => {
  const { phoneCall } = global;
  if (!phoneCall) {
    return;
  }

  (async () => {
    try {
      const encodedData = await callApi('encodePhoneCallData', { data: payload });

      if (!encodedData) {
        return;
      }

      await callApi('sendSignalingData', { data: encodedData, call: phoneCall });
      const pendingPackets = await callApi('drainPhoneCallSignalingData');
      if (!pendingPackets) return;

      for (const data of pendingPackets) {
        await callApi('sendSignalingData', { data, call: phoneCall });
      }
    } catch (error) {
      logPhoneCallDebug('Failed to send phone call signaling data', {
        error: summarizeError(error),
      });
    }
  })();
});

function logPhoneCallDebug(message: string, data: Record<string, unknown>) {
  if (!DEBUG_CALLS) return;

  logDebugMessage('warn', `[PhoneCall] ${message}`, data);
}

function summarizeError(error: unknown) {
  return error instanceof Error ? {
    name: error.name,
    message: error.message,
  } : String(error);
}

addActionHandler('closeCallRatingModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    ratingPhoneCall: undefined,
  }, tabId);
});

addActionHandler('setCallRating', (global, actions, payload): ActionReturnType => {
  const { rating, comment, tabId = getCurrentTabId() } = payload;

  const { ratingPhoneCall } = selectTabState(global, tabId);
  if (!ratingPhoneCall) {
    return undefined;
  }

  callApi('setCallRating', { call: ratingPhoneCall, rating, comment });

  return updateTabState(global, {
    ratingPhoneCall: undefined,
  }, tabId);
});

addActionHandler('hangUp', (global, actions, payload): ActionReturnType => {
  const { isPageUnload, tabId = getCurrentTabId() } = payload || {};
  const { phoneCall } = global;

  if (!phoneCall) return undefined;

  if (phoneCall.state === 'discarded') {
    callApi('destroyPhoneCallState');
    stopPhoneCall();

    global = {
      ...global,
      phoneCall: undefined,
    };
    setGlobal(global);
    actions.toggleGroupCallPanel({ force: undefined, tabId });

    actions.afterHangUp();

    return undefined;
  }

  callApi('destroyPhoneCallState');
  stopPhoneCall();
  callApi('discardCall', { call: phoneCall, isPageUnload });

  if (phoneCall.state === 'requesting') {
    global = {
      ...global,
      phoneCall: undefined,
    };
    setGlobal(global);
    actions.toggleGroupCallPanel({ force: undefined, tabId });

    actions.afterHangUp();

    return undefined;
  }

  setTimeout(() => {
    global = getGlobal();
    global = {
      ...global,
      phoneCall: undefined,
    };
    setGlobal(global);

    actions.toggleGroupCallPanel({ force: undefined, tabId });
    actions.afterHangUp();
  }, HANG_UP_UI_DELAY);

  return undefined;
});
