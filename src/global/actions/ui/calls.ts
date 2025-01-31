import type { ApiGroupCall } from '../../../api/types';
import type { CallSound } from '../../../types';
import type { RequiredGlobalActions } from '../../index';
import type {
  ActionReturnType, GlobalState, TabArgs,
} from '../../types';

import { requestNextMutation } from '../../../lib/fasterdom/fasterdom';
import { copyTextToClipboard } from '../../../util/clipboard';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { omit } from '../../../util/iteratees';
import * as langProvider from '../../../util/oldLangProvider';
import safePlay from '../../../util/safePlay';
import { ARE_CALLS_SUPPORTED } from '../../../util/windowEnvironment';
import { callApi } from '../../../api/gramjs';
import { getMainUsername } from '../../helpers';
import {
  addActionHandler, getGlobal,
  setGlobal,
} from '../../index';
import { updateGroupCall } from '../../reducers/calls';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat, selectChatFullInfo, selectTabState, selectUser,
} from '../../selectors';
import { selectActiveGroupCall, selectChatGroupCall, selectGroupCall } from '../../selectors/calls';
import { fetchChatByUsername, loadFullChat } from '../api/chats';

// This is a tiny MP3 file that is silent - retrieved from https://bigsoundbank.com and then modified
// eslint-disable-next-line max-len
const silentSound = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

let audioElement: HTMLAudioElement | undefined;
let audioContext: AudioContext | undefined;
let sounds: Record<CallSound, HTMLAudioElement>;

// Workaround: this function is called once on the first user interaction.
// After that, it will be possible to play the notification on iOS without problems.
// https://rosswintle.uk/2019/01/skirting-the-ios-safari-audio-auto-play-policy-for-ui-sound-effects/
export function initializeSoundsForSafari() {
  initializeSounds();

  return Promise.all(Object.values(sounds).map((sound) => {
    const prevSrc = sound.src;
    sound.src = silentSound;
    sound.muted = true;
    sound.volume = 0.0001;
    return sound.play()
      .then(() => {
        sound.pause();
        sound.volume = 1;
        sound.currentTime = 0;
        sound.muted = false;

        requestNextMutation(() => {
          sound.src = prevSrc;
        });
      });
  }));
}

export function initializeSounds() {
  if (sounds) {
    return;
  }
  const joinAudio = new Audio('./voicechat_join.mp3');
  const connectingAudio = new Audio('./voicechat_connecting.mp3');
  connectingAudio.loop = true;
  const leaveAudio = new Audio('./voicechat_leave.mp3');
  const allowTalkAudio = new Audio('./voicechat_onallowtalk.mp3');
  const busyAudio = new Audio('./call_busy.mp3');
  const connectAudio = new Audio('./call_connect.mp3');
  const endAudio = new Audio('./call_end.mp3');
  const incomingAudio = new Audio('./call_incoming.mp3');
  incomingAudio.loop = true;
  const ringingAudio = new Audio('./call_ringing.mp3');
  ringingAudio.loop = true;

  sounds = {
    join: joinAudio,
    allowTalk: allowTalkAudio,
    leave: leaveAudio,
    connecting: connectingAudio,
    incoming: incomingAudio,
    end: endAudio,
    connect: connectAudio,
    busy: busyAudio,
    ringing: ringingAudio,
  };
}

async function fetchGroupCall<T extends GlobalState>(global: T, groupCall: Partial<ApiGroupCall>) {
  const result = await callApi('getGroupCall', {
    call: groupCall,
  });

  if (!result) return undefined;

  global = getGlobal();

  const existingGroupCall = selectGroupCall(global, groupCall.id!);

  global = updateGroupCall(
    global,
    groupCall.id!,
    omit(result.groupCall, ['connectionState']),
    undefined,
    existingGroupCall?.isLoaded ? undefined : result.groupCall.participantsCount,
  );

  setGlobal(global);

  return result.groupCall;
}

function requestGroupCallParticipants(
  groupCall: Partial<ApiGroupCall>, nextOffset?: string,
) {
  return callApi('fetchGroupCallParticipants', {
    call: groupCall as ApiGroupCall,
    offset: nextOffset,
  });
}

