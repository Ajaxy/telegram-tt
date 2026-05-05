import type { Conference } from '../sdp/buildSdp';
import type { SdpSection } from '../sdp/common';
import type {
  ApiPhoneCallConnection, SsrcGroup,
  StreamType } from '../types';
import type {
  MediaContent, MediaStateMessage, P2pMessage,
} from './signalingMessages';

import { DEBUG_CALLS } from '../../../config';
import { logDebugMessage } from '../../../util/debugConsole';
import { black, silence } from '../fallbackMedia';
import {
  findSdpLineValue as findLineValue,
  getSdpDirection,
  getSdpPort,
  parseBundleMids,
  parseExtmaps,
  parseFingerprints,
  parsePayloadTypes,
  parseSdpSections,
  parseSsrcGroups,
  parseSsrcs,
  summarizeSdp,
} from '../sdp/common';
import {
  IS_ECHO_CANCELLATION_SUPPORTED,
  IS_NOISE_SUPPRESSION_SUPPORTED,
  p2pPayloadTypeToConference,
} from '../utils';

type RemoteMediaState = {
  isMuted: boolean;
  videoState: MediaStateMessage['videoState'];
  videoRotation: MediaStateMessage['videoRotation'];
  screencastState: MediaStateMessage['screencastState'];
  isBatteryLow: boolean;
};

type MediaMids = {
  audio: string;
  video: string;
  presentation: string;
  data: string;
};

type ActiveLocalMedia = {
  hasVideo: boolean;
  hasPresentation: boolean;
};

type LocalMediaParameters = {
  audioPayloadTypes: Conference['audioPayloadTypes'];
  audioExtensions: Conference['audioExtensions'];
  videoPayloadTypes: Conference['videoPayloadTypes'];
  videoExtensions: Conference['videoExtensions'];
};

type SsrcEntry = Conference['ssrcs'][number] & {
  direction?: RTCRtpTransceiverDirection;
  isLocalOnly?: boolean;
};

type CandidatesMessage = Extract<P2pMessage, { '@type': 'Candidates' }>;

type QueuedP2pCandidate = CandidatesMessage['candidates'][number] & Pick<CandidatesMessage, 'exchangeId' | 'ufrag'>;

type P2pState = {
  connection: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  emitSignalingData: (data: P2pMessage) => void;
  onUpdate: (...args: any[]) => void;
  isOutgoing: boolean;
  isStarting?: boolean;
  isMakingOffer?: boolean;
  isUpdatingExclusiveVideo?: boolean;
  remoteSetup?: Extract<P2pMessage, { '@type': 'InitialSetup' }>;
  pendingRemoteNegotiation?: Extract<P2pMessage, { '@type': 'NegotiateChannels' }>;
  queuedRemoteNegotiation?: Extract<P2pMessage, { '@type': 'NegotiateChannels' }>;
  pendingLocalExchangeId?: string;
  localCandidateExchangeId?: string;
  pendingLocalContentMids?: Record<string, string>;
  pendingRemoteContentMids?: Record<string, string>;
  appliedRemoteExchangeId?: string;
  appliedRemoteExchangeIds: Set<string>;
  appliedRemoteUfrag?: string;
  isApplyingRemoteNegotiation?: boolean;
  handledRemoteExchangeIds: Set<string>;
  pendingCandidates: QueuedP2pCandidate[];
  transceivers: {
    audio: RTCRtpTransceiver;
    remoteAudio?: RTCRtpTransceiver;
    video?: RTCRtpTransceiver;
    presentation?: RTCRtpTransceiver;
    remoteVideo?: RTCRtpTransceiver;
    remotePresentation?: RTCRtpTransceiver;
  };
  senders: {
    audio: RTCRtpSender;
    video?: RTCRtpSender;
    presentation?: RTCRtpSender;
  };
  streams: {
    video?: MediaStream;
    audio?: MediaStream;
    presentation?: MediaStream;
    ownAudio?: MediaStream;
    ownVideo?: MediaStream;
    ownPresentation?: MediaStream;
  };
  audioContext: AudioContext;
  silence: MediaStream;
  blackVideo: MediaStream;
  blackPresentation: MediaStream;
  remoteMediaState: RemoteMediaState;
  audio: HTMLAudioElement;
  facingMode?: VideoFacingModeEnum;
  exchangeId: number;
  lastLocalSetupKey?: string;
};

let state: P2pState | undefined;
let dataChannelSignalingMessagePromise = Promise.resolve();

const ICE_CANDIDATE_POOL_SIZE = 10;
const DEFAULT_AUDIO_MID = '0';
const DEFAULT_VIDEO_MID = '1';
const DEFAULT_PRESENTATION_MID = '2';
const DEFAULT_DATA_MID = '3';
const DATA_CHANNEL_ID = 0;

export function getStreams() {
  return state?.streams;
}

function updateStreams() {
  state?.onUpdate({
    ...state.remoteMediaState,
    '@type': 'updatePhoneCallMediaState',
  });
}

function logP2p(message: string, data: Record<string, unknown> = {}) {
  if (!DEBUG_CALLS) return;

  logDebugMessage('debug', `[PhoneCall][P2P] ${message}`, JSON.stringify(data), data);
}

function logP2pWarning(message: string, data: Record<string, unknown> = {}) {
  logDebugMessage('warn', `[PhoneCall][P2P] ${message}`, JSON.stringify(data), data);
}

function getUserStream(streamType: StreamType, facing: VideoFacingModeEnum = 'user') {
  if (streamType === 'presentation') {
    return (navigator.mediaDevices as any).getDisplayMedia({
      audio: false,
      video: true,
    });
  }

  const audio = streamType === 'audio' ? {
    echoCancellation: IS_ECHO_CANCELLATION_SUPPORTED ? true : undefined,
    noiseSuppression: IS_NOISE_SUPPRESSION_SUPPORTED ? true : undefined,
  } : false;

  const video = streamType === 'video' ? {
    facingMode: facing,
  } : false;

  return navigator.mediaDevices.getUserMedia({ audio, video });
}

function getStreamTrack(stream: MediaStream | undefined) {
  return stream?.getTracks()[0];
}

function hasLiveTrack(stream: MediaStream | undefined) {
  return getStreamTrack(stream)?.readyState === 'live';
}

function getSender(streamType: StreamType) {
  if (!state) return undefined;

  if (streamType === 'audio') return state.senders.audio;
  if (streamType === 'video') return state.senders.video;
  return state.senders.presentation;
}

function getTransceiver(streamType: StreamType) {
  if (!state) return undefined;

  if (streamType === 'audio') return state.transceivers.audio;
  if (streamType === 'video') return state.transceivers.video;
  return state.transceivers.presentation;
}

function setLocalVideoTransceiver(
  streamType: Extract<StreamType, 'video' | 'presentation'>,
  transceiver: RTCRtpTransceiver,
) {
  if (!state) return;

  if (streamType === 'video') {
    state.transceivers.video = transceiver;
    state.senders.video = transceiver.sender;
  } else {
    state.transceivers.presentation = transceiver;
    state.senders.presentation = transceiver.sender;
  }
}

function setOwnStream(streamType: StreamType, stream: MediaStream) {
  if (!state) return;

  if (streamType === 'audio') {
    state.streams.ownAudio = stream;
  } else if (streamType === 'video') {
    state.streams.ownVideo = stream;
  } else {
    state.streams.ownPresentation = stream;
  }
}

function getOwnStream(streamType: StreamType) {
  if (!state) return undefined;

  if (streamType === 'audio') return state.streams.ownAudio;
  if (streamType === 'video') return state.streams.ownVideo;
  return state.streams.ownPresentation;
}

function getFallbackStream(streamType: StreamType) {
  if (!state) return undefined;

  if (streamType === 'audio') return state.silence;
  if (streamType === 'video') return state.blackVideo;
  return state.blackPresentation;
}

export async function switchCameraInputP2p() {
  if (!state || !state.facingMode) {
    return;
  }

  const sender = getSender('video');
  if (!sender) {
    logP2p('switch camera skipped: missing sender');
    return;
  }

  const nextFacingMode = state.facingMode === 'environment' ? 'user' : 'environment';

  let newStream: MediaStream | undefined;
  try {
    newStream = await getUserStream('video', nextFacingMode);
    const newTrack = getStreamTrack(newStream);
    if (!newTrack) {
      stopStream(newStream);
      return;
    }

    const oldStream = state.streams.ownVideo;
    await sender.replaceTrack(newTrack);
    state.facingMode = nextFacingMode;
    state.streams.ownVideo = newStream;
    stopStream(oldStream, state.blackVideo);
    updateStreams();
    sendLocalMediaState();
  } catch {
    stopStream(newStream);
    logP2p('switch camera failed');
    // Ignore camera switch failures; the previous track stays active.
  }
}

