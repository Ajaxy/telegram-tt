import type {
  Fingerprint, RTCPFeedbackParam, RTPExtension,
} from './types';

export type VideoState = 'inactive' | 'active' | 'suspended';

export type VideoRotation = 0 | 90 | 180 | 270;

export type MediaStateMessage = {
  '@type': 'MediaState';
  isMuted: boolean;
  videoState: VideoState;
  videoRotation: VideoRotation;
  screencastState: VideoState;
  isBatteryLow: boolean;
};

type CandidatesMessage = {
  '@type': 'Candidates';
  candidates: P2pCandidate[];
};

export type InitialSetupMessage = {
  '@type': 'InitialSetup';
  ufrag: string;
  pwd: string;
  fingerprints: Fingerprint[];
  audio?: MediaContent;
  video?: MediaContent;
  screencast?: MediaContent;
};

export type MediaContent = {
  ssrc: string;
  ssrcGroups: P2pSsrcGroup[];
  payloadTypes: P2PPayloadType[];
  rtpExtensions: RTPExtension[];
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
};

export type P2pMessage = CandidatesMessage | InitialSetupMessage | MediaStateMessage;
