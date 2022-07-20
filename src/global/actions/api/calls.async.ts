import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  joinGroupCall,
  startSharingScreen,
  leaveGroupCall,
  toggleStream,
  isStreamEnabled,
  setVolume, stopPhoneCall,
} from '../../../lib/secret-sauce';

import { GROUP_CALL_VOLUME_MULTIPLIER } from '../../../config';
import { callApi } from '../../../api/gramjs';
import { selectChat, selectUser } from '../../selectors';
import {
  selectActiveGroupCall, selectPhoneCallUser,
} from '../../selectors/calls';
import {
  removeGroupCall,
  updateActiveGroupCall,
} from '../../reducers/calls';
import { getGroupCallAudioContext, getGroupCallAudioElement, removeGroupCallAudioElement } from '../ui/calls';
import { loadFullChat } from './chats';

addActionHandler('leaveGroupCall', async (global, actions, payload) => {
  const {
    isFromLibrary, shouldDiscard, shouldRemove, rejoin,
  } = payload || {};
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) {
    return;
  }

  setGlobal(updateActiveGroupCall(global, { connectionState: 'disconnected' }, groupCall.participantsCount - 1));

  await callApi('leaveGroupCall', {
    call: groupCall,
  });

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

  setGlobal({
    ...global,
    groupCalls: {
      ...global.groupCalls,
      activeGroupCallId: undefined,
    },
    isCallPanelVisible: undefined,
  });

  if (!isFromLibrary) {
    leaveGroupCall();
  }

  if (rejoin) {
    actions.joinGroupCall(rejoin);
  }
});

addActionHandler('toggleGroupCallVideo', async (global) => {
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

addActionHandler('requestToSpeak', (global, actions, payload) => {
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

addActionHandler('setGroupCallParticipantVolume', (global, actions, payload) => {
  const { participantId, volume } = payload!;

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

addActionHandler('toggleGroupCallMute', async (global, actions, payload) => {
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

addActionHandler('toggleGroupCallPresentation', async (global, actions, payload) => {
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

addActionHandler('connectToActiveGroupCall', async (global, actions) => {
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) return;

  if (groupCall.connectionState === 'discarded') {
    actions.showNotification({ message: 'This voice chat is not active' });
    return;
  }

  const audioElement = getGroupCallAudioElement();
  const audioContext = getGroupCallAudioContext();

  if (!audioElement || !audioContext) {
    return;
  }

  const {
    currentUserId,
  } = global;

  if (!currentUserId) return;

  const params = await joinGroupCall(currentUserId, audioContext, audioElement, actions.apiUpdate);

  const result = await callApi('joinGroupCall', {
    call: groupCall,
    params,
    inviteHash: groupCall.inviteHash,
  });

  if (!result) return;

  actions.loadMoreGroupCallParticipants();

  if (groupCall.chatId) {
    const chat = selectChat(getGlobal(), groupCall.chatId);
    if (!chat) return;
    await loadFullChat(chat);
  }
});

addActionHandler('connectToActivePhoneCall', async (global, actions) => {
  const { phoneCall } = global;

  if (!phoneCall) return;

  const user = selectPhoneCallUser(global);

  if (!user) return;

  const dhConfig = await callApi('getDhConfig');

  if (!dhConfig) return;

  await callApi('createPhoneCallState', [true]);

  const gAHash = await callApi('requestPhoneCall', [dhConfig])!;

  const result = await callApi('requestCall', { user, gAHash, isVideo: phoneCall.isVideo });

  if (!result) {
    actions.hangUp();
  }
});

addActionHandler('acceptCall', async (global) => {
  const { phoneCall } = global;

  if (!phoneCall) return;

  const dhConfig = await callApi('getDhConfig');
  if (!dhConfig) return;

  await callApi('createPhoneCallState', [false]);

  const gB = await callApi('acceptPhoneCall', [dhConfig])!;
  callApi('acceptCall', { call: phoneCall, gB });
});

addActionHandler('sendSignalingData', (global, actions, payload) => {
  const { phoneCall } = global;
  if (!phoneCall) {
    return;
  }

  const data = JSON.stringify(payload);

  (async () => {
    const encodedData = await callApi('encodePhoneCallData', [data]);

    if (!encodedData) return;

    callApi('sendSignalingData', { data: encodedData, call: phoneCall });
  })();
});

addActionHandler('closeCallRatingModal', (global) => {
  return {
    ...global,
    ratingPhoneCall: undefined,
  };
});

addActionHandler('setCallRating', (global, actions, payload) => {
  const { ratingPhoneCall } = global;
  if (!ratingPhoneCall) {
    return undefined;
  }

  const { rating, comment } = payload;

  callApi('setCallRating', { call: ratingPhoneCall, rating, comment });

  return {
    ...global,
    ratingPhoneCall: undefined,
  };
});

addActionHandler('hangUp', (global) => {
  const { phoneCall } = global;

  if (!phoneCall) return undefined;

  if (phoneCall.state === 'discarded') {
    callApi('destroyPhoneCallState');
    stopPhoneCall();
    return {
      ...global,
      phoneCall: undefined,
      isCallPanelVisible: undefined,
    };
  }

  callApi('destroyPhoneCallState');
  stopPhoneCall();
  callApi('discardCall', { call: phoneCall });

  if (phoneCall.state === 'requesting') {
    return {
      ...global,
      phoneCall: undefined,
      isCallPanelVisible: undefined,
    };
  }

  setTimeout(() => {
    setGlobal({
      ...getGlobal(),
      phoneCall: undefined,
      isCallPanelVisible: undefined,
    });
  }, 500);

  return undefined;
});
