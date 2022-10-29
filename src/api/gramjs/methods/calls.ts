import BigInt from 'big-integer';
import type { JoinGroupCallPayload } from '../../../lib/secret-sauce';
import type {
  ApiChat, ApiUser, OnApiUpdate, ApiGroupCall, ApiPhoneCall,
} from '../../types';
import { Api as GramJs } from '../../../lib/gramjs';

import { invokeRequest } from './client';
import {
  buildInputGroupCall, buildInputPeer, buildInputPhoneCall, generateRandomInt,
} from '../gramjsBuilders';
import {
  buildCallProtocol,
  buildApiGroupCall,
  buildApiGroupCallParticipant, buildPhoneCall,

} from '../apiBuilders/calls';
import { buildApiUser } from '../apiBuilders/users';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { addEntitiesWithPhotosToLocalDb } from '../helpers';
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

  addEntitiesWithPhotosToLocalDb(result.users);
  addEntitiesWithPhotosToLocalDb(result.chats);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

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

  addEntitiesWithPhotosToLocalDb(result.users);
  addEntitiesWithPhotosToLocalDb(result.chats);

  const users = result.users.map(buildApiUser).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);

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
  }));

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
  }));

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

export async function getDhConfig() {
  const dhConfig = await invokeRequest(new GramJs.messages.GetDhConfig({}));

  if (!dhConfig || dhConfig instanceof GramJs.messages.DhConfigNotModified) return undefined;

  return {
    g: dhConfig.g,
    p: Array.from(dhConfig.p),
    random: Array.from(dhConfig.random),
  };
}

export function discardCall({
  call, isBusy,
}: {
  call: ApiPhoneCall; isBusy?: boolean;
}) {
  return invokeRequest(new GramJs.phone.DiscardCall({
    peer: buildInputPhoneCall(call),
    reason: isBusy ? new GramJs.PhoneCallDiscardReasonBusy() : new GramJs.PhoneCallDiscardReasonHangup(),
  }), true);
}

export async function requestCall({
  user, gAHash, isVideo,
}: {
  user: ApiUser; gAHash: number[]; isVideo?: boolean;
}) {
  const result = await invokeRequest(new GramJs.phone.RequestCall({
    randomId: generateRandomInt(),
    userId: buildInputPeer(user.id, user.accessHash),
    gAHash: Buffer.from(gAHash),
    ...(isVideo && { video: true }),
    protocol: buildCallProtocol(),
  }));

  if (!result) {
    return false;
  }

  const call = buildPhoneCall(result.phoneCall);

  onUpdate({
    '@type': 'updatePhoneCall',
    call,
  });

  return true;
}

export function setCallRating({
  call, rating, comment,
}: {
  call: ApiPhoneCall; rating: number; comment: string;
}) {
  return invokeRequest(new GramJs.phone.SetCallRating({
    rating,
    peer: buildInputPhoneCall(call),
    comment,
  }), true);
}

export function receivedCall({
  call,
}: {
  call: ApiPhoneCall;
}) {
  return invokeRequest(new GramJs.phone.ReceivedCall({
    peer: buildInputPhoneCall(call),
  }));
}

export async function acceptCall({
  call, gB,
}: {
  call: ApiPhoneCall; gB: number[];
}) {
  const result = await invokeRequest(new GramJs.phone.AcceptCall({
    peer: buildInputPhoneCall(call),
    gB: Buffer.from(gB),
    protocol: buildCallProtocol(),
  }));

  if (!result) {
    return;
  }

  call = buildPhoneCall(result.phoneCall);

  onUpdate({
    '@type': 'updatePhoneCall',
    call,
  });
}

export async function confirmCall({
  call, gA, keyFingerprint,
}: {
  call: ApiPhoneCall; gA: number[]; keyFingerprint: string;
}) {
  const result = await invokeRequest(new GramJs.phone.ConfirmCall({
    peer: buildInputPhoneCall(call),
    gA: Buffer.from(gA),
    keyFingerprint: BigInt(keyFingerprint),
    protocol: buildCallProtocol(),
  }));

  if (!result) {
    return;
  }

  call = buildPhoneCall(result.phoneCall);

  onUpdate({
    '@type': 'updatePhoneCall',
    call,
  });
}

export function sendSignalingData({
  data, call,
}: {
  data: number[]; call: ApiPhoneCall;
}) {
  return invokeRequest(new GramJs.phone.SendSignalingData({
    data: Buffer.from(data),
    peer: buildInputPhoneCall(call),
  }));
}
