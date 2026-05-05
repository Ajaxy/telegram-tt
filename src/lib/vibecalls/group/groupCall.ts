import type { Conference, Ssrc } from '../sdp/buildSdp';
import type {
  GroupCallConnectionData, GroupCallConnectionState, GroupCallParticipant, JoinGroupCallPayload, PayloadType,
  StreamType,
} from '../types';
import type { GroupCallDataChannelMessage } from './dataChannelMessages';

import { DEBUG_CALLS } from '../../../config';
import { logDebugMessage } from '../../../util/debugConsole';
import Deferred from '../../../util/Deferred';
import safePlay from '../../../util/safePlay';
import { black, silence } from '../fallbackMedia';
import buildSdp from '../sdp/buildSdp';
import { summarizeSdp } from '../sdp/common';
import parseSdp from '../sdp/groupSdp';
import {
  fromTelegramSource,
  getAmplitude,
  IS_ECHO_CANCELLATION_SUPPORTED,
  IS_NOISE_SUPPRESSION_SUPPORTED,
  THRESHOLD,
  toTelegramSource,
} from '../utils';

const DEFAULT_MID = 3;
const GROUP_CALL_VIDEO_MAX_HEIGHT = 720;

type GroupCallState = {
  connection?: RTCPeerConnection;
  screenshareConnection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  screenshareDataChannel?: RTCDataChannel;
  participants?: GroupCallParticipant[];
  conference?: Partial<Conference>;
  screenshareConference?: Partial<Conference>;
  streams?: Record<string, {
    audio?: MediaStream;
    video?: MediaStream;
    presentation?: MediaStream;
  }>;
  participantFunctions?: Record<string, {
    setVolume?: (volume: number) => void;
    toggleMute?: (muted: boolean) => void;
    getCurrentAmplitude?: () => number;
    dispose?: NoneToVoidFunction;
  }>;
  onUpdate?: (...args: any[]) => void;
  myId?: string;
  black?: MediaStream;
  silence?: MediaStream;
  updatingParticipantsQueue?: any[];
  facingMode?: VideoFacingModeEnum;
  isSpeakerDisabled?: boolean;
  analyserInterval?: number;
  speaking?: Record<string, number>;
  audioElement?: HTMLAudioElement;
  destination?: MediaStreamAudioDestinationNode;
  audioContext?: AudioContext;
  mediaStream?: MediaStream;
  lastMid: number;
  audioStream?: MediaStream;
  audioSource?: MediaStreamAudioSourceNode;
  audioAnalyser?: AnalyserNode;
};

let state: GroupCallState | undefined;

function logGroupCall(message: string, data: Record<string, unknown> = {}) {
  if (!DEBUG_CALLS) return;

  logDebugMessage('debug', `[GroupCall] ${message}`, data);
}

function summarizeError(error: unknown) {
  return error instanceof Error ? {
    name: error.name,
    message: error.message,
  } : String(error);
}

function summarizeTrack(track: MediaStreamTrack | undefined) {
  if (!track) {
    return undefined;
  }

  return {
    id: track.id,
    kind: track.kind,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
    label: track.label,
  };
}

function summarizeStream(stream: MediaStream | undefined) {
  if (!stream) {
    return undefined;
  }

  return {
    id: stream.id,
    active: stream.active,
    tracks: stream.getTracks().map(summarizeTrack),
  };
}

function summarizeTransceiver(transceiver: RTCRtpTransceiver | undefined) {
  if (!transceiver) {
    return undefined;
  }

  return {
    mid: transceiver.mid,
    direction: transceiver.direction,
    currentDirection: transceiver.currentDirection,
    senderTrack: summarizeTrack(transceiver.sender.track || undefined),
    receiverTrack: summarizeTrack(transceiver.receiver.track),
  };
}

function summarizeConnection(connection: RTCPeerConnection | undefined) {
  if (!connection) {
    return undefined;
  }

  return {
    connectionState: connection.connectionState,
    iceConnectionState: connection.iceConnectionState,
    iceGatheringState: connection.iceGatheringState,
    signalingState: connection.signalingState,
    transceivers: connection.getTransceivers().map(summarizeTransceiver),
  };
}

function summarizeSsrc(ssrc: Ssrc) {
  return {
    userId: ssrc.userId,
    endpoint: ssrc.endpoint,
    mid: ssrc.mid,
    isMain: ssrc.isMain,
    isRemoved: ssrc.isRemoved,
    isVideo: ssrc.isVideo,
    isPresentation: ssrc.isPresentation,
    sourceGroups: ssrc.sourceGroups,
  };
}