export async function toggleStreamP2p(streamType: StreamType, value: boolean | undefined = undefined) {
  if (!state) return;

  const stream = getOwnStream(streamType);
  const track = getStreamTrack(stream);
  const sender = getSender(streamType);

  if (!track || (streamType === 'audio' && !sender)) {
    logP2p('toggle skipped: missing track or sender', {
      streamType,
      track: summarizeTrack(track),
      hasSender: Boolean(sender),
    });
    return;
  }

  const shouldEnable = value === undefined ? !track.enabled : value;

  try {
    let hasChanged = false;
    let shouldRenegotiate = false;
    if (shouldEnable && !track.enabled) {
      const facingMode = streamType === 'video' ? state.facingMode || 'user' : undefined;
      const newStream = await getUserStream(streamType, facingMode);
      const newTrack = getStreamTrack(newStream);
      if (!newTrack) {
        stopStream(newStream);
        return;
      }

      try {
        newTrack.onended = () => {
          void toggleStreamP2p(streamType, false);
        };

        let transceiver = getTransceiver(streamType);
        const shouldCreateVideoTransceiver = streamType !== 'audio'
          && (!sender || !transceiver || transceiver.currentDirection === 'stopped');
        if (shouldCreateVideoTransceiver) {
          transceiver = state.connection.addTransceiver(newTrack, {
            direction: 'sendrecv',
            streams: [newStream],
          });
          setLocalVideoTransceiver(streamType, transceiver);
          shouldRenegotiate = true;
        } else {
          await sender!.replaceTrack(newTrack);
        }
        if (transceiver && streamType !== 'audio') {
          shouldRenegotiate ||= !transceiver.mid || transceiver.currentDirection === 'inactive';
          transceiver.direction = 'sendrecv';
        }
        setOwnStream(streamType, newStream);
      } catch (err) {
        stopStream(newStream);
        throw err;
      }
      hasChanged = true;

      if (streamType === 'video') {
        state.facingMode = facingMode;
        state.isUpdatingExclusiveVideo = true;
        await toggleStreamP2p('presentation', false);
        state.isUpdatingExclusiveVideo = false;
      } else if (streamType === 'presentation') {
        state.isUpdatingExclusiveVideo = true;
        await toggleStreamP2p('video', false);
        state.isUpdatingExclusiveVideo = false;
      }
    } else if (!shouldEnable && track.enabled) {
      const fallback = getFallbackStream(streamType);
      const fallbackTrack = getStreamTrack(fallback);
      if (!fallback || !fallbackTrack) {
        return;
      }

      if (!sender) {
        return;
      }

      try {
        await sender.replaceTrack(fallbackTrack);
      } catch (err) {
        logP2p('toggle failed replacing stream with fallback', {
          error: err instanceof Error ? err.message : String(err),
          streamType,
        });
        return;
      }

      stopStream(stream, fallback);
      setOwnStream(streamType, fallback);
      hasChanged = true;
    }

    if (!hasChanged) {
      return;
    }

    updateStreams();
    sendLocalMediaState();
    shouldRenegotiate = shouldRenegotiate
      && !state.isStarting
      && !state.isUpdatingExclusiveVideo
      && (streamType === 'video' || streamType === 'presentation');
    if (shouldRenegotiate) {
      void sendOffer();
    }
  } catch (err) {
    logP2p('toggle failed', {
      streamType,
      shouldEnable,
      error: err instanceof Error ? {
        name: err.name,
        message: err.message,
      } : String(err),
    });
    // Ignore media device failures; the current sender track stays active.
  }
}

