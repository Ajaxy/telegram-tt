import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiCallProtocol,
  ApiPhoneCallConnection,
  GroupCallParticipant,
  GroupCallParticipantVideo,
  SsrcGroup,
} from '../../../lib/vibecalls';
import type { ApiGroupCall, ApiPhoneCall } from '../../types';

import { CALL_PROTOCOL_LIBRARY_VERSIONS } from '../../../config';
import { sanitizePrimitiveRecord } from '../../../util/primitives/primitiveRecord';
import { getApiChatIdFromMtpPeer, isMtpPeerUser } from './peers';

function parseCallParameters(data?: GramJs.TypeDataJSON) {
  if (!data?.data) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(data.data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    return sanitizePrimitiveRecord(parsed as Record<string, unknown>);
  } catch {
    return undefined;
  }
}

export function buildApiGroupCallParticipant(participant: GramJs.GroupCallParticipant): GroupCallParticipant {
  const {
    self, min, about, date, versioned, canSelfUnmute, justJoined, left, muted, mutedByYou, source, volume,
    volumeByAdmin, videoJoined, peer, video, presentation, raiseHandRating,
  } = participant;

  return {
    isSelf: self,
    isMin: min,
    canSelfUnmute,
    isLeft: left,
    isMuted: muted,
    isMutedByMe: mutedByYou,
    hasJustJoined: justJoined,
    isVolumeByAdmin: volumeByAdmin,
    isVersioned: versioned,
    isVideoJoined: videoJoined,
    about,
    source,
    raiseHandRating: raiseHandRating?.toString(),
    volume,
    date: new Date(date),
    isUser: isMtpPeerUser(peer),
    id: getApiChatIdFromMtpPeer(peer),
    video: video ? buildApiGroupCallParticipantVideo(video) : undefined,
    presentation: presentation ? buildApiGroupCallParticipantVideo(presentation) : undefined,
  };
}

function buildApiGroupCallParticipantVideo(
  participantVideo: GramJs.GroupCallParticipantVideo,
): GroupCallParticipantVideo {
  const {
    audioSource, endpoint, paused, sourceGroups,
  } = participantVideo;
  return {
    audioSource,
    endpoint,
    isPaused: paused,
    sourceGroups: sourceGroups.map(buildApiGroupCallParticipantVideoSourceGroup),
  };
}

function buildApiGroupCallParticipantVideoSourceGroup(
  participantVideoSourceGroup: GramJs.GroupCallParticipantVideoSourceGroup,
): SsrcGroup {
  return {
    semantics: participantVideoSourceGroup.semantics,
    sources: participantVideoSourceGroup.sources,
  };
}

export function buildApiGroupCall(groupCall: GramJs.TypeGroupCall): ApiGroupCall {
  const {
    id, accessHash,
  } = groupCall;

  if (groupCall instanceof GramJs.GroupCallDiscarded) {
    return {
      connectionState: 'discarded',
      id: id.toString(),
      accessHash: accessHash.toString(),
      participantsCount: 0,
      version: 0,
      participants: {},
    };
  }

  const {
    version, participantsCount, streamDcId, scheduleDate, canChangeJoinMuted, joinMuted, canStartVideo,
    scheduleStartSubscribed,
  } = groupCall;

  return {
    connectionState: 'disconnected',
    isLoaded: true,
    id: id.toString(),
    accessHash: accessHash.toString(),
    version,
    participantsCount,
    streamDcId,
    scheduleDate,
    canChangeJoinMuted,
    joinMuted,
    canStartVideo,
    scheduleStartSubscribed,
    participants: {},
  };
}

export function getGroupCallId(groupCall: GramJs.TypeInputGroupCall) {
  if (groupCall instanceof GramJs.InputGroupCall) return groupCall.id.toString();
  return undefined;
}

export function buildPhoneCall(call: GramJs.TypePhoneCall): ApiPhoneCall {
  const { id } = call;

  let phoneCall: ApiPhoneCall = {
    id: id.toString(),
  };

  if (call instanceof GramJs.PhoneCallAccepted
    || call instanceof GramJs.PhoneCallWaiting
    || call instanceof GramJs.PhoneCall
    || call instanceof GramJs.PhoneCallRequested) {
    const {
      accessHash, adminId, date, video, participantId, protocol,
    } = call;

    phoneCall = {
      ...phoneCall,
      accessHash: accessHash.toString(),
      adminId: adminId.toString(),
      participantId: participantId.toString(),
      date,
      isVideo: video,
      protocol: buildApiCallProtocol(protocol),
    };
  }

  if (call instanceof GramJs.PhoneCall) {
    const {
      p2pAllowed, gAOrB, keyFingerprint, connections, startDate, customParameters,
    } = call;

    phoneCall = {
      ...phoneCall,
      state: 'active',
      gAOrB: Array.from(gAOrB),
      keyFingerprint: keyFingerprint.toString(),
      startDate,
      isP2pAllowed: Boolean(p2pAllowed),
      connections: connections.map(buildApiCallConnection).filter(Boolean),
      customParameters: parseCallParameters(customParameters),
    };
  }

  if (call instanceof GramJs.PhoneCallDiscarded) {
    phoneCall = {
      ...phoneCall,
      state: 'discarded',
      duration: call.duration,
      reason: buildApiCallDiscardReason(call.reason),
      needRating: call.needRating,
      needDebug: call.needDebug,
    };
  }

  if (call instanceof GramJs.PhoneCallWaiting) {
    phoneCall = {
      ...phoneCall,
      state: 'waiting',
      receiveDate: call.receiveDate,
    };
  }

  if (call instanceof GramJs.PhoneCallAccepted) {
    phoneCall = {
      ...phoneCall,
      state: 'accepted',
      gB: Array.from(call.gB),
    };
  }

  if (call instanceof GramJs.PhoneCallRequested) {
    phoneCall = {
      ...phoneCall,
      state: 'requested',
      gAHash: Array.from(call.gAHash),
    };
  }

  return phoneCall;
}

export function buildApiCallDiscardReason(discardReason?: GramJs.TypePhoneCallDiscardReason) {
  if (discardReason instanceof GramJs.PhoneCallDiscardReasonMissed) {
    return 'missed';
  } else if (discardReason instanceof GramJs.PhoneCallDiscardReasonBusy) {
    return 'busy';
  } else if (discardReason instanceof GramJs.PhoneCallDiscardReasonHangup) {
    return 'hangup';
  } else {
    return 'disconnect';
  }
}

function buildApiCallConnection(connection: GramJs.TypePhoneConnection): ApiPhoneCallConnection | undefined {
  if (connection instanceof GramJs.PhoneConnectionWebrtc) {
    const {
      username, password, turn, stun, ip, ipv6, port,
    } = connection;

    return {
      username,
      password,
      isTurn: turn,
      isStun: stun,
      ip,
      ipv6,
      port,
    };
  } else {
    return undefined;
  }
}

export function buildApiCallProtocol(protocol: GramJs.PhoneCallProtocol): ApiCallProtocol {
  const {
    libraryVersions, minLayer, maxLayer, udpP2p, udpReflector,
  } = protocol;

  return {
    libraryVersions,
    minLayer,
    maxLayer,
    isUdpP2p: udpP2p,
    isUdpReflector: udpReflector,
  };
}

export function buildCallProtocol() {
  return new GramJs.PhoneCallProtocol({
    libraryVersions: CALL_PROTOCOL_LIBRARY_VERSIONS,
    // Hardcoded values according to the docs
    minLayer: 65,
    maxLayer: 92,
    udpReflector: true,
    udpP2p: true,
  });
}