function summarizeConference(conference: Partial<Conference> | undefined) {
  if (!conference) {
    return undefined;
  }

  return {
    sessionId: conference.sessionId,
    ssrcCount: conference.ssrcs?.length,
    ssrcs: conference.ssrcs?.map(summarizeSsrc),
    transport: conference.transport ? {
      ufrag: conference.transport.ufrag,
      candidateCount: conference.transport.candidates?.length,
      fingerprintCount: conference.transport.fingerprints?.length,
      isRtcpMux: conference.transport['rtcp-mux'],
    } : undefined,
    audioPayloadTypes: conference.audioPayloadTypes?.map((payloadType) => `${payloadType.id}:${payloadType.name}`),
    videoPayloadTypes: conference.videoPayloadTypes?.map((payloadType) => `${payloadType.id}:${payloadType.name}`),
    audioExtensions: conference.audioExtensions?.map((extension) => `${extension.id}:${extension.uri}`),
    videoExtensions: conference.videoExtensions?.map((extension) => `${extension.id}:${extension.uri}`),
  };
}

function summarizeParticipant(participant: GroupCallParticipant) {
  return {
    id: participant.id,
    isSelf: participant.isSelf,
    isMuted: participant.isMuted,
    isMutedByMe: participant.isMutedByMe,
    isLeft: participant.isLeft,
    isVideoJoined: participant.isVideoJoined,
    source: participant.source,
    volume: participant.volume,
    video: participant.video ? {
      endpoint: participant.video.endpoint,
      sourceGroups: participant.video.sourceGroups,
      isPaused: participant.video.isPaused,
    } : undefined,
    presentation: participant.presentation ? {
      endpoint: participant.presentation.endpoint,
      sourceGroups: participant.presentation.sourceGroups,
      isPaused: participant.presentation.isPaused,
    } : undefined,
  };
}

function summarizeConnectionData(data: GroupCallConnectionData) {
  return {
    isStream: data.stream,
    transport: {
      ufrag: data.transport.ufrag,
      candidateCount: data.transport.candidates.length,
      fingerprintCount: data.transport.fingerprints.length,
      isRtcpMux: data.transport['rtcp-mux'],
    },
    audioPayloadTypes: data.audio?.['payload-types'].map((payloadType) => `${payloadType.id}:${payloadType.name}`),
    videoPayloadTypes: data.video['payload-types'].map((payloadType) => `${payloadType.id}:${payloadType.name}`),
    audioExtensions: data.audio?.['rtp-hdrexts'].map((extension) => `${extension.id}:${extension.uri}`),
    videoExtensions: data.video['rtp-hdrexts'].map((extension) => `${extension.id}:${extension.uri}`),
    videoEndpoint: data.video.endpoint,
    serverSources: data.video.server_sources,
  };
}

function getPresentationSourceFromVideoGroups(ssrcGroups: JoinGroupCallPayload['ssrc-groups']) {
  const firstVideoSource = ssrcGroups?.[0]?.sources[0];
  if (!firstVideoSource) {
    return undefined;
  }

  return toTelegramSource(fromTelegramSource(firstVideoSource) - 1);
}

function buildPayloadTypeLines(payloadType: PayloadType) {
  const {
    channels, id, name, clockrate, parameters,
  } = payloadType;

  const lines = [
    `a=rtpmap:${id} ${name}/${clockrate}${channels ? `/${channels}` : ''}`,
  ];

  if (parameters) {
    const parametersString = Object.keys(parameters).map((key) => `${key}=${parameters[key]};`).join(' ');
    lines.push(`a=fmtp:${id} ${parametersString}`);
  }

  payloadType['rtcp-fbs']?.forEach((fbParam) => {
    lines.push(`a=rtcp-fb:${id} ${fbParam.type}${fbParam.subtype ? ` ${fbParam.subtype}` : ''}`);
  });

  return lines;
}

function mungePresentationOfferSdp(sdp: string) {
  const videoPayloadTypes = state?.conference?.videoPayloadTypes;
  const videoExtensions = state?.conference?.videoExtensions;

  if (!videoPayloadTypes?.length) {
    logGroupCall('presentation offer munge skipped: missing protocol video params', {
      hasVideoPayloadTypes: Boolean(videoPayloadTypes?.length),
      hasVideoExtensions: Boolean(videoExtensions?.length),
    });
    return sdp;
  }

  const additions = videoPayloadTypes.flatMap(buildPayloadTypeLines);
  if (videoExtensions?.length) {
    additions.push(...videoExtensions.map(({ id, uri }) => `a=extmap:${id} ${uri}`));
  }

  const sections = sdp.split(/\r?\nm=/).map((section, index) => index === 0 ? section : `m=${section}`);
  const mungedSections = sections.map((section) => {
    const lines = section.split(/\r?\n/).filter(Boolean);
    if (!lines[0]?.startsWith('m=video ')) {
      return section;
    }

    const mLineParts = lines[0].split(' ');
    const mungedLines: string[] = [
      `${mLineParts.slice(0, 3).join(' ')} ${videoPayloadTypes.map(({ id }) => id).join(' ')}`,
    ];

    let didAddProtocolLines = false;
    lines.slice(1).forEach((line) => {
      if (
        line.startsWith('a=rtpmap:')
        || line.startsWith('a=fmtp:')
        || line.startsWith('a=rtcp-fb:')
        || line.startsWith('a=extmap:')
      ) {
        return;
      }

      mungedLines.push(line);
      if (line === 'a=rtcp-mux') {
        mungedLines.push(...additions);
        didAddProtocolLines = true;
      }
    });

    if (!didAddProtocolLines) {
      mungedLines.splice(1, 0, ...additions);
    }

    return mungedLines.join('\r\n');
  });

  return `${mungedSections.join('\r\n')}\r\n`;
}

