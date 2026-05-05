import type {
  Fingerprint, RTCPFeedbackParam, RTPExtension,
} from '../types';

export type VideoState = 'inactive' | 'active' | 'suspended';

export type VideoRotation = 0 | 90 | 180 | 270;

export type MediaStateMessage = {
  '@type': 'MediaState';
  muted: boolean;
  videoState: VideoState;
  videoRotation: VideoRotation;
  screencastState: VideoState;
  lowBattery: boolean;
};

type CandidatesMessage = {
  '@type': 'Candidates';
  exchangeId?: string;
  ufrag?: string;
  candidates: P2pCandidate[];
};

export type InitialSetupMessage = {
  '@type': 'InitialSetup';
  ufrag: string;
  pwd: string;
  renomination: boolean;
  fingerprints: Fingerprint[];
};

export type MediaContent = {
  type: 'audio' | 'video';
  ssrc: string;
  ssrcGroups?: P2pSsrcGroup[];
  payloadTypes?: P2PPayloadType[];
  rtpExtensions?: RTPExtension[];
};

export type NegotiateChannelsMessage = {
  '@type': 'NegotiateChannels';
  exchangeId: string;
  contents: MediaContent[];
};

export interface P2PPayloadType {
  id: number;
  name: string;
  clockrate: number;
  channels: number;
  parameters?: Record<string, string>;
  feedbackTypes?: RTCPFeedbackParam[];
}

type P2pSsrcGroup = {
  semantics?: string;
  ssrcs: number[];
};

type P2pCandidate = {
  sdpString: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
  usernameFragment?: string;
};

export type P2pMessage = CandidatesMessage | InitialSetupMessage | MediaStateMessage | NegotiateChannelsMessage;
