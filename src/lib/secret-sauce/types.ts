import { P2PPayloadType } from './p2pMessage';

export interface GroupCallParticipant {
  isSelf?: boolean;
  isMuted?: boolean;
  isLeft?: boolean;
  isUser?: boolean;
  canSelfUnmute?: boolean;
  hasJustJoined?: boolean;
  isVideoJoined?: boolean;
  isMutedByMe?: boolean;
  isVolumeByAdmin?: boolean;
  isMin?: boolean;
  isVersioned?: boolean;
  source: number;
  date: Date;
  id: string;
  volume?: number;
  about?: string;
  video?: GroupCallParticipantVideo;
  presentation?: GroupCallParticipantVideo;
  raiseHandRating?: string;

  hasAudioStream?: boolean;
  hasVideoStream?: boolean;
  hasPresentationStream?: boolean;
  amplitude?: number;
}

export type GroupCallConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'discarded';

export interface GroupCallParticipantVideo {
  endpoint: string;
  isPaused?: boolean;
  sourceGroups: SsrcGroup[];
  audioSource?: number;
}

export type Fingerprint = {
  hash: string;
  setup: string;
  fingerprint: string;
};

export type SsrcGroup = {
  semantics?: string;
  sources: number[];
};

export type Candidate = {
  generation: string;
  component: string;
  protocol: string;
  port: string;
  ip: string;
  foundation: string;
  id: string;
  priority: string;
  type: string;
  network: string;
  'rel-addr': string;
  'rel-port': string;

  sdpString?: string; // Used for P2P
};

export type JoinGroupCallPayload = {
  ufrag: string;
  pwd: string;
  fingerprints: Fingerprint[];
  ssrc?: number;
  'ssrc-groups'?: SsrcGroup[];
};

export type P2pParsedSdp = JoinGroupCallPayload & {
  audioExtmap: RTPExtension[];
  videoExtmap: RTPExtension[];
  screencastExtmap: RTPExtension[];
  audioPayloadTypes: P2PPayloadType[];
  videoPayloadTypes: P2PPayloadType[];
  screencastPayloadTypes: P2PPayloadType[];
};

export interface RTPExtension {
  id: number;
  uri: string;
}

export interface RTCPFeedbackParam {
  type: string;
  subtype?: string;
}

export interface PayloadType {
  id: number;
  name: string;
  clockrate: number;
  channels: number;
  parameters?: Record<string, string | number>;
  'rtcp-fbs'?: RTCPFeedbackParam[];
}

export interface GroupCallTransport {
  candidates: Candidate[];
  pwd: string;
  ufrag: string;
  fingerprints: Fingerprint[];
  'rtcp-mux': boolean;
  xmlns: string;
}

export interface GroupCallConnectionData {
  transport: GroupCallTransport;
  audio: {
    'payload-types': PayloadType[];
    'rtp-hdrexts': RTPExtension[];
  };
  video: {
    endpoint: string;
    'payload-types': PayloadType[];
    'rtp-hdrexts': RTPExtension[];
    server_sources: number[];
  };
  stream?: boolean;
}

export interface ApiPhoneCallConnection {
  username: string;
  password: string;
  isTurn?: boolean;
  isStun?: boolean;
  ip: string;
  ipv6: string;
  port: number;
}

export interface ApiCallProtocol {
  libraryVersions: string[];
  minLayer: number;
  maxLayer: number;
  isUdpP2p?: boolean;
  isUdpReflector?: boolean;
}