addActionHandler('toggleGroupCallPanel', (global, actions, payload): ActionReturnType => {
  const { force, tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    isCallPanelVisible: 'force' in (payload || {}) ? force : !selectTabState(global, tabId).isCallPanelVisible,
  }, tabId);
});

addActionHandler('subscribeToGroupCallUpdates', async (global, actions, payload): Promise<void> => {
  const { subscribed, id } = payload!;
  const groupCall = selectGroupCall(global, id);

  if (!groupCall) return;

  if (subscribed) {
    await fetchGroupCall(global, groupCall);
    global = getGlobal();
    await requestGroupCallParticipants(groupCall);
  }

  await callApi('toggleGroupCallStartSubscription', {
    subscribed,
    call: groupCall,
  });
});

addActionHandler('createGroupCall', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('createGroupCall', {
    peer: chat,
  });

  if (!result) return;

  global = getGlobal();
  global = updateGroupCall(global, result.id, {
    ...result,
    chatId,
  });
  setGlobal(global);

  actions.requestMasterAndJoinGroupCall({ id: result.id, accessHash: result.accessHash, tabId });
});

addActionHandler('createGroupCallInviteLink', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const groupCall = selectActiveGroupCall(global);

  if (!groupCall || !groupCall.chatId) {
    return;
  }

  const chat = selectChat(global, groupCall.chatId);
  if (!chat) {
    return;
  }

  const hasPublicUsername = Boolean(getMainUsername(chat));

  let inviteLink = selectChatFullInfo(global, chat.id)?.inviteLink;
  if (hasPublicUsername) {
    inviteLink = await callApi('exportGroupCallInvite', {
      call: groupCall,
      canSelfUnmute: false,
    });
  }

  if (!inviteLink) {
    return;
  }

  copyTextToClipboard(inviteLink);
  actions.showNotification({
    message: {
      key: 'LinkCopied',
    },
    tabId,
  });
});

addActionHandler('joinVoiceChatByLink', async (global, actions, payload): Promise<void> => {
  const { username, inviteHash, tabId = getCurrentTabId() } = payload;

  const chat = await fetchChatByUsername(global, username);

  if (!chat) {
    actions.showNotification({ message: langProvider.oldTranslate('NoUsernameFound'), tabId });
    return;
  }

  global = getGlobal();
  const full = await loadFullChat(global, actions, chat);

  if (full?.groupCall) {
    actions.requestMasterAndJoinGroupCall({
      id: full.groupCall.id,
      accessHash: full.groupCall.accessHash,
      inviteHash,
      tabId,
    });
  }
});

addActionHandler('requestMasterAndJoinGroupCall', (global, actions, payload): ActionReturnType => {
  actions.requestMasterAndCallAction({
    action: 'joinGroupCall',
    payload,
    tabId: payload.tabId || getCurrentTabId(),
  });
});

addActionHandler('requestMasterAndAcceptCall', (global, actions, payload): ActionReturnType => {
  actions.requestMasterAndCallAction({
    action: 'acceptCall',
    payload: undefined,
    tabId: payload?.tabId || getCurrentTabId(),
  });
});

addActionHandler('joinGroupCall', async (global, actions, payload): Promise<void> => {
  const {
    chatId, id, accessHash, inviteHash, tabId = getCurrentTabId(),
  } = payload;

  if (!ARE_CALLS_SUPPORTED) {
    actions.showNotification({
      message: "Sorry, your browser doesn't support group calls",
      tabId,
    });
    return;
  }

  if (global.phoneCall) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  createAudioElement();

  initializeSounds();
  global = getGlobal();
  void checkNavigatorUserMediaPermissions(global, actions, true, tabId);

  const { groupCalls: { activeGroupCallId } } = global;
  let groupCall = id ? selectGroupCall(global, id) : selectChatGroupCall(global, chatId!);

  if (groupCall && groupCall.id === activeGroupCallId) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  if (activeGroupCallId) {
    if ('leaveGroupCall' in actions) {
      actions.leaveGroupCall({
        rejoin: payload,
        tabId,
      });
    }
    return;
  }

  if (groupCall && activeGroupCallId === groupCall.id) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  if (!groupCall && (!id || !accessHash) && chatId) {
    const chat = selectChat(global, chatId);

    if (!chat) return;

    await loadFullChat(global, actions, chat);
    global = getGlobal();
    groupCall = selectChatGroupCall(global, chatId);
  } else if (!groupCall && id && accessHash) {
    groupCall = await fetchGroupCall(global, {
      id,
      accessHash,
    });
  }

  if (!groupCall) return;

  global = getGlobal();
  global = updateGroupCall(
    global,
    groupCall.id,
    {
      ...groupCall,
      inviteHash,
    },
    undefined,
    groupCall.participantsCount + 1,
  );
  global = {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      activeGroupCallId: groupCall.id,
    },
  };

  setGlobal(global);

  actions.toggleGroupCallPanel({ force: false, tabId });
});

