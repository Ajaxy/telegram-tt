import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { selectActiveGroupCall, selectChatGroupCall, selectGroupCall } from '../../selectors/calls';
import { callApi } from '../../../api/gramjs';
import { selectChat } from '../../selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { ApiGroupCall } from '../../../api/types';
import { updateGroupCall } from '../../reducers/calls';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { addChats, addUsers } from '../../reducers';
import { fetchChatByUsername, loadFullChat } from '../api/chats';
import safePlay from '../../../util/safePlay';
import { ARE_CALLS_SUPPORTED } from '../../../util/environment';
import * as langProvider from '../../../util/langProvider';

// Workaround for Safari not playing audio without user interaction
let audioElement: HTMLAudioElement | undefined;
let audioContext: AudioContext | undefined;

const joinAudio = new Audio('./voicechat_join.mp3');
const connectingAudio = new Audio('./voicechat_connecting.mp3');
connectingAudio.loop = true;
const leaveAudio = new Audio('./voicechat_leave.mp3');
const allowTalkAudio = new Audio('./voicechat_onallowtalk.mp3');

const sounds: Record<string, HTMLAudioElement> = {
  join: joinAudio,
  allowTalk: allowTalkAudio,
  leave: leaveAudio,
  connecting: connectingAudio,
};

let initializationPromise: Promise<void> | undefined = Promise.resolve();

const initializeSoundsForSafari = () => {
  if (!initializationPromise) return Promise.resolve();

  initializationPromise = Promise.all(Object.values(sounds).map((l) => {
    l.muted = true;
    l.volume = 0.0001;
    return l.play().then(() => {
      l.pause();
      l.volume = 1;
      l.currentTime = 0;
      l.muted = false;
    });
  })).then(() => {
    initializationPromise = undefined;
  });

  return initializationPromise;
};

async function fetchGroupCall(groupCall: Partial<ApiGroupCall>) {
  const result = await callApi('getGroupCall', {
    call: groupCall,
  });

  if (!result) return undefined;

  let global = getGlobal();

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

async function fetchGroupCallParticipants(groupCall: Partial<ApiGroupCall>, nextOffset?: string) {
  const result = await callApi('fetchGroupCallParticipants', {
    call: groupCall as ApiGroupCall,
    offset: nextOffset,
  });

  if (!result) return;

  let global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));

  setGlobal(global);
}

addActionHandler('toggleGroupCallPanel', (global) => {
  return {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      isGroupCallPanelHidden: !global.groupCalls.isGroupCallPanelHidden,
    },
  };
});

addActionHandler('subscribeToGroupCallUpdates', async (global, actions, payload) => {
  const { subscribed, id } = payload!;
  const groupCall = selectGroupCall(global, id);

  if (!groupCall) return;

  if (subscribed) {
    await fetchGroupCall(groupCall);
    await fetchGroupCallParticipants(groupCall);
  }

  await callApi('toggleGroupCallStartSubscription', {
    subscribed,
    call: groupCall,
  });
});

addActionHandler('createGroupCall', async (global, actions, payload) => {
  const { chatId } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('createGroupCall', {
    peer: chat,
  });

  if (!result) return;

  global = getGlobal();
  setGlobal(updateGroupCall(global, result.id, {
    ...result,
    chatId,
  }));

  actions.joinGroupCall({ id: result.id, accessHash: result.accessHash });
});

addActionHandler('createGroupCallInviteLink', async (global, actions) => {
  const groupCall = selectActiveGroupCall(global);

  if (!groupCall || !groupCall.chatId) {
    return;
  }

  const chat = selectChat(global, groupCall.chatId);
  if (!chat) {
    return;
  }

  const canInvite = Boolean(chat.username);

  let { inviteLink } = chat.fullInfo!;
  if (canInvite) {
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
  });
});

addActionHandler('joinVoiceChatByLink', async (global, actions, payload) => {
  const { username, inviteHash } = payload!;

  const chat = await fetchChatByUsername(username);

  if (!chat) {
    actions.showNotification({ message: langProvider.getTranslation('NoUsernameFound') });
    return;
  }

  const full = await loadFullChat(chat);

  if (full?.groupCall) {
    actions.joinGroupCall({ id: full.groupCall.id, accessHash: full.groupCall.accessHash, inviteHash });
  }
});

addActionHandler('joinGroupCall', async (global, actions, payload) => {
  if (!ARE_CALLS_SUPPORTED) return undefined;

  const {
    chatId, id, accessHash, inviteHash,
  } = payload;

  createAudioElement();

  await initializeSoundsForSafari();
  const { groupCalls: { activeGroupCallId } } = global;
  let groupCall = id ? selectGroupCall(global, id) : selectChatGroupCall(global, chatId);

  if (groupCall?.id === activeGroupCallId) {
    actions.toggleGroupCallPanel();
    return undefined;
  }

  if (activeGroupCallId) {
    actions.leaveGroupCall({
      rejoin: payload,
    });
    return undefined;
  }

  if (groupCall && activeGroupCallId === groupCall.id) {
    actions.toggleGroupCallPanel();
    return undefined;
  }

  if (!groupCall && (!id || !accessHash)) {
    groupCall = await fetchGroupCall({
      id,
      accessHash,
    });
  }

  if (!groupCall) return undefined;

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
      isGroupCallPanelHidden: false,
    },
  };
  return global;
});

addActionHandler('playGroupCallSound', (global, actions, payload) => {
  const { sound } = payload!;

  if (!sounds[sound]) {
    return;
  }

  if (initializationPromise) {
    initializationPromise.then(() => {
      safePlay(sounds[sound]);
    });
  } else {
    if (sound !== 'connecting') {
      sounds.connecting.pause();
    }
    safePlay(sounds[sound]);
  }
});

addActionHandler('loadMoreGroupCallParticipants', (global) => {
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) {
    return;
  }

  void fetchGroupCallParticipants(groupCall, groupCall.nextOffset);
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

addActionHandler('openCallFallbackConfirm', (global) => {
  return {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      isFallbackConfirmOpen: true,
    },
  };
});

addActionHandler('closeCallFallbackConfirm', (global) => {
  return {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      isFallbackConfirmOpen: false,
    },
  };
});