export async function getDevices(streamType: StreamType, isInput = true) {
  return (await navigator.mediaDevices.enumerateDevices())
    .filter((l) => l.kind === `${streamType}${isInput ? 'input' : 'output'}`);
}

export function toggleSpeaker() {
  if (!state) {
    return;
  }

  state.isSpeakerDisabled = !state.isSpeakerDisabled;
  state?.onUpdate?.({
    '@type': 'updateGroupCallConnectionState',
    connectionState: 'connected',
    isSpeakerDisabled: state.isSpeakerDisabled,
  });
  if (state.participantFunctions) {
    Object.values(state.participantFunctions).forEach((l) => {
      l.toggleMute?.(Boolean(state?.isSpeakerDisabled));
    });
  }
}

function leavePresentation(isFromToggle?: boolean) {
  if (!state) {
    return;
  }
  state.screenshareDataChannel?.close();
  state.screenshareConnection?.close();

  if (!isFromToggle) {
    state.onUpdate?.({
      '@type': 'updateGroupCallLeavePresentation',
    });
  }
}

export function toggleNoiseSuppression() {
  if (!state || !state.myId || !state.streams) {
    return;
  }

  const audioStream = state.streams[state.myId].audio;
  if (!audioStream) {
    return;
  }

  const track = audioStream.getTracks()[0];

  if (!track) {
    return;
  }

  // @ts-ignore
  const { echoCancellation, noiseSuppression } = track.getConstraints();

  track.applyConstraints({
    echoCancellation: !echoCancellation,
    // @ts-ignore
    noiseSuppression: !noiseSuppression,
  });
}

export function getUserStreams(userId: string) {
  return state?.streams?.[userId];
}

export function setVolume(userId: string, volume: number) {
  const participantFunctions = state?.participantFunctions?.[userId];
  if (!participantFunctions) return;
  participantFunctions.setVolume?.(volume);
}

export function isStreamEnabled(streamType: StreamType, userId?: string) {
  const id = userId || state?.myId;
  const stream = id && getUserStreams(id)?.[streamType];
  if (!stream) return false;

  return stream.getTracks()[0]?.enabled;
}

function updateGroupCallStreams(userId: string) {
  state?.onUpdate?.({
    '@type': 'updateGroupCallStreams',
    userId,
    hasAudioStream: isStreamEnabled('audio', userId),
    hasVideoStream: isStreamEnabled('video', userId),
    hasPresentationStream: isStreamEnabled('presentation', userId),
    amplitude: state.speaking?.[userId],
  });
}

async function getUserStream(streamType: StreamType, facing: VideoFacingModeEnum = 'user') {
  if (streamType === 'audio' && state?.audioStream) {
    return state.audioStream;
  }

  if (streamType === 'presentation') {
    return (navigator.mediaDevices as any).getDisplayMedia({
      audio: false,
      video: true,
    });
  }

  const media = await navigator.mediaDevices.getUserMedia({
    audio: streamType === 'audio' ? {
      // @ts-ignore
      ...(IS_ECHO_CANCELLATION_SUPPORTED && { echoCancellation: true }),
      ...(IS_NOISE_SUPPRESSION_SUPPORTED && { noiseSuppression: true }),
    } : false,
    video: streamType === 'video' ? {
      facingMode: facing,
    } : false,
  });

  if (state && streamType === 'audio') {
    state.audioStream = media;
  }

  if (streamType === 'video') {
    const vid = document.createElement('video');
    vid.srcObject = media;

    const deferred = new Deferred();
    vid.oncanplay = () => deferred.resolve();
    await deferred.promise;
  }

  return media;
}

export async function switchCameraInput() {
  if (!state?.myId || !state.connection || !state.streams || !state.facingMode) {
    return;
  }

  const stream = getUserStreams(state.myId)?.video;

  if (!stream) return;

  const track = stream.getTracks()[0];

  if (!track) {
    return;
  }

  const sender = state.connection.getSenders().find((l) => track.id === l.track?.id);

  if (!sender) {
    return;
  }

  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  try {
    const newStream = await getUserStream('video', state.facingMode);

    await sender.replaceTrack(newStream.getTracks()[0]);
    state.streams[state.myId].video = newStream;
  } catch (err) {
    logGroupCall('switch camera failed', {
      error: summarizeError(err),
    });
  }
}

