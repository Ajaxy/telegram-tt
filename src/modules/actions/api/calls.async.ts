import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';
import {
  joinGroupCall,
  startSharingScreen,
  leaveGroupCall,
  toggleStream,
  isStreamEnabled,
  setVolume,
  handleUpdateGroupCallParticipants, handleUpdateGroupCallConnection,
} from '../../../lib/secret-sauce';

import { ApiUpdate } from '../../../api/types';

import { GROUP_CALL_VOLUME_MULTIPLIER } from '../../../config';
import { callApi } from '../../../api/gramjs';
import { selectChat, selectCurrentMessageList, selectUser } from '../../selectors';
import {
  selectActiveGroupCall,
  selectCallFallbackChannelTitle,
  selectGroupCallParticipant,
} from '../../selectors/calls';
import {
  removeGroupCall,
  updateActiveGroupCall,
  updateGroupCall,
  updateGroupCallParticipant,
} from '../../reducers/calls';
import { omit } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { fetchFile } from '../../../util/files';
import { getGroupCallAudioContext, getGroupCallAudioElement, removeGroupCallAudioElement } from '../ui/calls';
import { loadFullChat } from './chats';

import callFallbackAvatarPath from '../../../assets/call-fallback-avatar.png';

const FALLBACK_INVITE_EXPIRE_SECONDS = 1800; // 30 min

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
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
  }

  return undefined;
});

addReducer('leaveGroupCall', (global, actions, payload) => {
  const {
    isFromLibrary, shouldDiscard, shouldRemove, rejoin,
  } = payload || {};
  const groupCall = selectActiveGroupCall(global);
  if (!groupCall) {
    return;
  }

  setGlobal(updateActiveGroupCall(global, { connectionState: 'disconnected' }, groupCall.participantsCount - 1));

  (async () => {
    await callApi('leaveGroupCall', {
      call: groupCall,
    });

    let shouldResetFallbackState = false;
    if (shouldDiscard) {
      global = getGlobal();

      if (global.groupCalls.fallbackChatId === groupCall.chatId) {
        shouldResetFallbackState = true;

        global.groupCalls.fallbackUserIdsToRemove?.forEach((userId) => {
          actions.deleteChatMember({ chatId: global.groupCalls.fallbackChatId, userId });
        });
      }

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
        isGroupCallPanelHidden: true,
        activeGroupCallId: undefined,
        ...(shouldResetFallbackState && {
          fallbackChatId: undefined,
          fallbackUserIdsToRemove: undefined,
        }),
      },
    });

    if (!isFromLibrary) {
      leaveGroupCall();
    }

    if (rejoin) {
      actions.joinGroupCall(rejoin);
    }
  })();
});

addReducer('toggleGroupCallVideo', (global) => {
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  (async () => {
    await toggleStream('video');

    await callApi('editGroupCallParticipant', {
      call: groupCall,
      videoStopped: !isStreamEnabled('video'),
      participant: user,
    });
  })();
});

addReducer('requestToSpeak', (global, actions, payload) => {
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

addReducer('setGroupCallParticipantVolume', (global, actions, payload) => {
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

addReducer('toggleGroupCallMute', (global, actions, payload) => {
  const { participantId, value } = payload || {};
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, participantId || global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  (async () => {
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
  })();
});

addReducer('toggleGroupCallPresentation', (global, actions, payload) => {
  const groupCall = selectActiveGroupCall(global);
  const user = selectUser(global, global.currentUserId!);
  if (!user || !groupCall) {
    return;
  }

  (async () => {
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
  })();
});

addReducer('connectToActiveGroupCall', (global, actions) => {
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

  (async () => {
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
  })();
});

addReducer('inviteToCallFallback', (global, actions, payload) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  if (!chatId) {
    return;
  }

  const user = selectUser(global, chatId);
  if (!user) {
    return;
  }

  const { shouldRemove } = payload;

  (async () => {
    const fallbackChannelTitle = selectCallFallbackChannelTitle(global);

    let fallbackChannel = Object.values(global.chats.byId).find((channel) => {
      return (
        channel.title === fallbackChannelTitle
        && channel.isCreator
        && !channel.isRestricted
      );
    });
    if (!fallbackChannel) {
      fallbackChannel = await callApi('createChannel', {
        title: fallbackChannelTitle,
        users: [user],
      });

      if (!fallbackChannel) {
        return;
      }

      const photo = await fetchFile(callFallbackAvatarPath, 'avatar.png');
      void callApi('editChatPhoto', {
        chatId: fallbackChannel.id,
        accessHash: fallbackChannel.accessHash,
        photo,
      });
    } else {
      actions.updateChatMemberBannedRights({
        chatId: fallbackChannel.id,
        userId: chatId,
        bannedRights: {},
      });

      void callApi('addChatMembers', fallbackChannel, [user], true);
    }

    const inviteLink = await callApi('updatePrivateLink', {
      chat: fallbackChannel,
      usageLimit: 1,
      expireDate: getServerTime(global.serverTimeOffset) + FALLBACK_INVITE_EXPIRE_SECONDS,
    });
    if (!inviteLink) {
      return;
    }

    if (shouldRemove) {
      global = getGlobal();
      const fallbackUserIdsToRemove = global.groupCalls.fallbackUserIdsToRemove || [];
      setGlobal({
        ...global,
        groupCalls: {
          ...global.groupCalls,
          fallbackChatId: fallbackChannel.id,
          fallbackUserIdsToRemove: [...fallbackUserIdsToRemove, chatId],
        },
      });
    }

    actions.sendMessage({ text: `Join a call: ${inviteLink}` });
    actions.openChat({ id: fallbackChannel.id });
    actions.createGroupCall({ chatId: fallbackChannel.id });
    actions.closeCallFallbackConfirm();
  })();
});