export async function joinPhoneCall(
  connections: ApiPhoneCallConnection[],
  emitSignalingData: (data: P2pMessage) => void,
  isOutgoing: boolean,
  shouldStartVideo: boolean,
  isP2p: boolean,
  onUpdate: (...args: any[]) => void,
) {
  const conn = new RTCPeerConnection({
    iceServers: buildIceServers(connections, isP2p),
    iceTransportPolicy: isP2p ? 'all' : 'relay',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: ICE_CANDIDATE_POOL_SIZE,
  });

  const audioContext = new AudioContext();
  const silentStream = silence(audioContext);
  const blackVideo = black({ width: 640, height: 480 });
  const blackPresentation = black({ width: 640, height: 480 });
  const audioTrack = getStreamTrack(silentStream);

  if (!audioTrack) {
    throw Error('Failed creating phone call placeholder tracks');
  }

  const audioTransceiver = conn.addTransceiver(audioTrack, {
    direction: 'sendrecv',
    streams: [silentStream],
  });

  const dataChannel = isOutgoing ? conn.createDataChannel('data', {
    id: DATA_CHANNEL_ID,
  }) : undefined;

  const audio = new Audio();
  audio.autoplay = true;
  logP2p('join', {
    isOutgoing,
    shouldStartVideo,
    iceTransportPolicy: isP2p ? 'all' : 'relay',
    iceServers: connections.map((connection) => {
      return {
        isTurn: connection.isTurn,
        isStun: connection.isStun,
        port: connection.port,
      };
    }),
  });

  state = {
    audio,
    audioContext,
    connection: conn,
    emitSignalingData,
    isOutgoing,
    isStarting: true,
    handledRemoteExchangeIds: new Set<string>(),
    pendingCandidates: [],
    appliedRemoteExchangeIds: new Set<string>(),
    onUpdate,
    streams: {
      ownVideo: blackVideo,
      ownAudio: silentStream,
      ownPresentation: blackPresentation,
    },
    remoteMediaState: {
      isBatteryLow: false,
      screencastState: 'inactive',
      videoState: 'inactive',
      videoRotation: 0,
      isMuted: true,
    },
    blackVideo,
    blackPresentation,
    silence: silentStream,
    dataChannel,
    transceivers: {
      audio: audioTransceiver,
    },
    senders: {
      audio: audioTransceiver.sender,
    },
    exchangeId: Math.floor(Math.random() * 0xFFFFFFFF),
  };

  conn.onicecandidate = (event) => {
    if (!event.candidate || !state) {
      return;
    }

    const serializedCandidate = event.candidate.toJSON();
    const sdpString = normalizeCandidateComponent(serializedCandidate.candidate);
    if (!sdpString) {
      return;
    }

    state.emitSignalingData({
      '@type': 'Candidates',
      exchangeId: state.pendingLocalExchangeId || state.localCandidateExchangeId,
      ufrag: serializedCandidate.usernameFragment || undefined,
      candidates: [{
        sdpString,
        sdpMid: serializedCandidate.sdpMid || undefined,
        sdpMLineIndex: serializedCandidate.sdpMLineIndex ?? undefined,
        usernameFragment: serializedCandidate.usernameFragment || undefined,
      }],
    });
  };

  conn.onconnectionstatechange = () => {
    logP2p('connection state changed', {
      connectionState: conn.connectionState,
      iceConnectionState: conn.iceConnectionState,
      signalingState: conn.signalingState,
    });
    onUpdate({
      '@type': 'updatePhoneCallConnectionState',
      connectionState: conn.connectionState,
    });
  };

  conn.ontrack = (event) => {
    if (!state) return;

    if (conn.iceConnectionState === 'connected' || conn.iceConnectionState === 'completed') {
      onUpdate({
        '@type': 'updatePhoneCallConnectionState',
        connectionState: 'connected',
      });
    }

    const stream = event.streams[0] || new MediaStream([event.track]);
    if (event.track.kind === 'audio') {
      if (event.transceiver !== state.transceivers.audio) {
        state.transceivers.remoteAudio = event.transceiver;
      }
      state.audio.srcObject = stream;
      state.audio.muted = false;
      state.audio.setAttribute('playsinline', 'true');
      state.audio.play().catch((err) => {
        logP2p('audio playback failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
      event.track.onunmute = () => {
        if (!state) return;

        state.audio.srcObject = stream;
        state.audio.play().catch((err) => {
          logP2p('audio playback after unmute failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      };
      state.streams.audio = stream;
    } else if (
      event.transceiver === state.transceivers.remoteVideo || isRemoteContentTransceiver(event.transceiver, false)
    ) {
      state.transceivers.remoteVideo = event.transceiver;
      state.remoteMediaState.videoState = 'active';
      state.streams.video = stream;
    } else if (
      event.transceiver === state.transceivers.remotePresentation
      || isRemoteContentTransceiver(event.transceiver, true)
    ) {
      state.transceivers.remotePresentation = event.transceiver;
      state.remoteMediaState.screencastState = 'active';
      state.streams.presentation = stream;
    } else {
      logP2p('remote video track ignored: unknown transceiver', {
        track: summarizeTrack(event.track),
        mid: event.transceiver.mid,
      });
    }

    updateStreams();
  };

  conn.oniceconnectionstatechange = () => {
    if (conn.iceConnectionState === 'connected' || conn.iceConnectionState === 'completed') {
      onUpdate({
        '@type': 'updatePhoneCallConnectionState',
        connectionState: 'connected',
      });
    }
    if (!state || !isOutgoing || conn.iceConnectionState !== 'failed') {
      return;
    }

    logP2p('ICE restart requested');
    conn.restartIce();
    void sendOffer();
  };

  conn.ondatachannel = (event) => {
    if (event.channel.label === 'data') {
      attachDataChannel(event.channel);
    }
  };

  if (dataChannel) {
    attachDataChannel(dataChannel);
  }

  await toggleStreamP2p('audio', true);

  if (shouldStartVideo) {
    await toggleStreamP2p('video', true);
  }

  if (state) {
    state.isStarting = false;
  }

  if (isOutgoing) {
    await sendOffer();
  }
}

export function stopPhoneCall() {
  if (!state) return;

  stopStream(state.streams.ownVideo);
  stopStream(state.streams.ownPresentation);
  stopStream(state.streams.ownAudio);
  stopStream(state.blackVideo);
  stopStream(state.blackPresentation);
  stopStream(state.silence);
  state.dataChannel?.close();
  state.connection.close();
  state.audio.srcObject = new MediaStream();
  state.audioContext.close().catch(() => undefined);
  state = undefined;
}

function isRemoteContentTransceiver(transceiver: RTCRtpTransceiver, isPresentation: boolean) {
  if (!state || !transceiver.mid) {
    return false;
  }

  const [, mainVideoContent, presentationContent] = orderMediaContents(state.pendingRemoteNegotiation?.contents || []);
  const content = isPresentation ? presentationContent : mainVideoContent;
  return Boolean(content && state.pendingRemoteContentMids?.[content.ssrc] === transceiver.mid);
}

function buildIceServers(connections: ApiPhoneCallConnection[], isP2p: boolean) {
  const servers: RTCIceServer[] = [];

  connections.forEach((connection) => {
    const urls: string[] = [];
    if (connection.isTurn) {
      urls.push(buildIceServerUrl('turn', connection.ip, connection.port));
      if (connection.ipv6) {
        urls.push(buildIceServerUrl('turn', connection.ipv6, connection.port));
      }
    }
    if (isP2p && connection.isStun) {
      urls.push(buildIceServerUrl('stun', connection.ip, connection.port));
      if (connection.ipv6) {
        urls.push(buildIceServerUrl('stun', connection.ipv6, connection.port));
      }
    }

    if (!urls.length) {
      return;
    }

    servers.push({
      urls,
      username: connection.username,
      credential: connection.password,
    });
  });

  return servers;
}

function buildIceServerUrl(protocol: 'stun' | 'turn', host: string, port: number) {
  const formattedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
  return `${protocol}:${formattedHost}:${port}`;
}

function stopStream(stream?: MediaStream, except?: MediaStream) {
  if (!stream || stream === except) {
    return;
  }

  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

function attachDataChannel(dataChannel: RTCDataChannel) {
  if (!state) return;

  state.dataChannel = dataChannel;
  dataChannel.onopen = () => {
    sendLocalMediaState();
  };
  dataChannel.onclose = () => undefined;
  dataChannel.onerror = () => {
    logP2p('data channel error', {
      id: dataChannel.id,
      readyState: dataChannel.readyState,
    });
  };
  dataChannel.onmessage = (event) => {
    if (typeof event.data !== 'string') {
      logP2p('data channel non-string message', {
        dataType: typeof event.data,
      });
      return;
    }

    let message: P2pMessage;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      logP2p('data channel message parse failed', {
        dataLength: event.data.length,
        dataType: typeof event.data,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    enqueueDataChannelSignalingMessage(message).catch((err) => {
      logP2p('data channel signaling message failed', {
        error: err instanceof Error ? err.message : String(err),
        messageType: message['@type'],
      });
    });
  };
}

function enqueueDataChannelSignalingMessage(message: P2pMessage) {
  dataChannelSignalingMessagePromise = dataChannelSignalingMessagePromise
    .catch(() => undefined)
    .then(() => processSignalingMessage(message));

  return dataChannelSignalingMessagePromise;
}

function sendLocalMediaState() {
  if (!state || state.dataChannel?.readyState !== 'open') return;

  const ownAudioTrack = getStreamTrack(state.streams.ownAudio);
  const ownVideoTrack = getStreamTrack(state.streams.ownVideo);
  const ownPresentationTrack = getStreamTrack(state.streams.ownPresentation);

  const message: MediaStateMessage = {
    '@type': 'MediaState',
    videoRotation: 0,
    muted: !ownAudioTrack?.enabled,
    lowBattery: false,
    videoState: ownVideoTrack?.enabled ? 'active' : 'inactive',
    screencastState: ownPresentationTrack?.enabled ? 'active' : 'inactive',
  };

  state.dataChannel.send(JSON.stringify(message));
}

function getMediaMids(): MediaMids {
  if (!state) {
    return {
      audio: DEFAULT_AUDIO_MID,
      video: DEFAULT_VIDEO_MID,
      presentation: DEFAULT_PRESENTATION_MID,
      data: DEFAULT_DATA_MID,
    };
  }

  const localDescriptionSdp = state.connection.localDescription?.sdp;
  const localDataMid = localDescriptionSdp
    ? parseSdpSections(localDescriptionSdp).find((section) => section.kind === 'application')?.mid
    : undefined;

  return {
    audio: state.transceivers.audio.mid || DEFAULT_AUDIO_MID,
    video: state.transceivers.video?.mid || DEFAULT_VIDEO_MID,
    presentation: state.transceivers.presentation?.mid || DEFAULT_PRESENTATION_MID,
    data: localDataMid || DEFAULT_DATA_MID,
  };
}

function sendLocalDescription(
  description: RTCSessionDescription | RTCSessionDescriptionInit | undefined, exchangeId?: string,
) {
  if (!state || !description?.sdp) return;

  const contents = parseMediaContents(description.sdp, getMediaMids(), getActiveLocalMedia());
  const localExchangeId = exchangeId || String(++state.exchangeId);

  if (description.type === 'offer') {
    state.pendingLocalContentMids = parseMediaContentMids(description.sdp, contents);
  }
  state.localCandidateExchangeId = localExchangeId;
  logP2p('send local negotiation', {
    exchangeId: localExchangeId,
    type: description.type,
    signalingState: state.connection.signalingState,
    contents: summarizeContents(contents),
    contentMids: state.pendingLocalContentMids,
    sdp: summarizeSdp(description.sdp),
    transceivers: summarizeTransceivers(),
  });
  sendLocalSetup(description);
  state.pendingLocalExchangeId = localExchangeId;
  state.emitSignalingData({
    '@type': 'NegotiateChannels',
    exchangeId: localExchangeId,
    contents,
  });
}

function sendLocalMediaOffer() {
  if (!state?.connection.localDescription?.sdp) {
    return;
  }

  const { localDescription } = state.connection;
  const contents = parseMediaContents(localDescription.sdp, getMediaMids(), getActiveLocalMedia());
  if (!contents.length) {
    return;
  }

  const exchangeId = String(++state.exchangeId);
  state.pendingLocalExchangeId = exchangeId;
  state.localCandidateExchangeId = exchangeId;
  state.pendingLocalContentMids = parseMediaContentMids(localDescription.sdp, contents);
  logP2p('send local media negotiation', {
    exchangeId,
    type: localDescription.type,
    contents: summarizeContents(contents),
    contentMids: state.pendingLocalContentMids,
    sdp: summarizeSdp(localDescription.sdp),
    transceivers: summarizeTransceivers(),
  });
  state.emitSignalingData({
    '@type': 'NegotiateChannels',
    exchangeId,
    contents,
  });
}

async function sendOffer() {
  if (!state || state.isMakingOffer || state.connection.signalingState === 'closed') {
    return;
  }

  const { connection } = state;
  state.isMakingOffer = true;
  logP2p('create offer', {
    signalingState: connection.signalingState,
    transceivers: summarizeTransceivers(),
  });

  try {
    const offer = await connection.createOffer();
    if (!state) {
      return;
    }

    const exchangeId = String(++state.exchangeId);
    state.localCandidateExchangeId = exchangeId;
    await connection.setLocalDescription(offer);
    sendLocalDescription(connection.localDescription || undefined, exchangeId);
  } catch {
    logP2p('create offer failed', {
      signalingState: connection.signalingState,
    });
    // Negotiation errors are recovered by the next signaling exchange or hang-up.
  } finally {
    if (state) {
      state.isMakingOffer = false;
    }
  }
}

async function applyRemoteNegotiation() {
  if (!state || !state.remoteSetup || !state.pendingRemoteNegotiation?.contents.length) {
    return;
  }
  if (state.isApplyingRemoteNegotiation) {
    logP2p('remote negotiation already applying', {
      exchangeId: state.pendingRemoteNegotiation.exchangeId,
    });
    return;
  }

  const {
    connection, remoteSetup, pendingLocalExchangeId, pendingRemoteNegotiation,
  } = state;
  const isAnswer = pendingRemoteNegotiation.exchangeId === pendingLocalExchangeId;
  if (isAnswer && connection.signalingState !== 'have-local-offer') {
    logP2p('apply logical remote answer', {
      exchangeId: pendingRemoteNegotiation.exchangeId,
      signalingState: connection.signalingState,
      contents: summarizeContents(pendingRemoteNegotiation.contents),
    });
    state.pendingLocalExchangeId = undefined;
    state.pendingLocalContentMids = undefined;
    state.handledRemoteExchangeIds.add(pendingRemoteNegotiation.exchangeId);
    state.pendingRemoteNegotiation = undefined;
    return;
  }
  if (!isAnswer) {
    prepareTransceiversForRemoteOffer(pendingRemoteNegotiation.contents);
    state.pendingRemoteContentMids = buildRemoteContentMids(pendingRemoteNegotiation.contents);
  }
  const sdp = buildRemoteSdp(remoteSetup, pendingRemoteNegotiation.contents, isAnswer);
  logP2p('apply remote negotiation', {
    exchangeId: pendingRemoteNegotiation.exchangeId,
    type: isAnswer ? 'answer' : 'offer',
    signalingState: connection.signalingState,
    contents: summarizeContents(pendingRemoteNegotiation.contents),
    sdp: summarizeSdp(sdp),
    transceivers: summarizeTransceivers(),
  });

  state.isApplyingRemoteNegotiation = true;
  try {
    if (!isAnswer && connection.signalingState === 'have-local-offer' && !state.isOutgoing) {
      logP2p('rollback local offer for remote offer glare', {
        exchangeId: pendingRemoteNegotiation.exchangeId,
      });
      await connection.setLocalDescription({ type: 'rollback' });
      state.pendingLocalExchangeId = undefined;
    }

    if (isAnswer && connection.signalingState !== 'have-local-offer') {
      logP2p('ignore remote answer in wrong signaling state', {
        exchangeId: pendingRemoteNegotiation.exchangeId,
        signalingState: connection.signalingState,
      });
      return;
    }
    if (!isAnswer && connection.signalingState !== 'stable') {
      logP2p('ignore remote offer in wrong signaling state', {
        exchangeId: pendingRemoteNegotiation.exchangeId,
        signalingState: connection.signalingState,
      });
      return;
    }

    if (!isAnswer) {
      logP2p('prepared transceivers for remote offer', {
        exchangeId: pendingRemoteNegotiation.exchangeId,
        transceivers: summarizeTransceivers(),
      });
    }

    if (isAnswer) {
      validateRemoteAnswerSdp(connection.localDescription?.sdp, sdp);
    }

    await connection.setRemoteDescription({ type: isAnswer ? 'answer' : 'offer', sdp });
    state.appliedRemoteExchangeId = pendingRemoteNegotiation.exchangeId;
    state.appliedRemoteExchangeIds.add(pendingRemoteNegotiation.exchangeId);
    state.appliedRemoteUfrag = remoteSetup.ufrag;
    logP2p('remote description applied', {
      exchangeId: pendingRemoteNegotiation.exchangeId,
      type: isAnswer ? 'answer' : 'offer',
      ufrag: remoteSetup.ufrag,
      signalingState: connection.signalingState,
      transceivers: summarizeTransceivers(),
    });
    if (!isAnswer) {
      updateRemoteMediaStateFromOffer(pendingRemoteNegotiation.contents);
      await bindLocalAudioToSharedRemoteOffer();
    }
    await commitPendingIceCandidates();

    if (isAnswer) {
      state.pendingLocalExchangeId = undefined;
      state.pendingLocalContentMids = undefined;
    } else {
      const answer = await connection.createAnswer();
      if (!state) {
        return;
      }

      state.localCandidateExchangeId = pendingRemoteNegotiation.exchangeId;
      await connection.setLocalDescription(answer);

      const localDescription = connection.localDescription || undefined;
      const contents = localDescription?.sdp
        ? parseAnswerContents(localDescription.sdp, pendingRemoteNegotiation.contents, getMediaMids()) : [];

      updateRemoteMediaStateFromOffer(contents);
      logP2p('send local answer negotiation', {
        exchangeId: pendingRemoteNegotiation.exchangeId,
        contents: summarizeContents(contents),
        sdp: localDescription?.sdp ? summarizeSdp(localDescription.sdp) : undefined,
        transceivers: summarizeTransceivers(),
      });
      sendLocalSetup(localDescription);
      state.emitSignalingData({
        '@type': 'NegotiateChannels',
        exchangeId: pendingRemoteNegotiation.exchangeId,
        contents,
      });

      if (shouldSendLocalOfferAfterRemoteAnswer()) {
        logP2p('send local media offer after remote answer', {
          exchangeId: pendingRemoteNegotiation.exchangeId,
          transceivers: summarizeTransceivers(),
        });
        sendLocalMediaOffer();
      }
    }

    state.handledRemoteExchangeIds.add(pendingRemoteNegotiation.exchangeId);
  } finally {
    if (state) {
      if (state.pendingRemoteNegotiation?.exchangeId === pendingRemoteNegotiation.exchangeId) {
        state.pendingRemoteNegotiation = undefined;
        state.pendingRemoteContentMids = undefined;
      }
      state.isApplyingRemoteNegotiation = false;
      if (!state.pendingLocalExchangeId && !state.pendingRemoteNegotiation && state.queuedRemoteNegotiation) {
        state.pendingRemoteNegotiation = state.queuedRemoteNegotiation;
        state.queuedRemoteNegotiation = undefined;
      }
      if (state.pendingRemoteNegotiation) {
        void applyRemoteNegotiation();
      }
    }
  }
}

function sendLocalSetup(description: RTCSessionDescription | RTCSessionDescriptionInit | undefined) {
  if (!state || !description?.sdp) return;

  const setup = parseInitialSetup(description.sdp);
  const setupKey = JSON.stringify(setup);
  if (state.lastLocalSetupKey === setupKey) {
    return;
  }

  state.lastLocalSetupKey = setupKey;
  logP2p('send initial setup', {
    setup: {
      ufrag: setup.ufrag,
      fingerprintCount: setup.fingerprints.length,
      renomination: setup.renomination,
    },
  });
  state.emitSignalingData(setup);
}

function getActiveLocalMedia(): ActiveLocalMedia {
  return {
    hasVideo: Boolean(getStreamTrack(state?.streams.ownVideo)?.enabled),
    hasPresentation: Boolean(getStreamTrack(state?.streams.ownPresentation)?.enabled),
  };
}

function prepareTransceiversForRemoteOffer(contents: MediaContent[]) {
  if (!state) {
    return;
  }

  const hasRemoteAudio = contents.some((content) => content.type === 'audio');
  const hasRemoteVideo = contents.filter((content) => content.type === 'video').length;
  const shouldUseSharedAudioSection = hasRemoteAudio && !state.transceivers.audio.mid;
  if (shouldUseSharedAudioSection) {
    state.transceivers.audio.direction = 'sendrecv';
  } else if (hasRemoteAudio && !setRemoteTransceiverDirection('remoteAudio', 'audio', 'recvonly')) {
    state.transceivers.remoteAudio = state.connection.addTransceiver('audio', { direction: 'recvonly' });
  }
  if (hasRemoteVideo >= 1 && !setRemoteTransceiverDirection('remoteVideo', 'video', 'recvonly')) {
    state.transceivers.remoteVideo = state.connection.addTransceiver('video', { direction: 'recvonly' });
  }
  if (hasRemoteVideo >= 2 && !setRemoteTransceiverDirection('remotePresentation', 'video', 'recvonly')) {
    state.transceivers.remotePresentation = state.connection.addTransceiver('video', { direction: 'recvonly' });
  }
  if (!hasRemoteAudio || shouldUseSharedAudioSection) {
    setRemoteTransceiverDirection('remoteAudio', 'audio', 'inactive');
  }
  if (hasRemoteVideo < 1) {
    setRemoteTransceiverDirection('remoteVideo', 'video', 'inactive');
  }
  if (hasRemoteVideo < 2) {
    setRemoteTransceiverDirection('remotePresentation', 'video', 'inactive');
  }
}

function setRemoteTransceiverDirection(
  name: 'remoteAudio' | 'remoteVideo' | 'remotePresentation',
  kind: 'audio' | 'video',
  direction: RTCRtpTransceiverDirection,
) {
  if (!state?.transceivers[name]) {
    return false;
  }

  try {
    const transceiver = state.transceivers[name];
    if (transceiver.receiver.track.kind !== kind) {
      return false;
    }

    transceiver.direction = direction;
    return true;
  } catch {
    return false;
  }
}

function buildRemoteContentMids(contents: MediaContent[]) {
  if (!state) {
    return {};
  }

  const [audioContent, mainVideoContent, presentationContent] = orderMediaContents(contents);
  const result: Record<string, string> = {};
  if (audioContent) {
    result[audioContent.ssrc] = state.transceivers.audio.mid
      ? (state.transceivers.remoteAudio?.mid || audioContent.ssrc) : getMediaMids().audio;
  }
  if (mainVideoContent) {
    result[mainVideoContent.ssrc] = state.transceivers.remoteVideo?.mid || mainVideoContent.ssrc;
  }
  if (presentationContent) {
    result[presentationContent.ssrc] = state.transceivers.remotePresentation?.mid || presentationContent.ssrc;
  }

  return result;
}

function updateRemoteMediaStateFromOffer(contents: MediaContent[]) {
  if (!state) {
    return;
  }

  const remoteVideoCount = contents.filter((content) => content.type === 'video').length;
  state.remoteMediaState.videoState = remoteVideoCount >= 1 ? 'active' : 'inactive';
  state.remoteMediaState.screencastState = remoteVideoCount >= 2 ? 'active' : 'inactive';
  updateStreams();
}

function shouldSendLocalOfferAfterRemoteAnswer() {
  if (!state || state.isOutgoing || state.pendingLocalExchangeId) {
    return false;
  }

  return Boolean(getStreamTrack(state.streams.ownAudio)?.enabled
    || getStreamTrack(state.streams.ownVideo)?.enabled
    || getStreamTrack(state.streams.ownPresentation)?.enabled);
}

async function bindLocalAudioToSharedRemoteOffer() {
  if (!state || state.transceivers.audio.mid) {
    return;
  }

  const audioTrack = state.senders.audio.track;
  if (!audioTrack?.enabled) {
    return;
  }

  const audioMid = getMediaMids().audio;
  const transceiver = state.connection.getTransceivers().find((item) => {
    return item.mid === audioMid && item.receiver.track.kind === 'audio';
  });
  if (!transceiver || transceiver === state.transceivers.audio) {
    return;
  }

  await transceiver.sender.replaceTrack(audioTrack);
  transceiver.direction = 'sendrecv';
  state.transceivers.audio = transceiver;
  state.senders.audio = transceiver.sender;
  state.transceivers.remoteAudio = undefined;
  logP2p('bound local audio to shared remote offer transceiver', {
    mid: transceiver.mid,
    track: summarizeTrack(audioTrack),
    transceivers: summarizeTransceivers(),
  });
}

function buildRemoteSdp(
  setup: Extract<P2pMessage, { '@type': 'InitialSetup' }>,
  contents: MediaContent[],
  isAnswer: boolean,
) {
  const mids = getMediaMids();
  const orderedContents = orderMediaContents(contents);
  const [audioContent, mainVideoContent, presentationContent] = orderedContents;
  const videoPayloadSource = mainVideoContent || presentationContent;
  const localMediaParameters = getLocalMediaParameters(mids);
  const remoteContentMids = state?.pendingRemoteContentMids || {};
  const shouldUseSharedAudioSection = !isAnswer && Boolean(audioContent) && !state?.transceivers.audio.mid;
  const remoteAudioMid = shouldUseSharedAudioSection || isAnswer
    ? mids.audio : (audioContent ? remoteContentMids[audioContent.ssrc] : mids.audio);
  const remoteVideoMid = isAnswer
    ? mids.video : (mainVideoContent ? remoteContentMids[mainVideoContent.ssrc] : mids.video);
  const remotePresentationMid = isAnswer
    ? mids.presentation : (presentationContent ? remoteContentMids[presentationContent.ssrc] : mids.presentation);
  const localOfferSdp = state?.connection.localDescription?.type === 'offer'
    ? state.connection.localDescription.sdp : undefined;
  const sharedAudioDirection: RTCRtpTransceiverDirection | undefined = shouldUseSharedAudioSection
    ? 'sendrecv' : undefined;
  const entries: SsrcEntry[] = isAnswer
    ? buildAnswerSsrcs(contents, mids)
    : [
      {
        ...buildSsrc(audioContent, remoteAudioMid, false),
        direction: sharedAudioDirection,
      },
      buildSsrc(mainVideoContent, remoteVideoMid, true),
      buildSsrc(presentationContent, remotePresentationMid, true, true),
    ];
  if (!isAnswer && shouldAddLocalAudioOfferSection(entries, mids)) {
    entries.push({
      ...buildSsrc(undefined, mids.audio, false),
      isLocalOnly: true,
      isRemoved: false,
    });
  }

  return buildP2pSdp({
    setup,
    mids,
    isAnswer,
    entries,
    audioPayloadTypes: audioContent?.payloadTypes?.map(p2pPayloadTypeToConference)
      || localMediaParameters.audioPayloadTypes,
    audioExtensions: audioContent?.rtpExtensions || localMediaParameters.audioExtensions,
    videoPayloadTypes: filterRemoteVideoPayloadTypes(videoPayloadSource)?.map(p2pPayloadTypeToConference)
      || localMediaParameters.videoPayloadTypes,
    videoExtensions: videoPayloadSource?.rtpExtensions || localMediaParameters.videoExtensions,
    sectionOrder: isAnswer ? getLocalOfferSections() : getEstablishedSections(),
    bundleMids: isAnswer && localOfferSdp ? parseBundleMids(localOfferSdp) : undefined,
  });
}

function getLocalOfferSections() {
  if (!state?.connection.localDescription?.sdp || state.connection.localDescription.type !== 'offer') {
    return undefined;
  }

  return parseSdpSections(state.connection.localDescription.sdp).filter((section) => section.kind !== 'session');
}

function getEstablishedSections() {
  const sdp = state?.connection.remoteDescription?.sdp || state?.connection.localDescription?.sdp;
  if (!sdp) {
    return undefined;
  }

  return parseSdpSections(sdp).filter((section) => section.kind !== 'session');
}

function validateRemoteAnswerSdp(offerSdp: string | undefined, answerSdp: string) {
  if (!offerSdp) {
    return;
  }

  const offerBundleMids = new Set(parseBundleMids(offerSdp) || []);
  const answerBundleMids = new Set(parseBundleMids(answerSdp) || []);
  const offerSections = parseSdpSections(offerSdp).filter((section) => section.kind !== 'session');
  const answerSections = parseSdpSections(answerSdp).filter((section) => section.kind !== 'session');
  const mLines = offerSections.map((offerSection, index) => {
    const answerSection = answerSections[index];
    return {
      index,
      offer: summarizeValidationMLine(offerSection, offerBundleMids),
      answer: answerSection ? summarizeValidationMLine(answerSection, answerBundleMids) : undefined,
    };
  });
  const issues = mLines.flatMap(({ answer, index, offer }) => {
    if (!answer) {
      return [`m-line ${index} is missing in answer`];
    }

    const result: string[] = [];
    if (answer.mid !== offer.mid) {
      result.push(`m-line ${index} mid mismatch`);
    }
    if (answer.port !== 0 && !answer.isBundled) {
      result.push(`m-line ${index} is active but not bundled`);
    }
    if (offer.port === 0 && !offer.hasBundleOnly && answer.port !== 0) {
      result.push(`m-line ${index} answer activates rejected offer section`);
    }
    if (answer.port !== 0 && answer.hasBundleOnly) {
      result.push(`m-line ${index} active answer m-line has bundle-only`);
    }
    if (answer.port !== 0 && (answer.kind === 'audio' || answer.kind === 'video') && !answer.hasRtcpMux) {
      result.push(`m-line ${index} is active RTP without rtcp-mux`);
    }
    if (answer.port !== 0 && answer.kind === 'video' && answer.direction !== 'recvonly'
      && answer.direction !== 'sendrecv') {
      result.push(`m-line ${index} active video direction is ${answer.direction || 'missing'}`);
    }
    if (answer.port !== 0 && offer.port !== 0 && !offer.isBundled) {
      result.push(`m-line ${index} answers an unbundled offer section`);
    }

    return result;
  });
  const data = {
    mLines,
    issues,
  };

  if (issues.length) {
    logP2pWarning('remote answer SDP validation failed', data);
  } else {
    logP2p('remote answer SDP validation passed', data);
  }
}

function summarizeValidationMLine(section: SdpSection, bundleMids: Set<string>) {
  return {
    kind: section.kind,
    mid: section.mid,
    port: getSdpPort(section),
    direction: getSdpDirection(section),
    hasRtcpMux: section.lines.includes('a=rtcp-mux'),
    hasBundleOnly: section.lines.includes('a=bundle-only'),
    isBundled: Boolean(section.mid && bundleMids.has(section.mid)),
  };
}

function getAnswerSetupRole(mid: string | undefined, fallback: string) {
  const offerSetup = getLocalOfferSections()?.find((section) => section.mid === mid)
    ?.lines.find((line) => line.startsWith('a=setup:'))
    ?.slice('a=setup:'.length);

  if (offerSetup === 'active') {
    return 'passive';
  }
  if (offerSetup === 'passive') {
    return 'active';
  }
  if (fallback === 'active' || fallback === 'passive') {
    return fallback;
  }

  return 'passive';
}

function getLocalMediaParameters(mids: MediaMids): LocalMediaParameters {
  const sections = state?.connection.localDescription?.sdp
    ? parseSdpSections(state.connection.localDescription.sdp) : [];
  const audioSection = sections.find((section) => section.mid === mids.audio);
  const videoSection = sections.find((section) => section.mid === mids.video)
    || sections.find((section) => section.mid === mids.presentation);

  return {
    audioPayloadTypes: audioSection?.kind === 'audio'
      ? parsePayloadTypes(audioSection).map(p2pPayloadTypeToConference) : getDefaultAudioPayloadTypes(),
    audioExtensions: audioSection?.kind === 'audio' ? parseExtmaps(audioSection) : [],
    videoPayloadTypes: videoSection?.kind === 'video'
      ? parsePayloadTypes(videoSection).map(p2pPayloadTypeToConference) : getDefaultVideoPayloadTypes(),
    videoExtensions: videoSection?.kind === 'video' ? parseExtmaps(videoSection) : [],
  };
}

function getDefaultAudioPayloadTypes(): Conference['audioPayloadTypes'] {
  return [{
    id: 111,
    name: 'opus',
    clockrate: 48000,
    channels: 2,
    parameters: {
      minptime: 10,
      useinbandfec: 1,
    },
  }];
}

function getDefaultVideoPayloadTypes(): Conference['videoPayloadTypes'] {
  return [{
    id: 96,
    name: 'VP8',
    clockrate: 90000,
    channels: 0,
  }];
}

function orderMediaContents(contents: MediaContent[]) {
  const audioContent = contents.find((content) => content.type === 'audio');
  const videoContents = contents.filter((content) => content.type === 'video');
  return [audioContent, videoContents[0], videoContents[1]];
}

function shouldAddLocalAudioOfferSection(entries: SsrcEntry[], mids: MediaMids) {
  const audioTrack = state?.transceivers.audio.sender.track;
  const sections = getEstablishedSections() || [];
  return Boolean(audioTrack?.enabled)
    && !entries.some((entry) => entry.mid === mids.audio && !entry.isRemoved)
    && !sections.some((section) => section.mid === mids.audio);
}

function filterRemoteVideoPayloadTypes(content: MediaContent | undefined) {
  const payloadTypes = content?.payloadTypes;
  if (!payloadTypes?.length) {
    return undefined;
  }

  const supportedCodecs = RTCRtpReceiver.getCapabilities('video')?.codecs || [];
  const supportedNames = new Set(supportedCodecs.map((codec) => {
    return codec.mimeType.split('/')[1]?.toUpperCase();
  }).filter(Boolean));
  const preferredCodec = payloadTypes.find((payloadType) => {
    return payloadType.name.toUpperCase() === 'VP8' && supportedNames.has('VP8');
  }) || payloadTypes.find((payloadType) => {
    return payloadType.name.toUpperCase() !== 'RTX' && supportedNames.has(payloadType.name.toUpperCase());
  });

  if (!preferredCodec) {
    return undefined;
  }

  const result = [preferredCodec];
  const rtxPayload = payloadTypes.find((payloadType) => {
    return payloadType.name.toUpperCase() === 'RTX' && Number(payloadType.parameters?.apt) === preferredCodec.id;
  });
  if (rtxPayload) {
    result.push(rtxPayload);
  }

  return result;
}

function buildAnswerSsrcs(contents: MediaContent[], mids: MediaMids): SsrcEntry[] {
  let videoIndex = 0;

  return contents.map((content) => {
    const mid = state?.pendingLocalContentMids?.[content.ssrc]
      || (content.type === 'audio' ? mids.audio : (videoIndex++ ? mids.presentation : mids.video));
    return buildSsrc(content, mid, content.type === 'video', mid === mids.presentation);
  });
}

function buildSsrc(
  content: MediaContent | undefined,
  mid: string,
  isVideo: boolean,
  isPresentation = false,
): SsrcEntry {
  if (!content) {
    return {
      isVideo,
      isPresentation,
      isMain: false,
      isRemoved: true,
      userId: '0',
      endpoint: mid,
      mid,
      sourceGroups: [],
    };
  }

  const ssrcGroups = content.ssrcGroups || [];
  const sourceGroups: SsrcGroup[] = ssrcGroups.length ? ssrcGroups.map((group) => {
    return {
      semantics: group.semantics,
      sources: group.ssrcs,
    };
  }) : [{
    sources: [Number(content.ssrc)],
  }];

  return {
    isVideo,
    isPresentation,
    isMain: false,
    userId: '0',
    endpoint: mid,
    mid,
    sourceGroups,
  };
}

function hasBundleOnly(section: SdpSection) {
  return section.lines.includes('a=bundle-only');
}

function isRejectedOfferSection(section: SdpSection) {
  return getSdpPort(section) === 0 && !hasBundleOnly(section);
}

function isOfferedInBundle(section: SdpSection, bundleMids: string[] | undefined) {
  return Boolean(section.mid && (!bundleMids || bundleMids.includes(section.mid)));
}

function canAcceptOfferedBundledSection(section: SdpSection, bundleMids: string[] | undefined) {
  return isOfferedInBundle(section, bundleMids) && !isRejectedOfferSection(section);
}

function buildP2pSdp({
  setup,
  mids,
  isAnswer,
  entries,
  audioPayloadTypes,
  audioExtensions,
  videoPayloadTypes,
  videoExtensions,
  sectionOrder,
  bundleMids,
}: {
  setup: Extract<P2pMessage, { '@type': 'InitialSetup' }>;
  mids: MediaMids;
  isAnswer: boolean;
  entries: SsrcEntry[];
  audioPayloadTypes: Conference['audioPayloadTypes'];
  audioExtensions: Conference['audioExtensions'];
  videoPayloadTypes: Conference['videoPayloadTypes'];
  videoExtensions: Conference['videoExtensions'];
  sectionOrder?: SdpSection[];
  bundleMids?: string[];
}) {
  const lines: string[] = [];
  const add = (line: string) => {
    lines.push(line);
  };
  const addTransport = (mid?: string) => {
    add(`a=ice-ufrag:${setup.ufrag}`);
    add(`a=ice-pwd:${setup.pwd}`);
    setup.fingerprints.forEach((fingerprint) => {
      add(`a=fingerprint:${fingerprint.hash} ${fingerprint.fingerprint}`);
      const setupRole = isAnswer ? getAnswerSetupRole(mid, fingerprint.setup) : fingerprint.setup;
      add(`a=setup:${setupRole}`);
    });
  };
  const addPayloadType = (payloadType: Conference['audioPayloadTypes'][number]) => {
    const channels = payloadType.channels ? `/${payloadType.channels}` : '';
    add(`a=rtpmap:${payloadType.id} ${payloadType.name}/${payloadType.clockrate}${channels}`);
    if (payloadType.parameters) {
      const parameters = Object.keys(payloadType.parameters).map((key) => {
        return `${key}=${payloadType.parameters![key]}`;
      }).join(';');
      add(`a=fmtp:${payloadType.id} ${parameters}`);
    }
    payloadType['rtcp-fbs']?.forEach((feedback) => {
      add(`a=rtcp-fb:${payloadType.id} ${feedback.type}${feedback.subtype ? ` ${feedback.subtype}` : ''}`);
    });
  };
  const addMedia = (
    entry: SsrcEntry,
    payloadTypes: Conference['audioPayloadTypes'],
    extensions: Conference['audioExtensions'],
    mediaType?: string,
    shouldRejectRemoved = true,
    direction?: RTCRtpTransceiverDirection,
  ) => {
    mediaType = mediaType || (entry.isVideo ? 'video' : 'audio');
    const port = entry.isRemoved && shouldRejectRemoved ? 0 : 9;
    add(`m=${mediaType} ${port} UDP/TLS/RTP/SAVPF ${payloadTypes.map((payloadType) => payloadType.id).join(' ')}`);
    add('c=IN IP4 0.0.0.0');
    add(`a=mid:${entry.mid}`);
    if (port === 0) {
      add('a=inactive');
      return;
    }

    add('b=AS:1300');
    add('a=rtcp-mux');
    payloadTypes.forEach(addPayloadType);
    add('a=rtcp:1 IN IP4 0.0.0.0');
    if (entry.isVideo) {
      add('a=rtcp-rsize');
    }
    extensions.forEach(({ id, uri }) => {
      add(`a=extmap:${id} ${uri}`);
    });
    addTransport(entry.mid);
    if (entry.isRemoved) {
      add('a=inactive');
      return;
    }
    add(`a=${direction || entry.direction || (isAnswer ? 'recvonly' : 'sendonly')}`);
    if (isAnswer || direction === 'recvonly') {
      return;
    }

    entry.sourceGroups.forEach((sourceGroup) => {
      if (sourceGroup.semantics) {
        add(`a=ssrc-group:${sourceGroup.semantics} ${sourceGroup.sources.join(' ')}`);
      }
      sourceGroup.sources.forEach((ssrc) => {
        add(`a=ssrc:${ssrc} cname:${entry.endpoint}`);
        add(`a=ssrc:${ssrc} msid:${entry.endpoint} ${entry.endpoint}`);
        add(`a=ssrc:${ssrc} mslabel:${entry.endpoint}`);
        add(`a=ssrc:${ssrc} label:${entry.endpoint}`);
      });
    });
  };
  const addApplication = (mid: string, shouldReject = false) => {
    add(`m=application ${shouldReject ? 0 : 1} UDP/DTLS/SCTP webrtc-datachannel`);
    add('c=IN IP4 0.0.0.0');
    add(`a=mid:${mid}`);

    if (shouldReject) {
      add('a=inactive');
      return;
    }

    addTransport(mid);
    add('a=ice-options:trickle');
    add('a=sctp-port:5000');
    add('a=max-message-size:262144');
  };
  const getOrderedMedia = (section: SdpSection) => {
    const entry = entries.find((item) => item.mid === section.mid) || buildSsrc(
      undefined,
      section.mid || '',
      section.kind === 'video',
    );
    const shouldKeepLocalSection = !isAnswer && entry.isRemoved && shouldKeepEstablishedLocalSection(section);
    const shouldKeepRemoteSection = isAnswer && entry.isRemoved && shouldKeepRemoteReceiveSection(section);
    const keptMediaEntry = shouldKeepLocalSection || shouldKeepRemoteSection ? { ...entry, isRemoved: false } : entry;
    const shouldRejectOfferSection = isAnswer && !canAcceptOfferedBundledSection(section, bundleMids);
    const mediaEntry = shouldRejectOfferSection ? { ...keptMediaEntry, isRemoved: true } : keptMediaEntry;
    const shouldRejectRemoved = isAnswer && (mediaEntry.isRemoved || shouldRejectOfferSection);
    const payloadTypes = section.kind === 'audio' ? audioPayloadTypes : videoPayloadTypes;
    const extensions = section.kind === 'audio' ? audioExtensions : videoExtensions;
    const direction: RTCRtpTransceiverDirection | undefined = shouldKeepRemoteSection ? 'sendonly'
      : (mediaEntry.isLocalOnly || shouldKeepLocalSection ? 'recvonly' : undefined);

    return {
      direction,
      extensions,
      mediaEntry,
      payloadTypes,
      shouldRejectRemoved,
    };
  };
  const getBundledOrderedMid = (section: SdpSection) => {
    const mid = section.mid || (section.kind === 'application' ? mids.data : undefined);
    if (!mid) {
      return undefined;
    }

    if (section.kind === 'application') {
      if (!isAnswer) {
        return mid;
      }

      return canAcceptOfferedBundledSection(section, bundleMids) ? mid : undefined;
    }

    const { mediaEntry, shouldRejectRemoved } = getOrderedMedia(section);
    return mediaEntry.isRemoved && shouldRejectRemoved ? undefined : mediaEntry.mid;
  };
  const addOrderedSection = (section: SdpSection) => {
    if (section.kind === 'application') {
      const mid = section.mid || mids.data;
      const shouldRejectApplication = isAnswer && !canAcceptOfferedBundledSection(section, bundleMids);
      addApplication(mid, shouldRejectApplication);
      return;
    }

    const {
      direction, extensions, mediaEntry, payloadTypes, shouldRejectRemoved,
    } = getOrderedMedia(section);
    addMedia(mediaEntry, payloadTypes, extensions, section.kind, shouldRejectRemoved, direction);
  };
  const rawBundledMids = (sectionOrder?.map(getBundledOrderedMid).filter(Boolean) || [
    ...entries.filter((entry) => !entry.isRemoved).map((entry) => entry.mid),
    mids.data,
  ]).concat(isAnswer ? [] : entries.filter((entry) => {
    return !entry.isRemoved && !sectionOrder?.some((section) => section.mid === entry.mid);
  }).map((entry) => entry.mid));
  const seenBundledMids = new Set<string>();
  const bundledMids = rawBundledMids.filter((mid) => {
    if (seenBundledMids.has(mid)) return false;

    seenBundledMids.add(mid);
    return true;
  });
  logP2p('generated P2P SDP bundle mids', {
    isAnswer,
    bundledMids,
  });

  add('v=0');
  add(`o=- ${Date.now()} 2 IN IP4 0.0.0.0`);
  add('s=-');
  add('t=0 0');
  add('a=ice-options:trickle');
  add('a=msid-semantic:WMS *');
  add(`a=group:BUNDLE ${bundledMids.join(' ')}`);

  if (sectionOrder?.length) {
    sectionOrder.forEach(addOrderedSection);
    entries.filter((entry) => {
      return !sectionOrder.some((section) => section.mid === entry.mid);
    }).forEach((entry) => {
      const payloadTypes = entry.isVideo ? videoPayloadTypes : audioPayloadTypes;
      const extensions = entry.isVideo ? videoExtensions : audioExtensions;
      addMedia(entry, payloadTypes, extensions, undefined, true, entry.isLocalOnly ? 'recvonly' : undefined);
    });
  } else {
    entries.forEach((entry) => {
      const payloadTypes = entry.isVideo ? videoPayloadTypes : audioPayloadTypes;
      const extensions = entry.isVideo ? videoExtensions : audioExtensions;
      addMedia(entry, payloadTypes, extensions, undefined, true, entry.isLocalOnly ? 'recvonly' : undefined);
    });
    addApplication(mids.data);
  }

  return `${lines.join('\r\n')}\r\n`;
}

function parseInitialSetup(sdp: string): Extract<P2pMessage, { '@type': 'InitialSetup' }> {
  const sections = parseSdpSections(sdp);
  const ufrag = findLineValue(sections, 'a=ice-ufrag:');
  const pwd = findLineValue(sections, 'a=ice-pwd:');
  const fingerprints = parseFingerprints(sections);
  const iceOptions = findLineValue(sections, 'a=ice-options:');

  if (!ufrag || !pwd || !fingerprints.length) {
    throw Error('Failed parsing SDP transport setup');
  }

  return {
    '@type': 'InitialSetup',
    ufrag,
    pwd,
    renomination: Boolean(iceOptions?.split(' ').includes('renomination')),
    fingerprints,
  };
}

function parseMediaContents(sdp: string, mids: MediaMids, activeMedia?: ActiveLocalMedia): MediaContent[] {
  const sections = parseSdpSections(sdp);
  const contents: MediaContent[] = [];
  const audioSection = sections.find((section) => section.mid === mids.audio);
  const videoSection = sections.find((section) => section.mid === mids.video);
  const presentationSection = sections.find((section) => section.mid === mids.presentation);

  if (audioSection) {
    contents.push(parseMediaContent(audioSection, 'audio'));
  }
  if (videoSection && activeMedia?.hasVideo !== false) {
    contents.push(parseMediaContent(videoSection, 'video'));
  }
  if (presentationSection && activeMedia?.hasPresentation !== false) {
    contents.push(parseMediaContent(presentationSection, 'video'));
  }

  return contents;
}

function parseMediaContentMids(sdp: string, contents: MediaContent[]) {
  const sections = parseSdpSections(sdp);
  const midsBySsrc: Record<string, string> = {};

  contents.forEach((content) => {
    const section = sections.find((item) => {
      return item.mid && parseSsrcs(item).includes(Number(content.ssrc));
    });
    if (section?.mid) {
      midsBySsrc[content.ssrc] = section.mid;
    }
  });

  return midsBySsrc;
}

function parseAnswerContents(sdp: string, offeredContents: MediaContent[], mids: MediaMids) {
  const sections = parseSdpSections(sdp);
  const audioSection = sections.find((section) => section.mid === mids.audio);
  const videoSections = [
    sections.find((section) => section.mid === mids.video),
    sections.find((section) => section.mid === mids.presentation),
  ].filter(Boolean);
  let videoIndex = 0;

  return offeredContents.map((content) => {
    const remoteMid = state?.pendingRemoteContentMids?.[content.ssrc];
    const section = remoteMid ? sections.find((item) => item.mid === remoteMid)
      : (content.type === 'audio' ? audioSection : videoSections[videoIndex++]);
    if (!section || getSdpPort(section) === 0) {
      return undefined;
    }

    const direction = getSdpDirection(section);
    if (direction !== 'recvonly' && direction !== 'sendrecv') {
      return undefined;
    }

    const acceptedContent = parseMediaContent(section, content.type, content);
    if (!acceptedContent.payloadTypes?.length) {
      return undefined;
    }

    return acceptedContent;
  }).filter(Boolean);
}

function shouldKeepEstablishedLocalSection(section: SdpSection) {
  if (section.kind !== 'audio' && section.kind !== 'video') {
    return false;
  }

  const direction = getSdpDirection(section);
  return getSdpPort(section) !== 0 && (direction === 'recvonly' || direction === 'sendrecv');
}

function shouldKeepRemoteReceiveSection(section: SdpSection) {
  if (!state || getSdpDirection(section) !== 'recvonly') {
    return false;
  }

  const mid = section.mid;
  if (section.kind === 'audio') {
    return mid === state.transceivers.remoteAudio?.mid && hasLiveTrack(state.streams.audio);
  }

  if (section.kind === 'video') {
    return (mid === state.transceivers.remoteVideo?.mid && hasLiveTrack(state.streams.video))
      || (mid === state.transceivers.remotePresentation?.mid && hasLiveTrack(state.streams.presentation));
  }

  return false;
}

function parseMediaContent(
  section: SdpSection,
  type: MediaContent['type'],
  fallbackContent?: MediaContent,
): MediaContent {
  const ssrcGroups = parseSsrcGroups(section);
  const ssrc = ssrcGroups[0]?.ssrcs[0] || parseSsrcs(section)[0] || Number(fallbackContent?.ssrc);

  if (!ssrc) {
    throw Error('Failed parsing SDP media SSRC');
  }

  return {
    type,
    ssrc: fallbackContent?.ssrc || String(ssrc),
    ssrcGroups: fallbackContent ? fallbackContent.ssrcGroups || [] : ssrcGroups,
    payloadTypes: parsePayloadTypes(section),
    rtpExtensions: parseExtmaps(section),
  };
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

function summarizeTransceivers() {
  if (!state) {
    return [];
  }

  return [
    { name: 'audio', transceiver: state.transceivers.audio },
    { name: 'remoteAudio', transceiver: state.transceivers.remoteAudio },
    { name: 'video', transceiver: state.transceivers.video },
    { name: 'remoteVideo', transceiver: state.transceivers.remoteVideo },
    { name: 'presentation', transceiver: state.transceivers.presentation },
    { name: 'remotePresentation', transceiver: state.transceivers.remotePresentation },
  ].map(({ name, transceiver }) => {
    if (!transceiver) {
      return {
        name,
      };
    }

    return {
      name,
      mid: transceiver.mid,
      direction: transceiver.direction,
      currentDirection: transceiver.currentDirection,
      senderTrack: summarizeTrack(transceiver.sender.track || undefined),
      receiverTrack: summarizeTrack(transceiver.receiver.track || undefined),
    };
  });
}

function summarizeContents(contents: MediaContent[]) {
  return contents.map((content, index) => {
    return {
      index,
      type: content.type,
      ssrc: content.ssrc,
      ssrcGroups: content.ssrcGroups?.map((group) => {
        return {
          semantics: group.semantics,
          count: group.ssrcs.length,
        };
      }) || [],
      payloads: content.payloadTypes?.map((payload) => {
        return `${payload.id}:${payload.name}`;
      }) || [],
      extensions: content.rtpExtensions?.map((extension) => {
        return `${extension.id}:${extension.uri}`;
      }) || [],
    };
  });
}

export async function processSignalingMessage(message: P2pMessage) {
  if (!state || !message) return;

  switch (message['@type']) {
    case 'MediaState': {
      const videoState = message.videoState === 'inactive' && hasLiveTrack(state.streams.video)
        ? 'active' : message.videoState;
      const screencastState = message.screencastState === 'inactive' && hasLiveTrack(state.streams.presentation)
        ? 'active' : message.screencastState;
      state.remoteMediaState = {
        isMuted: message.muted,
        isBatteryLow: message.lowBattery,
        videoState,
        videoRotation: message.videoRotation,
        screencastState,
      };
      updateStreams();
      break;
    }
    case 'Candidates': {
      logP2p('received ICE candidates', {
        exchangeId: message.exchangeId,
        ufrag: message.ufrag,
        pendingRemoteExchangeId: state.pendingRemoteNegotiation?.exchangeId,
        remoteDescriptionMids: getRemoteDescriptionMids(state.connection),
        count: message.candidates.length,
      });
      state.pendingCandidates.push(...message.candidates.map((candidate) => {
        return {
          ...candidate,
          exchangeId: message.exchangeId,
          ufrag: message.ufrag || candidate.usernameFragment,
        };
      }));
      await commitPendingIceCandidates();
      break;
    }
    case 'InitialSetup': {
      state.remoteSetup = message;
      await applyRemoteNegotiation();
      break;
    }
    case 'NegotiateChannels': {
      if (state.handledRemoteExchangeIds.has(message.exchangeId)) {
        logP2p('ignore duplicate remote negotiation', {
          exchangeId: message.exchangeId,
        });
        return;
      }
      if (state.isApplyingRemoteNegotiation && state.pendingRemoteNegotiation?.exchangeId === message.exchangeId) {
        logP2p('ignore in-flight duplicate remote negotiation', {
          exchangeId: message.exchangeId,
        });
        return;
      }
      if (state.pendingLocalExchangeId && message.exchangeId !== state.pendingLocalExchangeId) {
        if (state.isOutgoing) {
          state.queuedRemoteNegotiation = message;
          logP2p('queue remote offer until local answer is applied', {
            exchangeId: message.exchangeId,
            pendingLocalExchangeId: state.pendingLocalExchangeId,
          });
          return;
        }

        state.pendingLocalExchangeId = undefined;
      }

      state.pendingRemoteNegotiation = message;
      await applyRemoteNegotiation();
      break;
    }
  }
}

async function commitPendingIceCandidates() {
  if (!state || !state.pendingCandidates.length) {
    return;
  }

  const { connection, pendingCandidates } = state;
  const candidatesToAdd: QueuedP2pCandidate[] = [];
  const queuedCandidates: QueuedP2pCandidate[] = [];

  pendingCandidates.forEach((candidate) => {
    const decision = getCandidateCommitDecision(candidate);
    logP2p('ICE candidate routing', {
      decision,
      exchangeId: candidate.exchangeId,
      ufrag: getCandidateUfrag(candidate),
      pendingRemoteExchangeId: state?.pendingRemoteNegotiation?.exchangeId,
      appliedRemoteExchangeId: state?.appliedRemoteExchangeId,
      remoteDescriptionMids: getRemoteDescriptionMids(connection),
    });

    if (decision === 'add') {
      candidatesToAdd.push(candidate);
    } else if (decision === 'queue') {
      queuedCandidates.push(candidate);
    }
  });

  state.pendingCandidates = queuedCandidates;

  await Promise.all(candidatesToAdd.map((candidate) => {
    return tryAddCandidate(connection, candidate);
  }));
}

function getCandidateCommitDecision(candidate: QueuedP2pCandidate): 'add' | 'queue' | 'drop' {
  if (!state?.connection.remoteDescription) {
    return 'queue';
  }

  const candidateExchangeId = candidate.exchangeId;
  const candidateUfrag = getCandidateUfrag(candidate);
  const remoteUfrags = getRemoteDescriptionUfrags(state.connection);
  const isCurrentUfrag = !candidateUfrag
    || remoteUfrags.has(candidateUfrag)
    || candidateUfrag === state.appliedRemoteUfrag;

  if (candidateExchangeId) {
    if (state.appliedRemoteExchangeIds.has(candidateExchangeId)) {
      return isCurrentUfrag ? 'add' : 'drop';
    }

    if (
      candidateExchangeId === state.pendingLocalExchangeId
      || candidateExchangeId === state.pendingRemoteNegotiation?.exchangeId
      || candidateExchangeId === state.queuedRemoteNegotiation?.exchangeId
    ) {
      return 'queue';
    }

    if (state.handledRemoteExchangeIds.has(candidateExchangeId)) {
      return 'drop';
    }

    return 'queue';
  }

  if (isCurrentUfrag) {
    return 'add';
  }

  return 'queue';
}

async function tryAddCandidate(
  connection: RTCPeerConnection,
  candidate: QueuedP2pCandidate,
) {
  const sdpString = normalizeCandidateComponent(candidate.sdpString);
  if (!sdpString) {
    return;
  }

  const rtcCandidate: RTCIceCandidateInit = {
    candidate: sdpString,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: getCandidateUfrag(candidate),
  };

  if (
    !rtcCandidate.sdpMid
    // eslint-disable-next-line no-null/no-null
    && (rtcCandidate.sdpMLineIndex === undefined || rtcCandidate.sdpMLineIndex === null)
  ) {
    const fallbackMLineIndex = getLegacyCandidateMLineIndex(connection);
    if (fallbackMLineIndex === undefined) {
      logP2p('drop ICE candidate without media id', {
        candidate: rtcCandidate,
        remoteSdpSummary: getRemoteSdpSummary(connection),
      });
      return;
    }

    rtcCandidate.sdpMLineIndex = fallbackMLineIndex;
  }

  await addIceCandidate(connection, rtcCandidate);
}

async function addIceCandidate(connection: RTCPeerConnection, candidate: RTCIceCandidateInit) {
  try {
    await connection.addIceCandidate(candidate);
  } catch (error) {
    logP2pWarning('failed to add ICE candidate', {
      candidate,
      remoteSdpSummary: getRemoteSdpSummary(connection),
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

function getLegacyCandidateMLineIndex(connection: RTCPeerConnection) {
  const sdp = connection.remoteDescription?.sdp;
  if (!sdp) {
    return undefined;
  }

  const mediaSections = parseSdpSections(sdp).filter((section) => {
    return section.kind !== 'session';
  });
  const activeMediaSections = mediaSections.filter((section) => {
    return getSdpPort(section) !== 0;
  });
  const activeRtpMediaSections = activeMediaSections.filter((section) => {
    return section.kind === 'audio' || section.kind === 'video';
  });

  if (activeMediaSections.length === 1) {
    return mediaSections.indexOf(activeMediaSections[0]);
  }

  if (activeRtpMediaSections.length === 1 && activeMediaSections.every((section) => {
    return section.kind === 'application' || section === activeRtpMediaSections[0];
  })) {
    return mediaSections.indexOf(activeRtpMediaSections[0]);
  }

  return undefined;
}

function getCandidateUfrag(candidate: QueuedP2pCandidate) {
  return candidate.ufrag || candidate.usernameFragment || undefined;
}

function getRemoteDescriptionUfrags(connection: RTCPeerConnection) {
  const sdp = connection.remoteDescription?.sdp;
  if (!sdp) {
    return new Set<string>();
  }

  const sections = parseSdpSections(sdp);
  const ufrags = new Set<string>();
  sections.forEach((section) => {
    const ufrag = findLineValue(sections, 'a=ice-ufrag:', section);
    if (ufrag) {
      ufrags.add(ufrag);
    }
  });

  return ufrags;
}

function getRemoteDescriptionMids(connection: RTCPeerConnection) {
  const sdp = connection.remoteDescription?.sdp;
  if (!sdp) {
    return [];
  }

  const sections = parseSdpSections(sdp);
  return sections.filter((section) => {
    return section.kind !== 'session';
  }).map((section, index) => {
    return {
      index,
      kind: section.kind,
      mid: section.mid,
      port: getSdpPort(section),
      ufrag: findLineValue(sections, 'a=ice-ufrag:', section),
    };
  });
}

function getRemoteSdpSummary(connection: RTCPeerConnection) {
  const sdp = connection.remoteDescription?.sdp;
  return sdp ? summarizeSdp(sdp) : undefined;
}

function normalizeCandidateComponent(sdpString?: string) {
  if (!sdpString) {
    return undefined;
  }

  const component = sdpString.match(/^candidate:\S+ (\d+) /)?.[1];
  if (component === '2') {
    return undefined;
  }

  return sdpString;
}