export async function toggleStream(streamType: StreamType, value: boolean | undefined = undefined) {
  if (!state || !state.myId || !state.connection || !state.streams) {
    logGroupCall('toggle stream skipped: missing state', {
      streamType,
      hasState: Boolean(state),
    });
    return;
  }

  const stream = getUserStreams(state.myId)?.[streamType];
  if (!stream) {
    logGroupCall('toggle stream skipped: missing stream', {
      streamType,
      myId: state.myId,
    });
    return;
  }

  const track = stream.getTracks()[0];

  if (!track) {
    logGroupCall('toggle stream skipped: missing track', {
      streamType,
      stream: summarizeStream(stream),
    });
    return;
  }

  const sender = [
    ...state.connection.getSenders(),
    ...(state.screenshareConnection?.getSenders() || []),
  ].find((l) => track.id === l.track?.id);

  if (!sender) {
    logGroupCall('toggle stream skipped: missing sender', {
      streamType,
      track: summarizeTrack(track),
    });
    return;
  }

  value = value === undefined ? !track.enabled : value;

  try {
    if (value && !track.enabled) {
      const newStream = await getUserStream(streamType);
      await sender.replaceTrack(newStream.getTracks()[0]);
      state.streams[state.myId][streamType] = newStream;
      if (streamType === 'video') {
        state.facingMode = 'user';
      } else if (streamType === 'audio') {
        const { audioContext } = state;
        if (!audioContext) return;
        const source = state.audioSource || audioContext.createMediaStreamSource(newStream);

        const analyser = state.audioAnalyser || audioContext.createAnalyser();
        analyser.minDecibels = -100;
        analyser.maxDecibels = -30;
        analyser.smoothingTimeConstant = 0.05;
        analyser.fftSize = 1024;

        source.connect(analyser);

        state = {
          ...state,
          audioSource: source,
          audioAnalyser: analyser,
          participantFunctions: {
            ...state.participantFunctions,
            [state.myId]: {
              ...state.participantFunctions?.[state.myId],
              getCurrentAmplitude: () => {
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                return getAmplitude(array, 1.5);
              },
            },
          },
        };
      }
    } else if (!value && track.enabled) {
      const newStream = streamType === 'audio' ? state.silence : state.black;
      if (!newStream) return;

      await sender.replaceTrack(newStream.getTracks()[0]);
      state.streams[state.myId][streamType] = newStream;
      if (streamType === 'video') {
        state.facingMode = undefined;
      }

      if (streamType !== 'audio') {
        // We only want to stop video streams
        track.stop();
      } else {
        state.audioSource?.disconnect();
        state.audioAnalyser?.disconnect();
      }
    }
    updateGroupCallStreams(state.myId!);
    if (streamType === 'presentation' && !value) leavePresentation(true);
  } catch (e) {
    logGroupCall('toggle stream failed', {
      streamType,
      shouldEnable: value,
      error: summarizeError(e),
    });
  }
}

function updateConnectionState(connectionState: GroupCallConnectionState) {
  logGroupCall('connection state update', {
    connectionState,
  });
  state?.onUpdate?.({
    '@type': 'updateGroupCallConnectionState',
    connectionState,
  });
}

export function leaveGroupCall() {
  if (!state) {
    return;
  }

  logGroupCall('leave', {
    myId: state.myId,
    connection: summarizeConnection(state.connection),
    screenshareConnection: summarizeConnection(state.screenshareConnection),
    streamUserCount: Object.keys(state.streams || {}).length,
  });

  if (state.myId && state.streams?.[state.myId]) {
    Object.values(state.streams[state.myId] || {}).forEach((stream) => {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
    });
  }

  state.audioStream?.getTracks().forEach((track) => {
    track.stop();
  });
  leavePresentation(true);
  state.dataChannel?.close();
  state.connection?.close();
  updateConnectionState('disconnected');

  if (state.analyserInterval) {
    clearInterval(state.analyserInterval);
  }
  if (state.participantFunctions) {
    Object.values(state.participantFunctions).forEach(({ dispose }) => {
      dispose?.();
    });
  }

  state = undefined;
}

function analyzeAmplitudes() {
  if (!state || !state.participantFunctions) return;

  Object.keys(state.participantFunctions).forEach((id) => {
    const participantFunctions = state!.participantFunctions![id];
    if (!participantFunctions) return;

    const { getCurrentAmplitude } = participantFunctions;

    if (getCurrentAmplitude) {
      const amplitude = getCurrentAmplitude();
      const prevAmplitude = state!.speaking![id] || 0;
      state!.speaking![id] = amplitude;
      if ((amplitude > THRESHOLD && prevAmplitude <= THRESHOLD)
        || (amplitude <= THRESHOLD && prevAmplitude > THRESHOLD)) {
        updateGroupCallStreams(id);
      }
    }
  });
}

function getRemoteVideoEndpoints() {
  const endpoints: string[] = [];

  state?.conference?.ssrcs?.forEach((ssrc) => {
    if (!ssrc.isVideo || ssrc.isRemoved || !ssrc.userId || !ssrc.endpoint) {
      return;
    }

    if (!endpoints.includes(ssrc.endpoint)) {
      endpoints.push(ssrc.endpoint);
    }
  });

  return endpoints;
}