addActionHandler('playGroupCallSound', (global, actions, payload): ActionReturnType => {
  const { sound } = payload!;

  if (!sounds[sound]) {
    return;
  }

  const doPlay = () => {
    if (sound !== 'connecting') {
      sounds.connecting.pause();
    }
    if (sound !== 'incoming') {
      sounds.incoming.pause();
    }
    if (sound !== 'ringing') {
      sounds.ringing.pause();
    }
    safePlay(sounds[sound]);
  };

  doPlay();
});

addActionHandler('loadMoreGroupCallParticipants', (global): ActionReturnType => {
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) {
    return;
  }

  void requestGroupCallParticipants(groupCall, groupCall.nextOffset);
});

addActionHandler('requestMasterAndRequestCall', (global, actions, payload): ActionReturnType => {
  actions.requestMasterAndCallAction({
    action: 'requestCall',
    payload,
    tabId: payload.tabId || getCurrentTabId(),
  });
});

addActionHandler('requestCall', (global, actions, payload): ActionReturnType => {
  const { userId, isVideo, tabId = getCurrentTabId() } = payload;

  if (global.phoneCall) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  initializeSounds();
  global = getGlobal();
  void checkNavigatorUserMediaPermissions(global, actions, isVideo, tabId);

  global = getGlobal();
  global = {
    ...global,
    phoneCall: {
      id: '',
      state: 'requesting',
      participantId: userId,
      isVideo,
      adminId: global.currentUserId,
    },
  };
  setGlobal(global);

  actions.toggleGroupCallPanel({ force: false, tabId });
});

function createAudioContext() {
  return (new (window.AudioContext || (window as any).webkitAudioContext)());
}

const silence = (ctx: AudioContext) => {
  const oscillator = ctx.createOscillator();
  const dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return new MediaStream([Object.assign((dst as any).stream.getAudioTracks()[0], { enabled: false })]);
};

function createAudioElement() {
  const ctx = createAudioContext();
  audioElement = new Audio();
  audioContext = ctx;
  audioElement.srcObject = silence(ctx);
  safePlay(audioElement);
}

export function getGroupCallAudioElement() {
  return audioElement;
}

export function getGroupCallAudioContext() {
  return audioContext;
}

export function removeGroupCallAudioElement() {
  audioElement?.pause();
  audioContext = undefined;
  audioElement = undefined;
}

// This method is used instead of a navigator.permissions.query to determine permission to use a microphone,
// because Firefox does not have support for 'microphone' and 'camera' permissions
// https://github.com/mozilla/standards-positions/issues/19#issuecomment-370158947
export function checkNavigatorUserMediaPermissions<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions, isVideo?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (isVideo) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (stream.getVideoTracks().length === 0) {
          actions.showNotification({
            message: langProvider.oldTranslate('Call.Camera.Error'),
            tabId,
          });
        } else {
          stream.getTracks().forEach((track) => track.stop());
          checkMicrophonePermission(global, actions, tabId);
        }
      })
      .catch(() => {
        actions.showNotification({
          message: langProvider.oldTranslate('Call.Camera.Error'),
          tabId,
        });
      });
  } else {
    checkMicrophonePermission(global, actions, tabId);
  }
}

function checkMicrophonePermission<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      if (stream.getAudioTracks().length === 0) {
        actions.showNotification({
          message: langProvider.oldTranslate('RequestAcces.Error.HaveNotAccess.Call'),
          tabId,
        });
      } else {
        stream.getTracks().forEach((track) => track.stop());
      }
    })
    .catch(() => {
      actions.showNotification({
        message: langProvider.oldTranslate('RequestAcces.Error.HaveNotAccess.Call'),
        tabId,
      });
    });
}
