import { JoinGroupCallPayload } from '../../../lib/secret-sauce';
import {
  ApiChat, ApiUser, OnApiUpdate, ApiGroupCall,
} from '../../types';
import { Api as GramJs } from '../../../lib/gramjs';

import { invokeRequest } from './client';
import { buildInputGroupCall, buildInputPeer, generateRandomInt } from '../gramjsBuilders';
import {
  buildApiGroupCall,
  buildApiGroupCallParticipant,

} from '../apiBuilders/calls';
import { buildApiUser } from '../apiBuilders/users';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { addChatToLocalDb, addUserToLocalDb } from '../helpers';
import { GROUP_CALL_PARTICIPANTS_LIMIT } from '../../../config';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function getGroupCall({
  call,
}: {
  call: Partial<ApiGroupCall>;
}) {
  const result = await invokeRequest(new GramJs.phone.GetGroupCall({
    call: buildInputGroupCall(call),
  }));

  if (!result) {
    return undefined;
  }

  result.users.map(addUserToLocalDb);
  result.chats.map(addChatToLocalDb);

  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter<ApiChat>(Boolean as any);

  return {
    groupCall: buildApiGroupCall(result.call),
    users,
    chats,
  };
}

export function discardGroupCall({
  call,
}: {
  call: ApiGroupCall;
}) {
  return invokeRequest(new GramJs.phone.DiscardGroupCall({
    call: buildInputGroupCall(call),
  }), true);
}

export function editGroupCallParticipant({
  call, participant, muted, presentationPaused, videoStopped, videoPaused, volume,
  raiseHand,
}: {
  call: ApiGroupCall; participant: ApiUser; muted?: boolean; presentationPaused?: boolean;
  videoStopped?: boolean; videoPaused?: boolean; raiseHand?: boolean; volume?: number;
}) {
  return invokeRequest(new GramJs.phone.EditGroupCallParticipant({
    call: buildInputGroupCall(call),
    participant: buildInputPeer(participant.id, participant.accessHash),
    ...(videoStopped !== undefined && { videoStopped }),
    ...(videoPaused !== undefined && { videoPaused }),
    ...(muted !== undefined && { muted }),
    ...(presentationPaused !== undefined && { presentationPaused }),
    ...(raiseHand !== undefined && { raiseHand }),
    ...(volume !== undefined && { volume }),
  }), true);
}

export function editGroupCallTitle({
  groupCall, title,
}: {
  groupCall: ApiGroupCall; title: string;
}) {
  return invokeRequest(new GramJs.phone.EditGroupCallTitle({
    title,
    call: buildInputGroupCall(groupCall),
  }), true);
}

export async function exportGroupCallInvite({
  call, canSelfUnmute,
}: {
  call: ApiGroupCall; canSelfUnmute: boolean;
}) {
  const result = await invokeRequest(new GramJs.phone.ExportGroupCallInvite({
    canSelfUnmute: canSelfUnmute || undefined,
    call: buildInputGroupCall(call),
  }));

  if (!result) {
    return undefined;
  }

  return result.link;
}

export async function fetchGroupCallParticipants({
  call, offset,
}: {
  call: ApiGroupCall; offset?: string;
}) {
  const result = await invokeRequest(new GramJs.phone.GetGroupParticipants({
    call: buildInputGroupCall(call),
    ids: [],
    sources: [],
    offset: offset || '',
    limit: GROUP_CALL_PARTICIPANTS_LIMIT,
  }));

  if (!result) {
    return undefined;
  }

  result.users.map(addUserToLocalDb);
  result.chats.map(addChatToLocalDb);

  const users = result.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter<ApiChat>(Boolean as any);

  onUpdate({
    '@type': 'updateGroupCallParticipants',
    groupCallId: call.id,
    participants: result.participants.map(buildApiGroupCallParticipant),
    nextOffset: result.nextOffset,
  });

  return {
    users, chats,
  };
}

export function leaveGroupCall({
  call,
}: {
  call: ApiGroupCall;
}) {
  return invokeRequest(new GramJs.phone.LeaveGroupCall({
    call: buildInputGroupCall(call),
  }), true);
}

export async function joinGroupCall({
  call, inviteHash, params,
}: {
  call: ApiGroupCall; inviteHash?: string; params: JoinGroupCallPayload;
}) {
  const result = await invokeRequest(new GramJs.phone.JoinGroupCall({
    call: buildInputGroupCall(call),
    joinAs: new GramJs.InputPeerSelf(),
    muted: true,
    videoStopped: true,
    params: new GramJs.DataJSON({
      data: JSON.stringify(params),
    }),
    inviteHash,
  }), true);

  if (!result) return undefined;

  if (result instanceof GramJs.Updates) {
    const update = result.updates.find((u) => u instanceof GramJs.UpdateGroupCall);
    if (!(update instanceof GramJs.UpdateGroupCall)) return undefined;

    return buildApiGroupCall(update.call);
  }

  return undefined;
}

export async function createGroupCall({
  peer,
}: {
  peer: ApiChat;
}) {
  const randomId = generateRandomInt();
  const result = await invokeRequest(new GramJs.phone.CreateGroupCall({
    peer: buildInputPeer(peer.id, peer.accessHash),
    randomId,
  }), true);

  if (!result) return undefined;

  if (result instanceof GramJs.Updates) {
    const update = result.updates[0];
    if (update instanceof GramJs.UpdateGroupCall) {
      return buildApiGroupCall(update.call);
    }
  }

  return undefined;
}

export function joinGroupCallPresentation({
  call, params,
}: {
  call: ApiGroupCall; params: JoinGroupCallPayload;
}) {
  return invokeRequest(new GramJs.phone.JoinGroupCallPresentation({
    call: buildInputGroupCall(call),
    params: new GramJs.DataJSON({
      data: JSON.stringify(params),
    }),
  }), true);
}

export function toggleGroupCallStartSubscription({
  call, subscribed,
}: {
  call: ApiGroupCall; subscribed: boolean;
}) {
  return invokeRequest(new GramJs.phone.ToggleGroupCallStartSubscription({
    call: buildInputGroupCall(call),
    subscribed,
  }), true);
}

export function leaveGroupCallPresentation({
  call,
}: {
  call: ApiGroupCall;
}) {
  return invokeRequest(new GramJs.phone.LeaveGroupCallPresentation({
    call: buildInputGroupCall(call),
  }), true);
}