function sendDataChannelMessage(message: GroupCallDataChannelMessage) {
  if (!state?.dataChannel || state.dataChannel.readyState !== 'open') {
    logGroupCall('data channel send skipped', {
      colibriClass: message.colibriClass,
      hasDataChannel: Boolean(state?.dataChannel),
      readyState: state?.dataChannel?.readyState,
    });
    return false;
  }

  const data = JSON.stringify(message);
  state.dataChannel.send(data);

  return true;
}

function updateRemoteVideoConstraints() {
  const endpoints = getRemoteVideoEndpoints();
  const constraints: Record<string, { minHeight: number; maxHeight: number }> = {};

  endpoints.forEach((endpoint) => {
    constraints[endpoint] = {
      minHeight: 0,
      maxHeight: GROUP_CALL_VIDEO_MAX_HEIGHT,
    };
  });

  sendDataChannelMessage({
    colibriClass: 'ReceiverVideoConstraints',
    defaultConstraints: {
      maxHeight: 0,
    },
    constraints,
    onStageEndpoints: endpoints,
  });
}

function createDataChannel(connection: RTCPeerConnection) {
  const dataChannel = connection.createDataChannel('data', {
    id: 0,
  });

  dataChannel.onopen = () => {
    updateRemoteVideoConstraints();
  };

  dataChannel.onmessage = (e) => {
    if (typeof e.data !== 'string') {
      logGroupCall('data channel non-string message', {
        dataType: typeof e.data,
      });
      return;
    }

    let data: GroupCallDataChannelMessage;
    try {
      data = JSON.parse(e.data) as GroupCallDataChannelMessage;
    } catch (err) {
      logGroupCall('data channel message parse failed', {
        dataLength: e.data.length,
        error: summarizeError(err),
      });
      return;
    }

    switch (data.colibriClass) {
      case 'DominantSpeakerEndpointChangeEvent':
        break;
      case 'SenderVideoConstraints':

        break;
      case 'EndpointConnectivityStatusChangeEvent':

        break;
    }
  };

  dataChannel.onerror = (e) => {
    logGroupCall('data channel error', {
      id: dataChannel.id,
      label: dataChannel.label,
      readyState: dataChannel.readyState,
      error: e instanceof ErrorEvent ? e.message : summarizeError(e),
    });
  };

  return dataChannel;
}

