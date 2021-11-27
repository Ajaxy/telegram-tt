import { GroupCallParticipant, GroupCallParticipantVideo, SsrcGroup } from '../../../lib/secret-sauce';
import { Api as GramJs } from '../../../lib/gramjs';
import { ApiGroupCall } from '../../types';
import { getApiChatIdFromMtpPeer, isPeerUser } from './peers';

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
    isUser: isPeerUser(peer),
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
  return groupCall.id.toString();
}
