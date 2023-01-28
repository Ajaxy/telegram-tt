import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler, getGlobal,
  setGlobal,
} from '../../index';
import { callApi } from '../../../api/gramjs';
import {
  selectChat, selectTabState, selectUser,
} from '../../selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { fetchChatByUsername, loadFullChat } from '../api/chats';

import type { ApiGroupCall } from '../../../api/types';
import type {
  CallSound, ActionReturnType, GlobalState, TabArgs,
} from '../../types';

import { addChats, addUsers } from '../../reducers';
import { updateGroupCall } from '../../reducers/calls';
import { selectActiveGroupCall, selectChatGroupCall, selectGroupCall } from '../../selectors/calls';
import { getMainUsername } from '../../helpers';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import safePlay from '../../../util/safePlay';
import { ARE_CALLS_SUPPORTED } from '../../../util/environment';
import * as langProvider from '../../../util/langProvider';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

// Workaround for Safari not playing audio without user interaction
let audioElement: HTMLAudioElement | undefined;
let audioContext: AudioContext | undefined;

let sounds: Record<CallSound, HTMLAudioElement>;
let initializationPromise: Promise<void> | undefined = Promise.resolve();

export const initializeSoundsForSafari = () => {
  if (!initializationPromise) return Promise.resolve();

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

  initializationPromise = Promise.all(Object.values(sounds).map((sound) => {
    sound.muted = true;
    sound.volume = 0.0001;
    return sound.play().then(() => {
      sound.pause();
      sound.volume = 1;
      sound.currentTime = 0;
      sound.muted = false;
    });
  })).then(() => {
    initializationPromise = undefined;
  });

  return initializationPromise;
};

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
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));

  setGlobal(global);

  return result.groupCall;
}

async function fetchGroupCallParticipants<T extends GlobalState>(
  global: T,
  groupCall: Partial<ApiGroupCall>, nextOffset?: string,
) {
  const result = await callApi('fetchGroupCallParticipants', {
    call: groupCall as ApiGroupCall,
    offset: nextOffset,
  });

  if (!result) return;

  global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));

  setGlobal(global);
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
    await fetchGroupCallParticipants(global, groupCall);
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

  let { inviteLink } = chat.fullInfo!;
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
    message: 'Link copied to clipboard',
    tabId,
  });
});

addActionHandler('joinVoiceChatByLink', async (global, actions, payload): Promise<void> => {
  const { username, inviteHash, tabId = getCurrentTabId() } = payload!;

  const chat = await fetchChatByUsername(global, username);

  if (!chat) {
    actions.showNotification({ message: langProvider.translate('NoUsernameFound'), tabId });
    return;
  }

  global = getGlobal();
  const full = await loadFullChat(global, actions, chat, tabId);

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

  if (!ARE_CALLS_SUPPORTED) return;

  if (global.phoneCall) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  createAudioElement();

  await initializeSoundsForSafari();
  global = getGlobal();
  void checkNavigatorUserMediaPermissions(global, actions, true, tabId);

  const { groupCalls: { activeGroupCallId } } = global;
  let groupCall = id ? selectGroupCall(global, id) : selectChatGroupCall(global, chatId!);

  if (groupCall?.id === activeGroupCallId) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  if (activeGroupCallId) {
    actions.leaveGroupCall({
      rejoin: payload,
      tabId,
    });
    return;
  }

  if (groupCall && activeGroupCallId === groupCall.id) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  if (!groupCall && (!id || !accessHash)) {
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

  if (initializationPromise) {
    initializationPromise.then(doPlay);
  } else {
    doPlay();
  }
});

addActionHandler('loadMoreGroupCallParticipants', (global): ActionReturnType => {
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) {
    return;
  }

  void fetchGroupCallParticipants(global, groupCall, groupCall.nextOffset);
});

addActionHandler('requestMasterAndRequestCall', (global, actions, payload): ActionReturnType => {
  actions.requestMasterAndCallAction({
    action: 'requestCall',
    payload,
    tabId: payload.tabId || getCurrentTabId(),
  });
});

addActionHandler('requestCall', async (global, actions, payload): Promise<void> => {
  const { userId, isVideo, tabId = getCurrentTabId() } = payload;

  if (global.phoneCall) {
    actions.toggleGroupCallPanel({ tabId });
    return;
  }

  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  await initializeSoundsForSafari();
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
            message: langProvider.translate('Call.Camera.Error'),
            tabId,
          });
        } else {
          checkMicrophonePermission(global, actions, tabId);
        }
      })
      .catch(() => {
        actions.showNotification({
          message: langProvider.translate('Call.Camera.Error'),
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
          message: langProvider.translate('RequestAcces.Error.HaveNotAccess.Call'),
          tabId,
        });
      }
    })
    .catch(() => {
      actions.showNotification({
        message: langProvider.translate('RequestAcces.Error.HaveNotAccess.Call'),
        tabId,
      });
    });
}