export async function handleUpdateGroupCallParticipants(updatedParticipants: GroupCallParticipant[]) {
  if (!state) {
    logGroupCall('participants update skipped: missing state', {
      participantCount: updatedParticipants.length,
    });
    return;
  }

  const {
    participants, conference, connection, myId,
  } = state;

  if (!participants || !conference || !connection || !conference.ssrcs || !conference.transport || !myId) {
    logGroupCall('participants update skipped: incomplete state', {
      participantCount: updatedParticipants.length,
      hasParticipants: Boolean(participants),
      hasConference: Boolean(conference),
      hasConnection: Boolean(connection),
      hasSsrcs: Boolean(conference?.ssrcs),
      hasTransport: Boolean(conference?.transport),
      myId,
    });
    return;
  }

  // Joined from another client
  if (updatedParticipants.find((participant) => {
    return participant.isSelf
      && participant.source
      !== state?.conference?.ssrcs?.find((l) => l.isMain && !l.isVideo)?.sourceGroups[0].sources[0];
  })) {
    logGroupCall('participants update detected self source mismatch; leaving', {
      participants: updatedParticipants.map(summarizeParticipant),
      mainAudioSource: state?.conference?.ssrcs?.find((l) => l.isMain && !l.isVideo)?.sourceGroups[0].sources[0],
    });
    leaveGroupCall();
    return;
  }

  updatedParticipants.forEach((participant) => {
    if (participant.isSelf) {
      if (participant.isMuted && !participant.canSelfUnmute) {
        // Muted by admin
        toggleStream('audio', false);
        toggleStream('video', false);
        toggleStream('presentation', false);
      }
      return;
    }

    const { isLeft } = participant;
    const isAudioLeft = participant.isMuted || participant.isMutedByMe;
    const isVideoLeft = !participant.isVideoJoined || !participant.video || isLeft;
    const isPresentationLeft = !participant.presentation || isLeft;

    let hasVideo = false;
    let hasAudio = false;
    let hasPresentation = false;

    conference.ssrcs!.filter((l) => l.userId === participant.id).forEach((ssrc) => {
      if (!ssrc.isVideo) {
        if (ssrc.sourceGroups[0].sources[0] === participant.source) {
          hasAudio = true;
        }
        // console.log('has audio, removed=', isAudioLeft);
        ssrc.isRemoved = isAudioLeft;
      }

      if (ssrc.isVideo) {
        if (!ssrc.isPresentation) {
          if (Boolean(participant.video) && ssrc.endpoint === participant.video.endpoint) {
            hasVideo = true;
          }
          // console.log('has video = ', hasVideo, ' removed=', isVideoLeft);
          ssrc.isRemoved = isVideoLeft;
        }

        if (ssrc.isPresentation) {
          if (Boolean(participant.presentation) && ssrc.endpoint === participant.presentation.endpoint) {
            hasPresentation = true;
          }
          // console.log('has presentation, removed=', isPresentationLeft);
          ssrc.isRemoved = isPresentationLeft;
        }
      }
    });

    if (!isAudioLeft && !hasAudio) {
      state!.lastMid = state!.lastMid + 1;
      logGroupCall('participant audio source added', {
        participant: summarizeParticipant(participant),
        mid: state!.lastMid.toString(),
      });
      conference.ssrcs!.push({
        userId: participant.id,
        isMain: false,
        endpoint: `audio${participant.source}`,
        isVideo: false,
        sourceGroups: [{
          sources: [participant.source],
        }],
        mid: state!.lastMid.toString(),
      });
    }

    if (!isVideoLeft && !hasVideo && participant.video) {
      state!.lastMid = state!.lastMid + 1;

      logGroupCall('participant video source added', {
        participant: summarizeParticipant(participant),
        endpoint: participant.video.endpoint,
        mid: state!.lastMid.toString(),
        sourceGroups: participant.video.sourceGroups,
      });
      conference.ssrcs!.push({
        userId: participant.id,
        isMain: false,
        endpoint: participant.video.endpoint,
        isVideo: true,
        sourceGroups: participant.video.sourceGroups,
        mid: state!.lastMid.toString(),
      });
    }

    if (!isPresentationLeft && !hasPresentation && participant.presentation) {
      state!.lastMid = state!.lastMid + 1;
      logGroupCall('participant presentation source added', {
        participant: summarizeParticipant(participant),
        endpoint: participant.presentation.endpoint,
        mid: state!.lastMid.toString(),
        sourceGroups: participant.presentation.sourceGroups,
      });
      conference.ssrcs!.push({
        isPresentation: true,
        userId: participant.id,
        isMain: false,
        endpoint: participant.presentation.endpoint,
        isVideo: true,
        sourceGroups: participant.presentation.sourceGroups,
        mid: state!.lastMid.toString(),
      });
    }
  });

  if (state.updatingParticipantsQueue) {
    state.updatingParticipantsQueue.push(conference);
    return;
  } else {
    state.updatingParticipantsQueue = [];
  }

  const sdp = buildSdp(conference as Conference);

  try {
    await connection.setRemoteDescription({
      type: 'offer',
      sdp,
    });
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    updateRemoteVideoConstraints();

    updateGroupCallStreams(myId);
    if (state.updatingParticipantsQueue.length > 0) {
      for (const newConference of state.updatingParticipantsQueue) {
        const queuedSdp = buildSdp(newConference as Conference);
        await connection.setRemoteDescription({
          type: 'offer',
          sdp: queuedSdp,
        });
        const answerNew = await connection.createAnswer();
        await connection.setLocalDescription(answerNew);
        updateRemoteVideoConstraints();
        updateGroupCallStreams(myId);
      }
    }
  } catch (e) {
    logGroupCall('participants negotiation failed', {
      error: summarizeError(e),
      connection: summarizeConnection(connection),
    });
  } finally {
    if (state) {
      state.updatingParticipantsQueue = undefined;
    }
  }
}
//
// function sendDataChannelMessage(message: GroupCallDataChannelMessage) {
//   if (!state || !state.dataChannel || state.dataChannel.readyState !== 'open') {
//     return;
//   }
//
//   // console.log('SEND!', message);
//   state.dataChannel.send(JSON.stringify(message));
// }

export async function handleUpdateGroupCallConnection(data: GroupCallConnectionData, isPresentation: boolean) {
  if (!state) {
    logGroupCall('connection update skipped: missing state', {
      isPresentation,
      data: summarizeConnectionData(data),
    });
    return;
  }

  const conference = isPresentation ? state.screenshareConference : state.conference;
  const connection = isPresentation ? state.screenshareConnection : state.connection;

  if (!conference || !connection || !conference.ssrcs) {
    logGroupCall('connection update skipped: incomplete state', {
      isPresentation,
      hasConference: Boolean(conference),
      hasConnection: Boolean(connection),
      hasSsrcs: Boolean(conference?.ssrcs),
      data: summarizeConnectionData(data),
    });
    return;
  }

  const newConference: Conference = {
    ...conference,
    ssrcs: conference.ssrcs,
    transport: data.transport,
    sessionId: Date.now(),
    audioExtensions: data.audio?.['rtp-hdrexts'] || conference.audioExtensions || [],
    audioPayloadTypes: data.audio?.['payload-types'] || conference.audioPayloadTypes || [],
    videoExtensions: data.video['rtp-hdrexts'],
    videoPayloadTypes: data.video['payload-types'],
  };

  state = {
    ...state,
    ...(!isPresentation ? { conference: newConference } : { screenshareConference: newConference }),
  };

  try {
    const sdp = buildSdp(newConference, true, isPresentation);
    await connection.setRemoteDescription({
      type: 'answer',
      sdp,
    });
    // state.resolveTest();
    // state.test = true;
  } catch (e) {
    logGroupCall('server answer apply failed', {
      isPresentation,
      error: summarizeError(e),
      connection: summarizeConnection(connection),
    });
  }
}

function handleTrack(e: RTCTrackEvent) {
  if (!state || !state.audioElement || !state.audioContext || !state.mediaStream) {
    logGroupCall('remote track skipped: incomplete state', {
      track: summarizeTrack(e.track),
      streamCount: e.streams.length,
      hasState: Boolean(state),
      hasAudioElement: Boolean(state?.audioElement),
      hasAudioContext: Boolean(state?.audioContext),
      hasMediaStream: Boolean(state?.mediaStream),
    });
    return;
  }
  const ssrc = state.conference?.ssrcs?.find((l) => l.endpoint === e.track.id);
  if (!ssrc || !ssrc.userId) {
    logGroupCall('remote track skipped: no matching ssrc', {
      track: summarizeTrack(e.track),
      endpoint: e.track.id,
      conference: summarizeConference(state.conference),
    });
    return;
  }

  const { userId, isPresentation } = ssrc;
  const participant = state.participants?.find((p) => p.id === userId);

  const streamType = (e.track.kind === 'video' ? (isPresentation ? 'presentation' : 'video') : 'audio') as StreamType;

  e.track.onended = () => {
    logGroupCall('remote track ended', {
      userId,
      streamType,
      track: summarizeTrack(e.track),
    });
    if (streamType === 'audio' && state?.streams?.[userId]?.audio === stream) {
      state.participantFunctions?.[userId]?.dispose?.();
      delete state.participantFunctions?.[userId];
    }
    delete state?.streams?.[userId][streamType];
    updateGroupCallStreams(userId);
  };
  e.track.onmute = () => undefined;
  e.track.onunmute = () => undefined;

  const stream = e.streams[0];
  if (!stream) {
    logGroupCall('remote track skipped: missing stream', {
      userId,
      streamType,
      track: summarizeTrack(e.track),
    });
    return;
  }

  if (e.track.kind === 'audio') {
    const { audioContext } = state;
    state.participantFunctions?.[userId]?.dispose?.();
    const source = audioContext.createMediaStreamSource(stream);

    const gainNode = audioContext.createGain();
    gainNode.gain.value = (participant?.volume || 10000) / 10000;

    const muteNode = audioContext.createGain();
    muteNode.gain.value = state.isSpeakerDisabled ? 0 : 1;

    const analyser = audioContext.createAnalyser();
    analyser.minDecibels = -100;
    analyser.maxDecibels = -30;
    analyser.smoothingTimeConstant = 0.05;
    analyser.fftSize = 1024;

    source.connect(analyser).connect(muteNode).connect(gainNode).connect(audioContext.destination);

    // https://stackoverflow.com/questions/41784137/webrtc-doesnt-work-with-audiocontext#comment117600018_41784241
    const test = new Audio();
    test.srcObject = stream;
    // test.srcObject = source.mediaStream;
    test.muted = true;
    test.remove();

    state = {
      ...state,
      participantFunctions: {
        ...state.participantFunctions,
        [userId]: {
          ...state.participantFunctions?.[userId],
          setVolume: (volume: number) => {
            gainNode.gain.value = volume > 1 ? volume * 2 : volume;
          },
          toggleMute: (muted?: boolean) => {
            muteNode.gain.value = muted ? 0 : 1;
          },
          getCurrentAmplitude: () => {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            return getAmplitude(array, 1.5);
          },
          dispose: () => {
            source.disconnect();
            analyser.disconnect();
            muteNode.disconnect();
            gainNode.disconnect();
          },
        },
      },
    };
  }

  state = {
    ...state,
    streams: {
      ...state.streams,
      [userId]: {
        ...state.streams?.[userId],
        [streamType]: stream,
      },
    },
  };

  updateGroupCallStreams(userId);
}

function initializeConnection(
  streams: MediaStream[],
  resolve: (payload?: JoinGroupCallPayload) => void,
  isPresentation = false,
) {
  const connection = new RTCPeerConnection();

  const dataChannel = isPresentation ? undefined : createDataChannel(connection);

  streams.forEach((stream) => stream.getTracks().forEach((track) => {
    connection.addTrack(track, stream);
  }));

  if (!isPresentation) {
    connection.oniceconnectionstatechange = () => {
      const connectionState = connection.iceConnectionState;
      if (connectionState === 'connected' || connectionState === 'completed') {
        updateConnectionState('connected');
      } else if (connectionState === 'checking' || connectionState === 'new') {
        updateConnectionState('connecting');
      } else if (connection.iceConnectionState === 'disconnected') {
        updateConnectionState('reconnecting');
      }
    };
  }
  connection.ontrack = handleTrack;
  connection.onnegotiationneeded = async () => {
    if (!state) return;

    const { myId } = state;

    if (!myId) {
      return;
    }
    let offer = await connection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: !isPresentation,
    });
    if (isPresentation && offer.sdp) {
      offer = {
        ...offer,
        sdp: mungePresentationOfferSdp(offer.sdp),
      };
    }
    logGroupCall('local offer created', {
      isPresentation,
      sdp: offer.sdp ? summarizeSdp(offer.sdp, true) : undefined,
    });

    await connection.setLocalDescription(offer);
    if (!offer.sdp) {
      return;
    }

    const sdp = parseSdp(offer);
    if (!sdp) {
      logGroupCall('local offer parse failed', {
        isPresentation,
      });
      resolve(undefined);
      return;
    }

    if (isPresentation && !sdp.ssrc) {
      sdp.ssrc = getPresentationSourceFromVideoGroups(sdp['ssrc-groups']);
    }

    const audioSsrc: Ssrc | undefined = !isPresentation ? {
      userId: '',
      sourceGroups: [
        {
          sources: [sdp.ssrc || 0],
        },
      ],
      isRemoved: isPresentation,
      isMain: true,
      isVideo: false,
      isPresentation,
      endpoint: isPresentation ? '1' : '0',
      mid: isPresentation ? '1' : '0',
    } : undefined;

    const videoSsrc: Ssrc | undefined = sdp['ssrc-groups'] && {
      isPresentation,
      userId: '',
      sourceGroups: sdp['ssrc-groups'],
      isMain: true,
      isVideo: true,
      endpoint: isPresentation ? '0' : '1',
      mid: isPresentation ? '0' : '1',
    };

    const conference = isPresentation ? state.screenshareConference : state.conference;

    const ssrcs: Ssrc[] = [];
    if (isPresentation) {
      if (videoSsrc) ssrcs.push(videoSsrc);
      if (audioSsrc) ssrcs.push(audioSsrc);
    } else {
      if (audioSsrc) ssrcs.push(audioSsrc);
      if (videoSsrc) ssrcs.push(videoSsrc);
    }

    const audioStream = streams.find((l) => l.getTracks()[0].kind === 'audio');
    const videoStream = streams.find((l) => l.getTracks()[0].kind === 'video');

    state = {
      ...state,
      ...(!isPresentation ? {
        conference: {
          ...conference,
          ssrcs,
        },
      } : {
        screenshareConference: {
          ...conference,
          ssrcs,
        },
      }),
      streams: {
        ...state.streams,
        [myId]: {
          ...state.streams?.[myId],
          ...(audioStream && { audio: audioStream }),
          ...(!isPresentation && videoStream ? { video: videoStream } : { presentation: videoStream }),
        },
      },
    };

    updateGroupCallStreams(myId);

    resolve(sdp);
  };

  return { connection, dataChannel };
}

export async function startSharingScreen(): Promise<JoinGroupCallPayload | undefined> {
  if (!state) {
    logGroupCall('start sharing screen skipped: missing state');
    return undefined;
  }

  try {
    const stream: MediaStream | undefined = await getUserStream('presentation');

    if (!stream) {
      logGroupCall('start sharing screen failed: missing stream');
      return undefined;
    }

    stream.getTracks()[0].onended = () => {
      if (state && state.myId) {
        logGroupCall('screen sharing track ended', {
          myId: state.myId,
          stream: summarizeStream(stream),
        });
        delete state.streams?.[state.myId].presentation;
        updateGroupCallStreams(state.myId);
        leavePresentation();
      }
    };

    return await new Promise((resolve) => {
      const { connection, dataChannel } = initializeConnection([stream], resolve, true);
      state = {
        ...state!,
        screenshareConnection: connection,
        screenshareDataChannel: dataChannel,
      };
    });
  } catch (e) {
    logGroupCall('start sharing screen failed', {
      error: summarizeError(e),
    });
    return undefined;
  }
}

export function joinGroupCall(
  myId: string,
  audioContext: AudioContext,
  audioElement: HTMLAudioElement,
  onUpdate: (...args: any[]) => void,
): Promise<JoinGroupCallPayload | undefined> {
  if (state) {
    throw Error('Already in call');
  }

  logGroupCall('join', {
    myId,
    audioContextState: audioContext.state,
  });
  updateConnectionState('connecting');

  const mediaStream = new MediaStream();
  audioElement.srcObject = mediaStream;
  safePlay(audioElement);

  state = {
    onUpdate,
    participants: [],
    myId,
    speaking: {},
    silence: silence(audioContext),
    black: black({ width: 640, height: 480 }),
    // @ts-ignore
    analyserInterval: setInterval(analyzeAmplitudes, 1000),
    audioElement,
    // destination,
    audioContext,
    mediaStream,
    lastMid: DEFAULT_MID,
  };

  // Prepare microphone
  void getUserStream('audio').catch((err) => {
    logGroupCall('initial microphone preparation failed', {
      error: summarizeError(err),
    });
  });

  return new Promise((resolve) => {
    state = {
      ...state!,
      ...initializeConnection([state!.silence!, state!.black!], resolve),
    };
  });
}
